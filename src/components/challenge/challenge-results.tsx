import { fill } from "@/i18n/format";
import { DATE_LOCALES } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { closeChallengeAction, publishCorrectionAction } from "@/server/challenges/actions";
import type { MyChallenge } from "@/server/challenges/queries";

import { ChallengeButton } from "./challenge-button";
import { ShareCorrectionLink } from "./share-correction-link";

/**
 * Sous la correction du quiz : le défi de l'élève (ouvert ou terminé), les
 * prénoms et scores de ses amis, et le bouton pour l'arrêter ou le relancer.
 */
export async function ChallengeResults({
  quizId,
  challenge,
  myCorrect,
}: {
  quizId: string;
  challenge: MyChallenge | null;
  myCorrect: number;
}) {
  const t = await getT();
  const c = t.challenge;
  const locale = await getLocale();
  if (!challenge) return <ChallengeButton quizId={quizId} />;

  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(DATE_LOCALES[locale], { day: "numeric", month: "long" });
  const date = dateOf(challenge.expiresAt);
  const classMode = challenge.classMode;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold">{classMode ? c.classResultsTitle : c.resultsTitle}</h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-300">
          {challenge.correctionPublishedAt
            ? fill(c.published, { date: dateOf(challenge.correctionPublishedAt) })
            : challenge.open
              ? fill(c.openUntil, { date })
              : c.ended}
        </p>
        {classMode ? (
          <p className="text-xs text-neutral-600 dark:text-neutral-300">{fill(c.classCount, { n: challenge.plays.length, max: challenge.playLimit })}</p>
        ) : null}
      </div>
      {challenge.plays.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{classMode ? c.classNoPlays : c.noPlays}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {challenge.plays.map((play, i) => (
            <li key={`${play.createdAt}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate font-medium">{play.playerName}</span>
              <span className="flex shrink-0 items-center gap-2">
                {classMode ? null : play.correct > myCorrect ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200">{c.beatYou}</span>
                ) : play.correct === myCorrect ? (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-strong dark:bg-primary-strong/25 dark:text-lavande">{c.tie}</span>
                ) : null}
                <strong>
                  {play.correct}/{play.total}
                </strong>
              </span>
            </li>
          ))}
        </ul>
      )}
      {challenge.correctionPublishedAt ? (
        <ShareCorrectionLink challengeId={challenge.id} subject={challenge.subject} />
      ) : (
        <ChallengeButton quizId={quizId} label={challenge.open ? "shareAgain" : "relaunch"} classMode={classMode} />
      )}
      {classMode && !challenge.correctionPublishedAt ? (
        <form action={publishCorrectionAction} className="flex flex-col gap-1">
          <input type="hidden" name="challengeId" value={challenge.id} />
          <input type="hidden" name="quizId" value={quizId} />
          <button type="submit" className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
            {c.publish}
          </button>
          <p className="text-center text-xs text-neutral-600 dark:text-neutral-300">{c.publishHint}</p>
        </form>
      ) : null}
      {challenge.open ? (
        <form action={closeChallengeAction}>
          <input type="hidden" name="challengeId" value={challenge.id} />
          <input type="hidden" name="quizId" value={quizId} />
          <button type="submit" className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-red-700 dark:border-neutral-700 dark:text-red-400">
            {c.stop}
          </button>
        </form>
      ) : null}
    </section>
  );
}
