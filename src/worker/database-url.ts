/**
 * Diagnostic de DATABASE_URL pour les journaux de l'hébergeur.
 * Ne révèle jamais le mot de passe : seulement l'hôte, le port, l'utilisateur
 * et des indications en français sur les erreurs courantes.
 */

export interface DatabaseUrlCheck {
  /** Résumé sans secret, par exemple « postgres.abc@aws-1-eu-west-3.pooler.supabase.com:5432 ». */
  summary: string;
  problems: string[];
}

export function checkDatabaseUrl(raw: string): DatabaseUrlCheck {
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      summary: "(adresse illisible)",
      problems: [
        "DATABASE_URL n'est pas une adresse : elle doit commencer par postgresql:// (copiez-la depuis Supabase → Connect → Session pooler).",
      ],
    };
  }

  const problems: string[] = [];
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const summary = `${user || "(sans utilisateur)"}@${url.hostname || "(sans hôte)"}:${url.port || "(port par défaut)"}`;

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    problems.push("DATABASE_URL doit commencer par postgresql://.");
  }
  if (!password) {
    problems.push("Le mot de passe de la base manque dans DATABASE_URL.");
  } else if (/YOUR-PASSWORD|\[|\]/i.test(password)) {
    problems.push("Remplacez [YOUR-PASSWORD], crochets compris, par le mot de passe de la base.");
  }
  if (url.hostname.startsWith("db.") && url.hostname.endsWith(".supabase.co")) {
    problems.push("C'est la connexion directe, injoignable depuis l'hébergeur : prenez l'adresse « Session pooler ».");
  } else if (url.hostname.endsWith("pooler.supabase.com")) {
    if (!user.startsWith("postgres.")) {
      problems.push("Avec le pooler, l'utilisateur doit être postgres.<identifiant du projet>.");
    }
  } else if (!url.hostname.includes(".")) {
    problems.push(`L'hôte « ${url.hostname} » n'est pas une adresse de serveur : DATABASE_URL a sans doute été mal collée.`);
  }
  return { summary, problems };
}

/** Traduit les erreurs de connexion courantes en une consigne en français. */
export function explainConnectionError(error: unknown): string | null {
  const err = error as { code?: string; message?: string } | null;
  const message = err?.message ?? "";
  if (err?.code === "ENOTFOUND") return "Serveur introuvable : l'hôte de DATABASE_URL est faux.";
  if (err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT" || /timeout/i.test(message)) {
    return "Le serveur ne répond pas : vérifiez l'hôte et le port (5432) de DATABASE_URL.";
  }
  if (/password authentication failed/i.test(message)) {
    return "Mot de passe refusé : réinitialisez-le dans Supabase et mettez le nouveau dans DATABASE_URL.";
  }
  if (/tenant or user not found/i.test(message)) {
    return "Utilisateur inconnu du pooler : il doit être exactement postgres.<identifiant du projet>.";
  }
  return null;
}
