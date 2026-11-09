"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

/**
 * Effacer ses conversations avec le professeur (messages compris). Les messages
 * effacés restent comptés dans le forfait (`quota_consumptions`).
 */
export async function deleteConversationsAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const all = formData.get("all") === "1";
  const id = z.uuid().safeParse(formData.get("id"));
  const supabase = await createUserClient();

  if (all) {
    await supabase.from("tutor_conversations").delete().eq("user_id", userId);
  } else if (id.success) {
    await supabase.from("tutor_conversations").delete().eq("id", id.data);
  }

  revalidatePath("/professeur", "layout");
  if (formData.get("redirect") === "1") redirect("/professeur");
}
