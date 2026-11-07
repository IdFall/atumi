import { describe, expect, it } from "vitest";

import { checkDatabaseUrl, explainConnectionError } from "../src/worker/database-url";

const POOLER = "postgresql://postgres.abc:MotDePasse123@aws-1-eu-west-3.pooler.supabase.com:5432/postgres";

describe("checkDatabaseUrl", () => {
  it("accepte l'adresse Session pooler et ne montre jamais le mot de passe", () => {
    const check = checkDatabaseUrl(POOLER);
    expect(check.problems).toEqual([]);
    expect(check.summary).toBe("postgres.abc@aws-1-eu-west-3.pooler.supabase.com:5432");
    expect(check.summary).not.toContain("MotDePasse123");
  });

  it("signale un texte collé à la place de l'adresse", () => {
    expect(checkDatabaseUrl("le mot de passe de la base").problems[0]).toMatch(/postgresql:\/\//);
  });

  it("signale [YOUR-PASSWORD] laissé tel quel", () => {
    const check = checkDatabaseUrl(POOLER.replace("MotDePasse123", "[YOUR-PASSWORD]"));
    expect(check.problems.join(" ")).toMatch(/YOUR-PASSWORD/);
  });

  it("signale la connexion directe", () => {
    const check = checkDatabaseUrl("postgresql://postgres:secret@db.abc.supabase.co:5432/postgres");
    expect(check.problems.join(" ")).toMatch(/Session pooler/);
  });

  it("signale un hôte qui n'est pas un serveur", () => {
    const check = checkDatabaseUrl("postgresql://postgres:secret@base:5432/postgres");
    expect(check.problems.join(" ")).toMatch(/« base »/);
  });
});

describe("explainConnectionError", () => {
  it("traduit les erreurs courantes", () => {
    expect(explainConnectionError({ code: "ENOTFOUND" })).toMatch(/introuvable/);
    expect(explainConnectionError({ message: "password authentication failed for user" })).toMatch(/Mot de passe/);
    expect(explainConnectionError({ message: "Tenant or user not found" })).toMatch(/postgres\./);
    expect(explainConnectionError(new Error("autre"))).toBeNull();
  });
});
