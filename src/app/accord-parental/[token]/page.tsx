import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";

import { AuthShell } from "@/components/layout/auth-shell";
import { fill } from "@/i18n/format";
import { getT } from "@/i18n/server";
import { createUserClient } from "@/lib/supabase/server";
import { refuseParentalAction } from "@/server/parental/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.parental.title} · ${t.app.name}`, robots: { index: false, follow: false } };
}

/** Page ouverte par le parent depuis l'avis reçu : il peut refuser l'inscription. */
export default async function ParentalNoticePage({ params }: PageProps<"/accord-parental/[token]">) {
  const t = await getT();
  return (
    <AuthShell title={t.parental.title}>
      <Suspense fallback={null}>
        <ParentalContent params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function ParentalContent({ params }: { params: PageProps<"/accord-parental/[token]">["params"] }) {
  const t = await getT();
  const p = t.parental;
  const token = z.uuid().safeParse((await params).token);
  const supabase = await createUserClient();
  const { data } = token.success
    ? await supabase.rpc("parental_notice", { p_token: token.data }).maybeSingle<{ username: string; refused: boolean }>()
    : { data: null };

  if (!data || !token.success) return <p className="text-sm">{p.unknown}</p>;
  if (data.refused) {
    return (
      <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">
        {fill(p.refused, { username: data.username })}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed">
      <p>{fill(p.intro, { username: data.username })}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {p.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p>{p.nothingToDo}</p>
      <form action={refuseParentalAction} className="flex flex-col gap-2 rounded-xl border border-red-200 p-4 dark:border-red-900">
        <input type="hidden" name="token" value={token.data} />
        <p>{p.refuseHint}</p>
        <button type="submit" className="rounded-xl border border-red-300 bg-white px-4 py-3 font-semibold text-red-700 dark:border-red-800 dark:bg-transparent dark:text-red-300">
          {p.refuse}
        </button>
      </form>
    </div>
  );
}
