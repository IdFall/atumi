import "server-only";

import { z } from "zod";

import { defaultCountry, getCountry, type TutorLanguage } from "@/config/countries";
import type { MessageCitation } from "@/lib/further";
import { isOutsideCitation } from "@/lib/outside-course";
import { createUserClient } from "@/lib/supabase/server";
import type { TutorMode } from "@/server/ai/prompts";

export interface TutorSettings {
  language: TutorLanguage;
  languages: readonly TutorLanguage[];
  /** null : sans limite ; sinon messages restants sur la période. */
  messagesLeft: number | null;
  messageLimit: number | null;
  hasAccess: boolean;
}

export async function getTutorSettings(): Promise<TutorSettings> {
  const supabase = await createUserClient();
  const [{ data: claims }, { data: usage }] = await Promise.all([supabase.auth.getClaims(), supabase.rpc("plan_usage")]);
  const { data: profile } = await supabase
    .from("profiles")
    .select("country_code, tutor_language")
    .eq("id", claims?.claims?.sub ?? "")
    .single();
  const languages = (getCountry(profile?.country_code ?? "") ?? defaultCountry()).tutorLanguages;
  const row = (usage as { tutor_messages_used: number; tutor_message_limit: number | null }[] | null)?.[0];
  return {
    language: languages.includes(profile?.tutor_language) ? profile?.tutor_language : "fr",
    languages,
    hasAccess: Boolean(row),
    messageLimit: row?.tutor_message_limit ?? null,
    messagesLeft: row && row.tutor_message_limit !== null ? Math.max(0, row.tutor_message_limit - row.tutor_messages_used) : null,
  };
}

export interface TutorMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Passages du cours, ou pages web pour un message « Pour aller plus loin ». */
  citations: MessageCitation[];
}

export interface Conversation {
  id: string;
  mode: TutorMode;
  moduleId: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  messages: TutorMessage[];
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  if (!z.uuid().safeParse(conversationId).success) return null;
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("tutor_conversations")
    .select("id, mode, module_id, chapter_id, chapters(title), tutor_messages(id, role, content, citations)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    mode: data.mode,
    moduleId: data.module_id,
    chapterId: data.chapter_id,
    chapterTitle: (data.chapters as unknown as { title: string } | null)?.title ?? null,
    messages: [...(data.tutor_messages ?? [])].sort((a, b) => a.id - b.id),
  };
}

export interface ConversationSummary {
  id: string;
  mode: TutorMode;
  title: string;
}

export async function listConversations(limit = 5): Promise<ConversationSummary[]> {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("tutor_conversations")
    .select("id, mode, created_at, tutor_messages(content, role, id, citations)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => {
    const messages = [...(c.tutor_messages ?? [])].sort((a, b) => a.id - b.id);
    const first = messages.find((m) => m.role === "user");
    // Notion absente du cours, sans message de l'élève : sa question est gardée dans les citations.
    const outside = messages.flatMap((m) => (Array.isArray(m.citations) ? m.citations : [])).find(isOutsideCitation);
    return { id: c.id, mode: c.mode, title: (first?.content ?? outside?.question ?? "").slice(0, 80) };
  });
}

/** Chapitre choisi pour une nouvelle conversation (vérifié par RLS). */
export async function getChapterScope(moduleId: string, chapterId: string) {
  if (!z.uuid().safeParse(moduleId).success || !z.uuid().safeParse(chapterId).success) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.from("chapters").select("id, title, module_id").eq("id", chapterId).eq("module_id", moduleId).maybeSingle();
  return data ? { moduleId: data.module_id as string, chapterId: data.id as string, title: data.title as string } : null;
}
