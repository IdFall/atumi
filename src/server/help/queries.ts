import "server-only";

import { getCountry } from "@/config/countries";
import { helpArticles, type HelpArticle } from "@/i18n/help-articles";
import { createUserClient } from "@/lib/supabase/server";

export interface HelpQuestion {
  id: number;
  question: string;
  answer: string | null;
  helpful: boolean | null;
}

/** Nombre de questions récentes affichées. */
const RECENT_SIZE = 5;

/** Articles d'aide adaptés au pays de l'utilisateur (moyens de paiement). */
export function articlesForCountry(countryCode: string): HelpArticle[] {
  return helpArticles({ paymentMethods: getCountry(countryCode)?.paymentMethods ?? [] });
}

/** Dernières questions de l'utilisateur connecté, de la plus ancienne à la plus récente. */
export async function listRecentHelpQuestions(): Promise<HelpQuestion[]> {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("help_questions")
    .select("id, question, answer, helpful")
    .order("created_at", { ascending: false })
    .limit(RECENT_SIZE);
  return (data ?? []).reverse();
}
