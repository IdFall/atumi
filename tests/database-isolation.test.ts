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
    create role anon;
    create role authenticated;
    -- Comme sur Supabase : droits par défaut sur ce que créent les migrations.
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb);
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
    grant usage on schema auth, storage to authenticated;
    grant select, insert, update, delete on all tables in schema storage to authenticated;
    grant execute on all functions in schema auth, storage to authenticated;
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${A}', 'a@exemple.sn', '{"username": "awa", "cycle": "universite", "cgu_accepted": true, "cgu_version": "2026-11"}'),
      ('${B}', 'b@exemple.sn', '{"username": "bakary", "cycle": "lycee", "guardian_phone": "+221770000000", "cgu_accepted": true}');
    insert into public.modules (id, user_id, name) values
      ('${MODULE_A}', '${A}', 'Maths A'), ('${MODULE_B}', '${B}', 'Maths B');
    insert into public.plans (code, country_code, kind, label, price_minor, currency, duration_days, quiz_limit)
      values ('test-illimite', 'SN', 'abonnement', 'Test', 0, 'XOF', 30, null);
    insert into public.subscriptions (user_id, plan_code, status, amount_minor, currency, payment_provider,
      payment_reference, starts_at, ends_at)
      values ('${A}', 'test-illimite', 'active', 0, 'XOF', 'test', 'ref-a', now() - interval '1 day', now() + interval '29 days');
    insert into public.quizzes (user_id, module_id) values ('${A}', '${MODULE_A}');
    insert into public.quiz_questions (user_id, quiz_id, position, kind, prompt, expected_answer)
      select '${A}', id, 1, 'qcm', '2+2 ?', '"4"' from public.quizzes;
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const C = "00000000-0000-0000-0000-00000000000c";

function insertUser(meta: Record<string, unknown>) {
  return db.exec(
    `insert into auth.users (id, raw_user_meta_data) values ('${C}', '${JSON.stringify(meta)}')`,
  );
}

