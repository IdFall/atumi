/**
 * Processus worker, lancé séparément de l'application web : `npm run worker`.
 * On en démarre autant que nécessaire pendant les pics (périodes d'examens).
 */
import { PgBoss } from "pg-boss";

import { payloadSchemas, QUEUE_OPTIONS, QUEUES, type QueueName } from "../server/jobs/queues";

type Handler = (data: unknown) => Promise<void>;

function pending(queue: QueueName): Handler {
  return async (data) => {
    const payload = payloadSchemas[queue].parse(data);
    // À implémenter dans les prochaines étapes du MVP.
    console.warn(`[worker] ${queue} pas encore implémenté`, payload);
  };
}

const handlers: Record<QueueName, Handler> = {
  [QUEUES.documentIngest]: pending(QUEUES.documentIngest),
  [QUEUES.synthesisGenerate]: pending(QUEUES.synthesisGenerate),
  [QUEUES.quizGenerate]: pending(QUEUES.quizGenerate),
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manquant");

  const boss = new PgBoss(connectionString);
  boss.on("error", (error) => console.error("[worker]", error));
  await boss.start();

  for (const [queue, handle] of Object.entries(handlers)) {
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
