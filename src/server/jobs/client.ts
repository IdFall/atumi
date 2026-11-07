import "server-only";

import { PgBoss } from "pg-boss";

import { serverEnv } from "@/lib/env";

import { payloadSchemas, QUEUE_OPTIONS, QUEUES, type Payload, type QueueName } from "./queues";

let boss: PgBoss | undefined;

async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    const instance = new PgBoss(serverEnv().DATABASE_URL);
    await instance.start();
    for (const name of Object.values(QUEUES)) {
      await instance.createQueue(name, QUEUE_OPTIONS);
    }
    boss = instance;
  }
  return boss;
}

/** Dépose un travail après validation de son contenu. */
export async function enqueue<Q extends QueueName>(queue: Q, payload: Payload<Q>): Promise<string | null> {
  const data = payloadSchemas[queue].parse(payload);
  return (await getBoss()).send(queue, data);
}
