import type { Metadata } from "next";
import Image from "next/image";

import { RetryButton } from "@/components/offline/retry-button";
import { SavedPages } from "@/components/offline/saved-pages";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.offline.title} · ${t.app.name}`, robots: { index: false } };
}

/**
 * Page « Pas de connexion », gardée par le service worker dès l'installation
 * (`public/sw.js`) et montrée quand une page demandée n'est pas sur l'appareil.
 * Aucune donnée d'élève côté serveur : la liste vient des copies de l'appareil.
 */
export default async function OfflinePage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex items-center gap-3">
        <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={48} height={48} />
        <h1 className="text-2xl font-bold">{t.offline.title}</h1>
      </header>
      <p className="text-neutral-700 dark:text-neutral-200">{t.offline.intro}</p>
      <RetryButton />
      <p className="rounded-xl bg-primary-soft/40 p-4 text-sm text-neutral-700 dark:bg-white/5 dark:text-neutral-200">{t.offline.works}</p>
      <h2 className="text-lg font-semibold">{t.offline.savedTitle}</h2>
      <SavedPages />
    </main>
  );
}