describe("inscription", () => {
  it("crée le profil et le consentement aux CGU", async () => {
    await asUser(A);
    const profile = await db.query<{ username: string; country_code: string; cycle: string }>(
      `select username, country_code, cycle from public.profiles`,
    );
    expect(profile.rows).toEqual([{ username: "awa", country_code: "SN", cycle: "universite" }]);
    const consents = await db.query<{ kind: string }>(`select kind from public.consents`);
    expect(consents.rows.map((r) => r.kind)).toEqual(["cgu"]);
  });

  it("enregistre l'accord parental d'un lycéen", async () => {
    await asUser(B);
    const consents = await db.query<{ kind: string; guardian_phone_e164: string | null }>(
      `select kind, guardian_phone_e164 from public.consents order by kind`,
    );
    expect(consents.rows).toEqual([
      { kind: "cgu", guardian_phone_e164: null },
      { kind: "parental", guardian_phone_e164: "+221770000000" },
    ]);
  });

  it("refuse un mineur sans accord parental", async () => {
    await asService();
    await expect(insertUser({ username: "cheikh", cycle: "lycee", cgu_accepted: true })).rejects.toThrow(
      /ACCORD_PARENTAL/,
    );
  });

  it("refuse le collège, pas encore ouvert en V1", async () => {
    await asService();
    await expect(
      insertUser({ username: "cheikh", cycle: "college", guardian_phone: "+221770000000", cgu_accepted: true }),
    ).rejects.toThrow(/NIVEAU_NON_OUVERT/);
  });

  it("refuse une inscription sans acceptation des CGU", async () => {
    await asService();
    await expect(insertUser({ username: "cheikh", cycle: "universite" })).rejects.toThrow(/CGU/);
  });

  it("refuse un pays pas encore ouvert", async () => {
    await asService();
    await expect(
      insertUser({ username: "cheikh", cycle: "universite", cgu_accepted: true, country_code: "CI" }),
    ).rejects.toThrow(/PAYS_NON_OUVERT/);
  });

  it("refuse un pseudo déjà pris ou mal formé", async () => {
    await asService();
    await expect(insertUser({ username: "awa", cycle: "universite", cgu_accepted: true })).rejects.toThrow();
    await expect(insertUser({ username: "A W A", cycle: "universite", cgu_accepted: true })).rejects.toThrow();
  });

  it("laisse modifier le niveau mais pas le pseudo ni le pays", async () => {
    await asUser(A);
    await db.exec(`update public.profiles set cycle = 'lycee'`);
    await expect(db.exec(`update public.profiles set cycle = 'college'`)).rejects.toThrow(/NIVEAU_NON_OUVERT/);
    await expect(db.exec(`update public.profiles set username = 'autre'`)).rejects.toThrow();
    await expect(db.exec(`update public.profiles set country_code = 'CI'`)).rejects.toThrow();
    await db.exec(`update public.profiles set cycle = 'universite'`);
  });
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

  it("la photo de profil reste dans le dossier de son propriétaire", async () => {
    await asUser(A);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('avatars', '${A}/photo.jpg')`);
    await expect(
      db.exec(`insert into storage.objects (bucket_id, name) values ('avatars', '${B}/photo.jpg')`),
    ).rejects.toThrow();
    await db.exec(`update public.profiles set avatar_path = '${A}/photo.jpg'`);
    await expect(db.exec(`update public.profiles set avatar_path = '${B}/photo.jpg'`)).rejects.toThrow();
    await asUser(B);
    const visible = await db.query(`select 1 from storage.objects where bucket_id = 'avatars'`);
    expect(visible.rows).toHaveLength(0);
  });

  it("un seul essai gratuit par numéro de téléphone", async () => {
    await asService();
    await db.exec(`insert into public.trials (user_id, phone_e164) values ('${A}', '+221771234567')`);
    await expect(
      db.exec(`insert into public.trials (user_id, phone_e164) values ('${B}', '+221771234567')`),
    ).rejects.toThrow();
  });

  it("limite le nombre de quiz selon le forfait", async () => {
    const D = "00000000-0000-0000-0000-00000000000d";
    const MODULE_D = "10000000-0000-0000-0000-00000000000d";
    await asService();
    await db.exec(`
      insert into auth.users (id, phone, raw_user_meta_data) values
        ('${D}', '+221770000001', '{"username": "dieynaba", "cycle": "universite", "cgu_accepted": true}');
      insert into public.modules (id, user_id, name) values ('${MODULE_D}', '${D}', 'Physique');
    `);
    // Sans essai ni abonnement : pas de quiz.
    await expect(
      db.exec(`insert into public.quizzes (user_id, module_id) values ('${D}', '${MODULE_D}')`),
    ).rejects.toThrow(/ACCES_EXPIRE/);

    // Essai en cours : 3 quiz, pas un de plus.
    await db.exec(`insert into public.trials (user_id, phone_e164, started_at, ends_at)
      values ('${D}', '+221770000001', now(), now() + interval '24 hours')`);
    for (let i = 0; i < 3; i++) {
      await db.exec(`insert into public.quizzes (user_id, module_id) values ('${D}', '${MODULE_D}')`);
    }
    await expect(
      db.exec(`insert into public.quizzes (user_id, module_id) values ('${D}', '${MODULE_D}')`),
    ).rejects.toThrow(/QUOTA_QUIZ_ATTEINT/);

    await asUser(D);
    const quota = await db.query<{ plan_code: string; quiz_limit: number; used: number; remaining: number }>(
      `select plan_code, quiz_limit, used, remaining from public.quiz_quota()`,
    );
    expect(quota.rows).toEqual([{ plan_code: "sn-essai", quiz_limit: 3, used: 3, remaining: 0 }]);
  });

  it("les forfaits ne sont modifiables que par le serveur", async () => {
    await asUser(A);
    await expect(db.exec(`update public.plans set quiz_limit = null`)).rejects.toThrow();
    const visibles = await db.query<{ code: string }>(`select code from public.plans order by code`);
    expect(visibles.rows.map((r) => r.code)).toEqual(["sn-essai"]);
  });

  it("seul le Sénégal est ouvert au lancement", async () => {
    await asUser(A);
    const { rows } = await db.query<{ code: string }>(`select code from public.countries where is_active`);
    expect(rows.map((r) => r.code)).toEqual(["SN"]);
  });
});
