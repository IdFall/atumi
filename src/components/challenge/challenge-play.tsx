"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import { fill } from "@/i18n/format";
import { useT } from "@/i18n/client";
import { challengeOutcome, PLAYER_NAME_MAX } from "@/lib/challenge";
import { playChallengeAction, type PlayState } from "@/server/challenges/actions";
import type { PublicChallenge } from "@/server/challenges/queries";

/** Partie de l'ami : les mêmes questions, puis le score comparé et l'invitation. */
export function ChallengePlay({ challenge }: { challenge: PublicChallenge }) {
  const t = useT();
  const c = t.challenge;
  const [state, action, pending] = useActionState<PlayState, FormData>(playChallengeAction, {});
  const names = { username: challenge.username };

  if (state.result) {
    const { correct, total, answers } = state.result;
    const outcome = challengeOutcome(correct, challenge.correct);
    return (
      <div className="flex flex-col gap-5">
        <section
          role="status"
          className={`flex flex-col gap-1 rounded-2xl p-5 text-center text-white shadow-lg ${
            outcome === "lose" ? "bg-gradient-to-br from-nuit to-primary-strong" : "bg-gradient-to-br from-primary to-electrique"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{c.resultTitle}</p>
          <p className="text-4xl font-bold">
            {correct}/{total}
          </p>
          <p className="text-lg font-semibold">{fill(c[outcome], names)}</p>
          <p className="text-sm text-lavande">{fill(c.versus, { ...names, mine: correct, theirs: challenge.correct, total })}</p>
        </section>

        <Invitation />

        <ol className="flex flex-col gap-3">
          {challenge.questions.map((q, index) => {
            const a = answers[q.id];
            if (!a) return null;
            return (
              <li
                key={q.id}
                className={`flex flex-col gap-1.5 rounded-xl border p-4 text-sm leading-relaxed ${
                  a.isCorrect
                    ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                    : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                }`}
              >
                <strong className={a.isCorrect ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}>
                  {a.isCorrect ? "✓" : "✗"} {t.quiz.question} {index + 1} · {a.isCorrect ? t.quiz.right : t.quiz.wrong}
                </strong>
                <span>{q.prompt}</span>
                <span className="text-neutral-700 dark:text-neutral-300">
                  {a.isCorrect ? q.choices[a.expected] : `${t.quiz.yourAnswer} : ${q.choices[a.response]} · ${t.quiz.expected} : ${q.choices[a.expected]}`}
                </span>
                {a.explanation ? <span className="text-neutral-700 dark:text-neutral-300">{a.explanation}</span> : null}
              </li>
            );
          })}
        </ol>

        <Link href="/inscription" className="rounded-xl bg-gradient-to-r from-primary to-electrique px-4 py-3 text-center font-semibold text-white shadow-md shadow-primary/30">
          {c.cta}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="challengeId" value={challenge.id} />
      <div className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <label htmlFor="player-name" className="text-sm font-semibold">
          {c.playerName}
        </label>
        <input
          id="player-name"
          name="playerName"
          required
          maxLength={PLAYER_NAME_MAX}
          autoComplete="given-name"
          placeholder={c.playerNamePlaceholder}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-950"
        />
        <p className="text-xs text-neutral-600 dark:text-neutral-300">{fill(c.nameNotice, names)}</p>
      </div>
      {challenge.questions.map((q, index) => (
        <fieldset key={q.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <legend className="sr-only">
            {t.quiz.question} {index + 1}
          </legend>
          <p className="text-sm font-semibold text-primary-strong dark:text-lavande">
            {t.quiz.question} {index + 1} / {challenge.questions.length}
          </p>
          <p className="font-medium">{q.prompt}</p>
          <div className="flex flex-col gap-2">
            {q.choices.map((choice, i) => (
              <label
                key={i}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-neutral-300 px-3 py-2 has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft dark:border-neutral-700 dark:has-[:checked]:bg-primary-strong/25"
              >
                <input type="radio" name={`q-${q.id}`} value={i} required className="size-4 accent-primary" />
                <span>{choice}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error === "closed" ? fill(c.closedBody, names) : c[state.error]}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">
        {c.play}
      </button>
    </form>
  );
}

export function Invitation() {
  const t = useT();
  const c = t.challenge;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3">
        <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={48} height={48} className="shrink-0" />
        <h2 className="text-lg font-bold">{c.ctaTitle}</h2>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-200">{c.ctaBody}</p>
      <Link href="/inscription" className="rounded-xl bg-gradient-to-r from-primary to-electrique px-4 py-3 text-center font-semibold text-white shadow-md shadow-primary/30">
        {c.cta}
      </Link>
      <Link href="/connexion" className="text-center text-sm font-medium text-primary dark:text-lavande">
        {c.signIn}
      </Link>
    </section>
  );
}
