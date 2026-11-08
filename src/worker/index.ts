/**
 * Processus worker, lancé séparément de l'application web : `npm run worker`.
 * On en démarre autant que nécessaire pendant les pics (périodes d'examens).
 */
import { PgBoss } from "pg-boss";

import { createAiProvider } from "../server/ai/anthropic";
import { payloadSchemas, QUEUE_OPTIONS, QUEUES, type QueueName } from "../server/jobs/queues";

import { checkDatabaseUrl, explainConnectionError } from "./database-url";
import { ingestDocument } from "./ingest";
import { generateQuiz, generateSynthesis } from "./study";
import { notifyTeam, sendersFromEnv } from "./support";
import {
  createSynthesisAfterIngest,
  createWorkerClient,
  supabaseIngestStore,
  supabaseStudyStore,
  supabaseSupportStore,
} from "./supabase-store";

type Handler = (data: unknown) => Promise<void>;

const db = createWorkerClient();
const ingestStore = supabaseIngestStore(db);
const studyStore = supabaseStudyStore(db);
const supportStore = supabaseSupportStore(db);
const supportSenders = sendersFromEnv(process.env);
// Sans clé d'API, le worker démarre quand même : l'import PDF et Word fonctionne, l'IA est indisponible.
const provider = createAiProvider(process.env.ANTHROPIC_API_KEY, {
  standard: process.env.ATUMI_AI_MODEL ?? "claude-opus-5-5",
  light: process.env.ATUMI_AI_MODEL_LIGHT ?? "claude-opus-5-5",
});

function handlers(boss: PgBoss): Record<QueueName, Handler> {
  return {
    [QUEUES.documentIngest]: async (data) => {
      const { userId, documentId } = payloadSchemas[QUEUES.documentIngest].parse(data);
      const result = await ingestDocument(ingestStore, provider, userId, documentId);
      console.log(`[worker] document ${documentId} : ${result}`);
      if (result === "ready") {
        // La synthèse est prête quand l'apprenant ouvre son chapitre.
        const synthesisId = await createSynthesisAfterIngest(db, userId, documentId);
        if (synthesisId) await boss.send(QUEUES.synthesisGenerate, { userId, synthesisId });
      }
    },
    [QUEUES.synthesisGenerate]: async (data) => {
      const { userId, synthesisId } = payloadSchemas[QUEUES.synthesisGenerate].parse(data);
      console.log(`[worker] synthèse ${synthesisId} : ${await generateSynthesis(studyStore, provider, userId, synthesisId)}`);
    },
    [QUEUES.quizGenerate]: async (data) => {
      const { userId, quizId } = payloadSchemas[QUEUES.quizGenerate].parse(data);
      console.log(`[worker] quiz ${quizId} : ${await generateQuiz(studyStore, provider, userId, quizId)}`);
    },
    [QUEUES.supportNotify]: async (data) => {
      const { requestId } = payloadSchemas[QUEUES.supportNotify].parse(data);
      console.log(`[worker] demande d'aide ${requestId} : ${await notifyTeam(supportStore, supportSenders, requestId)}`);
    },
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manquant");

  const check = checkDatabaseUrl(connectionString);
  console.log(`[worker] connexion à la base : ${check.summary}`);
  for (const problem of check.problems) console.error(`[worker] DATABASE_URL : ${problem}`);

  const boss = new PgBoss(connectionString.trim());
  boss.on("error", (error) => console.error("[worker]", error));
  try {
    await boss.start();
  } catch (error) {
    const hint = explainConnectionError(error);
    if (hint) console.error(`[worker] ${hint}`);
    throw error;
  }

  for (const [queue, handle] of Object.entries(handlers(boss))) {
    await boss.createQueue(queue, QUEUE_OPTIONS);
    await boss.work(queue, async (jobs) => {
      for (const job of jobs) await handle(job.data);
    });
  }

  const shutdown = async () => {
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  console.log("[worker] prêt");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
