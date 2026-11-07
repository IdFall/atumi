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
    await db.exec(`update public.profiles set tutor_language = 'wo'`);
    await expect(db.exec(`update public.profiles set tutor_language = 'de'`)).rejects.toThrow();
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

    // Essai en cours : 1 quiz, pas un de plus.
    await db.exec(`insert into public.trials (user_id, phone_e164, started_at, ends_at)
      values ('${D}', '+221770000001', now(), now() + interval '24 hours')`);
    await db.exec(`insert into public.quizzes (user_id, module_id) values ('${D}', '${MODULE_D}')`);
    await expect(
      db.exec(`insert into public.quizzes (user_id, module_id) values ('${D}', '${MODULE_D}')`),
    ).rejects.toThrow(/QUOTA_QUIZ_ATTEINT/);

    await asUser(D);
    const quota = await db.query<{ plan_code: string; quiz_limit: number; used: number; remaining: number }>(
      `select plan_code, quiz_limit, used, remaining from public.quiz_quota()`,
    );
    expect(quota.rows).toEqual([{ plan_code: "sn-essai", quiz_limit: 1, used: 1, remaining: 0 }]);
  });

  it("les appels avec le professeur restent privés et sont comptés par le serveur", async () => {
    await asService();
    await db.exec(`
      insert into public.tutor_conversations (id, user_id, mode)
        values ('20000000-0000-0000-0000-00000000000a', '${A}', 'decouvrir');
      insert into public.tutor_calls (user_id, conversation_id, language, started_at, ended_at, duration_seconds)
        values ('${A}', '20000000-0000-0000-0000-00000000000a', 'fr', now() - interval '5 minutes', now(), 300);
    `);
    await asUser(A);
    const mine = await db.query<{ duration_seconds: number }>(`select duration_seconds from public.tutor_calls`);
    expect(mine.rows).toEqual([{ duration_seconds: 300 }]);
    await expect(
      db.exec(`insert into public.tutor_calls (user_id, conversation_id, language)
        values ('${A}', '20000000-0000-0000-0000-00000000000a', 'fr')`),
    ).rejects.toThrow();
    await expect(db.exec(`update public.tutor_calls set duration_seconds = 0`)).rejects.toThrow();
    const quota = await db.query<{ seconds_used: number; seconds_remaining: number | null }>(
      `select seconds_used, seconds_remaining from public.call_quota()`,
    );
    expect(quota.rows).toEqual([{ seconds_used: 300, seconds_remaining: null }]);

    await asUser(B);
    const others = await db.query(`select 1 from public.tutor_calls`);
    expect(others.rows).toHaveLength(0);
  });

  it("démarre l'essai de 24 h au premier import, une seule fois par numéro", async () => {
    const E = "00000000-0000-0000-0000-00000000000e";
    const F = "00000000-0000-0000-0000-00000000000f";
    const G = "00000000-0000-0000-0000-000000000010";
    await asService();
    await db.exec(`
      insert into auth.users (id, phone, raw_user_meta_data) values
        ('${E}', '221770000002', '{"username": "elhadji", "cycle": "universite", "cgu_accepted": true}'),
        ('${F}', '221770000002', '{"username": "fatou", "cycle": "universite", "cgu_accepted": true}');
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${G}', 'g@exemple.sn', '{"username": "gora", "cycle": "universite", "cgu_accepted": true}');
    `);
    const importAs = async (userId: string, name: string) => {
      await asUser(userId);
      const moduleRow = await db.query<{ id: string }>(
        `insert into public.modules (user_id, name) values ('${userId}', 'Analyse') returning id`,
      );
      return db.query<{ status: string }>(
        `insert into public.documents (user_id, module_id, kind, title, storage_path, mime_type, size_bytes, status)
         values ('${userId}', '${moduleRow.rows[0].id}', 'cours', '${name}', '${userId}/${name}.pdf',
                 'application/pdf', 1000, 'ready') returning status`,
      );
    };

    // Premier import : l'essai démarre, l'état « prêt » envoyé par le client est ignoré.
    const first = await importAs(E, "cours1");
    expect(first.rows).toEqual([{ status: "uploaded" }]);
    const access = await db.query<{ plan_code: string; kind: string; trial_used: boolean }>(
      `select plan_code, kind, trial_used from public.my_access()`,
    );
    expect(access.rows).toEqual([{ plan_code: "sn-essai", kind: "essai", trial_used: true }]);
    await expect(db.exec(`update public.documents set status = 'ready'`)).rejects.toThrow();
    // Sans règle de modification, la base ignore la tentative de prolonger l'essai.
    await db.exec(`update public.trials set ends_at = now() + interval '1 year'`);
    const trial = await db.query<{ hours: number }>(
      `select round(extract(epoch from ends_at - started_at) / 3600)::int as hours from public.trials`,
    );
    expect(trial.rows).toEqual([{ hours: 24 }]);

    // Même numéro sur un second compte : pas de nouvel essai, pas d'import.
    await expect(importAs(F, "cours2")).rejects.toThrow(/ACCES_EXPIRE/);

    // Compte ouvert par e-mail : un essai pour ce compte.
    const byEmail = await importAs(G, "cours3");
    expect(byEmail.rows).toEqual([{ status: "uploaded" }]);

    // Essai : un seul import.
    await expect(importAs(G, "cours5")).rejects.toThrow(/QUOTA_IMPORT_ATTEINT/);
    const usage = await db.query(
      `select documents_used, document_limit, tutor_message_limit, quiz_question_limit from public.plan_usage()`,
    );
    expect(usage.rows).toEqual([{ documents_used: 1, document_limit: 1, tutor_message_limit: 3, quiz_question_limit: 5 }]);

    // Essai : pas d'appel avec le professeur (réservé aux abonnés).
    const calls = await db.query(`select seconds_remaining from public.call_quota()`);
    expect(calls.rows).toEqual([{ seconds_remaining: 0 }]);

    // Essai : 3 messages au professeur ; ses réponses ne comptent pas.
    await asService();
    await db.exec(`
      insert into public.tutor_conversations (id, user_id, mode)
        values ('20000000-0000-0000-0000-000000000010', '${G}', 'expliquer');
      insert into public.tutor_messages (user_id, conversation_id, role, content)
        select '${G}', '20000000-0000-0000-0000-000000000010', r, 'message'
        from generate_series(1, 3), unnest(array['user', 'assistant']) r;
    `);
    await expect(
      db.exec(`insert into public.tutor_messages (user_id, conversation_id, role, content)
        values ('${G}', '20000000-0000-0000-0000-000000000010', 'user', 'quatrième')`),
    ).rejects.toThrow(/QUOTA_MESSAGES_ATTEINT/);

    // Fichier rangé dans le dossier d'un autre : refusé.
    await asUser(E);
    const mod = await db.query<{ id: string }>(`select id from public.modules limit 1`);
    await expect(
      db.exec(`insert into public.documents (user_id, module_id, kind, title, storage_path, mime_type, size_bytes)
        values ('${E}', '${mod.rows[0].id}', 'cours', 'x', '${F}/x.pdf', 'application/pdf', 10)`),
    ).rejects.toThrow();

    // Essai terminé : plus d'import.
    await asService();
    await db.exec(`update public.trials set started_at = now() - interval '2 days',
      ends_at = now() - interval '1 day' where user_id = '${E}'`);
    await expect(importAs(E, "cours4")).rejects.toThrow(/ACCES_EXPIRE/);
  });

  it("synthèses et quiz sont écrits par le serveur ; un quiz échoué ne compte pas", async () => {
    const H = "00000000-0000-0000-0000-000000000011";
    const MODULE_H = "10000000-0000-0000-0000-000000000011";
    await asService();
    await db.exec(`
      insert into auth.users (id, phone, raw_user_meta_data) values
        ('${H}', '221770000009', '{"username": "habib", "cycle": "universite", "cgu_accepted": true}');
      insert into public.modules (id, user_id, name) values ('${MODULE_H}', '${H}', 'Chimie');
      insert into public.trials (user_id, phone_e164, started_at, ends_at)
        values ('${H}', '+221770000009', now(), now() + interval '24 hours');
    `);

    // Quiz dont la génération a échoué : le quota reste disponible.
    const failed = await db.query<{ id: string }>(
      `insert into public.quizzes (user_id, module_id) values ('${H}', '${MODULE_H}') returning id`,
    );
    await db.exec(`update public.quizzes set status = 'failed' where id = '${failed.rows[0].id}'`);
    const quiz = await db.query<{ id: string; status: string; question_count: number }>(
      `insert into public.quizzes (user_id, module_id) values ('${H}', '${MODULE_H}') returning id, status, question_count`,
    );
    expect(quiz.rows[0]).toMatchObject({ status: "generating", question_count: 5 });

    // Un seul passage par quiz.
    await db.exec(`insert into public.quiz_attempts (user_id, quiz_id) values ('${H}', '${quiz.rows[0].id}')`);
    await expect(
      db.exec(`insert into public.quiz_attempts (user_id, quiz_id) values ('${H}', '${quiz.rows[0].id}')`),
    ).rejects.toThrow();

    await db.exec(`insert into public.syntheses (user_id, module_id) values ('${H}', '${MODULE_H}')`);
    await asUser(H);
    await expect(
      db.exec(`insert into public.syntheses (user_id, module_id, content_md, status)
        values ('${H}', '${MODULE_H}', 'x', 'ready')`),
    ).rejects.toThrow();
    const mine = await db.query<{ status: string }>(`select status from public.syntheses`);
    expect(mine.rows).toEqual([{ status: "generating" }]);
    await asUser(A);
    const others = await db.query(`select 1 from public.syntheses where user_id = '${H}'`);
    expect(others.rows).toHaveLength(0);
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
