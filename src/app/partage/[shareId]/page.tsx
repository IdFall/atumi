import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { Invitation } from "@/components/challenge/challenge-play";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { getT } from "@/i18n/server";
import { shareExcerpt } from "@/lib/share-text";
import { getSharedText } from "@/server/sharing/queries";

/** Aperçu du lien dans WhatsApp : titre et début du texte. */
export async function generateMetadata({ params }: PageProps<"/partage/[shareId]">): Promise<Metadata> {
  const t = await getT();
  const { shareId } = await params;
  const shared = await getSharedText(shareId);
  if (!shared) return { title: t.app.name };
  const description = shareExcerpt(shared.contentMd.replace(/[#*$`>]/g, "").replace(/\s+/g, " "), 160);
  return {
    title: `${shared.title} · ${t.app.name}`,
    description,
    openGraph: { title: shared.title, description, siteName: t.app.name },
    robots: { index: false },
  };
}

/** Texte complet partagé par un élève (réponse du Prof, recherche, synthèse), lisible sans compte. */
export default async function SharedTextPage({ params }: PageProps<"/partage/[shareId]">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Shared params={params} />
      </Suspense>
    </main>
  );
}

async function Shared({ params }: { params: PageProps<"/partage/[shareId]">["params"] }) {
  const t = await getT();
  const { shareId } = await params;
  const shared = await getSharedText(shareId);
  return (
    <>
      <header className="flex items-center gap-3">
        <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={48} height={48} />
        <div className="flex min-w-0 flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-text dark:text-accent">{t.sharedPage.kicker}</p>
          {shared ? <h1 className="text-xl font-bold">{shared.title}</h1> : null}
        </div>
      </header>
      {shared ? (
        <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <SynthesisContent markdown={shared.contentMd} />
        </article>
      ) : (
        <p className="text-neutral-600 dark:text-neutral-300">{t.sharedPage.expired}</p>
      )}
      <Invitation />
      <Link href="/" className="text-center text-sm font-medium text-primary dark:text-lavande">
        {t.app.name}
      </Link>
    </>
  );
}
