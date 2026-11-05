/**
 * Applique les migrations sur un Postgres embarqué (PGlite + pgvector) et vérifie
 * qu'un utilisateur ne peut ni lire ni écrire les données d'un autre.
 * Les schémas `auth` et `storage` de Supabase sont simulés au minimum.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const MODULE_A = "10000000-0000-0000-0000-00000000000a";
const MODULE_B = "10000000-0000-0000-0000-00000000000b";

let db: PGlite;

async function asUser(userId: string) {
  await db.exec(`reset role; set role authenticated; set request.jwt.sub = '${userId}';`);
}

async function asService() {
  await db.exec(`reset role;`);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(`
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select string_to_array(name, '/') $$;
  `);

  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  await db.exec(`
    grant usage on schema public, auth, storage to authenticated;
    grant select, insert, update, delete on all tables in schema public, storage to authenticated;
    grant execute on all functions in schema public, auth, storage to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
    insert into public.modules (id, user_id, name) values
      ('${MODULE_A}', '${A}', 'Maths A'), ('${MODULE_B}', '${B}', 'Maths B');
    insert into public.quizzes (user_id, module_id) values ('${A}', '${MODULE_A}');
    insert into public.quiz_questions (user_id, quiz_id, position, kind, prompt, expected_answer)
      select '${A}', id, 1, 'qcm', '2+2 ?', '"4"' from public.quizzes;
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("isolation des données entre utilisateurs", () => {
  it("un utilisateur ne voit que ses propres modules", async () => {
    await asUser(A);
    const { rows } = await db.query<{ name: string }>(`select name from public.modules`);
    expect(rows.map((r) => r.name)).toEqual(["Maths A"]);
  });

  it("un utilisateur ne peut pas écrire au nom d'un autre", async () => {
    await asUser(A);
    await expect(db.exec(`insert into public.modules (user_id, name) values ('${B}', 'usurpation')`)).rejects.toThrow();
  });

  it("un chapitre ne peut pas être rattaché au module d'un autre utilisateur", async () => {
    await asService();
    await expect(
      db.exec(`insert into public.chapters (user_id, module_id, title) values ('${B}', '${MODULE_A}', 'intrus')`),
    ).rejects.toThrow();
  });

  it("les réponses attendues des quiz restent invisibles côté client", async () => {
    await asUser(A);
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.quiz_questions`);
    expect(rows[0].n).toBe(0);
  });

  it("la consommation IA ne peut être écrite que par le serveur", async () => {
    await asUser(A);
    await expect(
      db.exec(`insert into public.ai_usage (user_id, feature, model) values ('${A}', 'tutor', 'x')`),
    ).rejects.toThrow();
  });

  it("un fichier ne peut être déposé que dans son propre dossier", async () => {
    await asUser(A);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('documents', '${A}/cours.pdf')`);
    await expect(
      db.exec(`insert into storage.objects (bucket_id, name) values ('documents', '${B}/cours.pdf')`),
    ).rejects.toThrow();
  });

  it("un seul essai gratuit par numéro de téléphone", async () => {
    await asService();
    await db.exec(`insert into public.trials (user_id, phone_e164) values ('${A}', '+221771234567')`);
    await expect(
      db.exec(`insert into public.trials (user_id, phone_e164) values ('${B}', '+221771234567')`),
    ).rejects.toThrow();
  });

  it("seul le Sénégal est ouvert au lancement", async () => {
    await asUser(A);
    const { rows } = await db.query<{ code: string }>(`select code from public.countries where is_active`);
    expect(rows.map((r) => r.code)).toEqual(["SN"]);
  });
});
