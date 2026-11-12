import { z } from "zod";

/** Variables publiques, lisibles côté navigateur. */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/** Variables serveur uniquement : ne jamais les préfixer par NEXT_PUBLIC_. */
const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ATUMI_AI_MODEL: z.string().min(1).default("claude-opus-5-5"),
  ATUMI_AI_MODEL_LIGHT: z.string().min(1).default("claude-opus-5-5"),
  /** Appels voix avec le Prof NEO (Gemini Live). Sans clé, les appels ne sont pas proposés. */
  GEMINI_API_KEY: z.string().min(1).optional(),
  ATUMI_VOICE_MODEL: z.string().min(1).default("gemini-3.8-live"),
  /**
   * « true » : appels ouverts à tous les abonnés. Sinon (défaut), réservés aux
   * comptes de l'équipe : à n'ouvrir qu'une fois la facturation Google activée,
   * la formule gratuite laissant Google se servir des conversations.
   */
  ATUMI_VOICE_OPEN: z.enum(["true", "false"]).default("false"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function publicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() ne doit jamais être appelé côté navigateur.");
  }
  cached ??= serverSchema.parse(process.env);
  return cached;
}
