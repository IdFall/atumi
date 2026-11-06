/**
 * Processus worker, lancé séparément de l'application web : `npm run worker`.
 * On en démarre autant que nécessaire pendant les pics (périodes d'examens).
 */
import { PgBoss } from "pg-boss";

import { AnthropicProvider } from "../server/ai/anthropic";
import { payloadSchemas, QUEUE_OPTIONS, QUEUES, type QueueName } from "../server/jobs/queues";

import { ingestDocument } from "./ingest";
import { generateQuiz, generateSynthesis } from "./study";
import {
  createSynthesisAfterIngest,
  createWorkerClient,
  supabaseIngestStore,
  supabaseStudyStore,
} from "./supabase-store";

type Handler = (data: unknown) => Promise<void>;

const db = createWorkerClient();
const ingestStore = supabaseIngestStore(db);
const studyStore = supabaseStudyStore(db);
const provider = new AnthropicProvider({
  models: {
    standard: process.env.LULU_AI_MODEL ?? "claude-opus-5-5",
    light: process.env.LULU_AI_MODEL_LIGHT ?? "claude-opus-5-5",
  },
});

function handlers(boss: PgBoss): Record<QueueName, Handler> {
  return {
    [QUEUES.documentIngest]: async (data) => {
      const { userId, documentId } = payloadSchemas[QUEUES.documentIngest].parse(data);
      const result = await ingestDocument(ingestStore, userId, documentId);
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
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manquant");

  const boss = new PgBoss(connectionString);
  boss.on("error", (error) => console.error("[worker]", error));
  await boss.start();

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
