import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { ChallengeCorrectionView, ChallengePlay, Invitation } from "@/components/challenge/challenge-play";
import { fill } from "@/i18n/format";
import { getT } from "@/i18n/server";
import { getPublicChallenge } from "@/server/challenges/queries";

/** Aperçu du lien dans WhatsApp : qui défie, sur quoi, avec quel score. */
export async function generateMetadata({ params }: PageProps<"/defi/[challengeId]">): Promise<Metadata> {
  const t = await getT();
  const { challengeId } = await params;
  const challenge = await getPublicChallenge(challengeId);
  if (!challenge) return { title: t.app.name };
  const values = { username: challenge.username, correct: challenge.correct ?? 0, total: challenge.total, subject: challenge.subject };
  const c = t.challenge;
  const title = fill(challenge.classMode ? c.classMetaTitle : challenge.practice ? c.practiceMetaTitle : c.metaTitle, values);
  const description = fill(
    challenge.classMode ? c.classMetaDescription : challenge.practice ? c.practiceMetaDescription : c.metaDescription,
    values,
  );
  return { title, description, openGraph: { title, description, siteName: t.app.name }, robots: { index: false } };
}

/** Page publique du défi : l'ami joue sans compte. */
export default async function ChallengePage({ params }: PageProps<"/defi/[challengeId]">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Challenge params={params} />
      </Suspense>
    </main>
  );
}

async function Challenge({ params }: { params: PageProps<"/defi/[challengeId]">["params"] }) {
  const t = await getT();
  const c = t.challenge;
  const { challengeId } = await params;
  const challenge = await getPublicChallenge(challengeId);
  if (!challenge) {
    return (
      <>
        <p className="text-neutral-600 dark:text-neutral-300">{c.unknown}</p>
        <Link href="/" className="font-medium text-primary dark:text-lavande">
          {t.app.name}
        </Link>
      </>
    );
  }
  const values = { username: challenge.username, correct: challenge.correct ?? 0, total: challenge.total, subject: challenge.subject };
  return (
    <>
      <section className="atumi-cosmos relative flex flex-col items-center gap-2 overflow-hidden rounded-3xl px-5 py-6 text-center text-white shadow-lg shadow-primary/20">
        <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={72} height={72} />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {challenge.classMode || challenge.practice ? c.practiceKicker : c.kicker}
        </p>
        <h1 className="text-2xl font-bold">
          {fill(challenge.classMode ? c.classTitle : challenge.practice ? c.practiceTitle : c.title, values)}
        </h1>
        <p className="text-sm text-lavande">
          {challenge.correction
            ? fill(c.correctionIntro, values)
            : fill(challenge.classMode ? c.classIntro : challenge.practice ? c.practiceIntro : c.intro, values)}
        </p>
      </section>
      {challenge.correction ? (
        <>
          <ChallengeCorrectionView challenge={challenge} correction={challenge.correction} />
          <Invitation />
        </>
      ) : challenge.open ? (
        <ChallengePlay challenge={challenge} />
      ) : (
        <>
          <p role="status" className="rounded-xl bg-primary-soft p-4 text-sm text-nuit dark:bg-primary-strong/25 dark:text-lavande">
            <strong className="block">{c.closed}</strong>
            {fill(challenge.classMode ? c.classClosedBody : challenge.practice ? c.practiceClosedBody : c.closedBody, values)}
          </p>
          <Invitation />
        </>
      )}
    </>
  );
}
