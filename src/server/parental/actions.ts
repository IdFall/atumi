"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createUserClient } from "@/lib/supabase/server";

/** Le parent refuse l'inscription de son enfant (lien personnel, sans connexion). */
export async function refuseParentalAction(formData: FormData): Promise<void> {
  const token = z.uuid().safeParse(formData.get("token"));
  if (!token.success) redirect("/");
  const supabase = await createUserClient();
  await supabase.rpc("refuse_parental_notice", { p_token: token.data });
  redirect(`/accord-parental/${token.data}`);
}
