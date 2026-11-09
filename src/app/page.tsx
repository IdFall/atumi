import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { getT } from "@/i18n/server";

/**
 * Accueil public : bandeau plein écran animé (sphère de particules, halos),
 * aperçu du produit (tableau du Prof ATUM, quiz, agenda), chiffres clés,
 * fonctionnalités, étapes, citation et appel à l'action. Les animations sont
 * lentes et coupées quand le système demande moins de mouvement.
 */
export default async function Home() {
  const t = await getT();
  const h = t.home;
  return (
    <main className="flex flex-1 flex-col">
      {/* Bandeau */}
      <section className="relative isolate overflow-hidden bg-nuit text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div
            className="atumi-sphere absolute -right-40 top-10 h-[34rem] w-[34rem] bg-contain bg-center bg-no-repeat opacity-50 sm:-right-24 sm:opacity-70 lg:right-[-6rem] lg:top-0 lg:h-[46rem] lg:w-[46rem]"
            style={{ backgroundImage: "url(/sphere-atumi.webp)" }}
          />
          <div className="atumi-orb absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
          <div className="atumi-orb atumi-orb-slow absolute bottom-0 right-1/3 h-64 w-64 rounded-full bg-electrique/30 blur-3xl" />
          <div className="atumi-orb absolute -top-10 right-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
          <div className="atumi-grid absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-nuit/20 via-transparent to-nuit" />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-5 sm:px-6 lg:pb-24">
          <nav className="flex items-center justify-between gap-3">
            <p className="text-lg font-bold tracking-[0.2em] text-white">{t.app.name}</p>
            <div className="flex items-center gap-3">
              <Link href="/a-propos" className="hidden text-sm font-medium text-lavande underline-offset-4 hover:underline sm:inline">
                {h.aboutLink}
              </Link>
              <LocaleSwitcher tone="dark" />
            </div>
          </nav>

          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div className="atumi-fade-up flex flex-col gap-5">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-lavande backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="atumi-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {h.badge}
              </p>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-white via-lavande to-accent bg-clip-text text-transparent">{h.slogan}</span>
              </h1>
              <p className="max-w-xl text-base text-white/80 sm:text-lg">{h.heroIntro}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/connexion"
                  className="rounded-xl border border-white/30 bg-white/5 px-6 py-3 text-center font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  {h.signIn}
                </Link>
                <Link
                  href="/inscription"
                  className="rounded-xl bg-gradient-to-r from-primary to-electrique px-6 py-3 text-center font-semibold text-white shadow-lg shadow-primary/30 transition hover:brightness-110"
                >
                  {h.signUp}
                </Link>
              </div>
              <p className="text-sm text-white/60">{h.trial}</p>
              <Link href="/a-propos" className="text-sm font-medium text-lavande underline-offset-4 hover:underline sm:hidden">
                {h.aboutLink}
              </Link>
            </div>

            <ProductPreview boardTitle={t.board.title} preview={h.preview}>
              <SynthesisContent markdown={h.preview.board} />
            </ProductPreview>
          </div>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-y-2 px-4 py-6 sm:px-6 lg:grid-cols-4">
          {h.stats.map((s) => (
            <div key={s.value} className="flex flex-col gap-0.5 px-2 py-2 text-center">
              <dt className="order-2 text-xs text-neutral-500 sm:text-sm">{s.label}</dt>
              <dd className="order-1 text-base font-bold text-primary-strong sm:text-lg dark:text-lavande">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Fonctionnalités */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
        <header className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{h.featuresTitle}</h2>
          <p className="text-neutral-600 dark:text-neutral-300">{h.featuresIntro}</p>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {h.features.map((f, i) => (
            <li
              key={f.title}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span
                aria-hidden="true"
                className={`absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40 ${FEATURE_GLOW[i % FEATURE_GLOW.length]}`}
              />
              <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${FEATURE_BG[i % FEATURE_BG.length]}`}>
                {FEATURE_ICONS[i % FEATURE_ICONS.length]}
              </span>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Étapes */}
      <section className="bg-primary-soft/60 dark:bg-neutral-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{h.stepsTitle}</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {h.steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-950">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-nuit text-sm font-bold text-white dark:bg-primary">{index + 1}</span>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Citation et appel final */}
      <section className="relative isolate overflow-hidden bg-nuit text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="atumi-orb absolute left-1/4 top-0 h-64 w-64 rounded-full bg-primary/40 blur-3xl" />
          <div className="atumi-orb atumi-orb-slow absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
          <figure className="flex flex-col gap-2">
            <blockquote className="text-2xl font-semibold italic leading-snug text-white sm:text-3xl">
              {h.quoteOpen}
              {h.quote}
              {h.quoteClose}
            </blockquote>
            <figcaption className="text-sm text-lavande">{h.quoteNote}</figcaption>
          </figure>
          <p className="text-lg font-semibold">{h.ctaTitle}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/connexion" className="rounded-xl border border-white/30 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/15">
              {h.signIn}
            </Link>
            <Link
              href="/inscription"
              className="rounded-xl bg-gradient-to-r from-primary to-electrique px-6 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition hover:brightness-110"
            >
              {h.signUp}
            </Link>
          </div>
          <p className="text-sm text-white/60">{h.trial}</p>
        </div>
      </section>
    </main>
  );
}

type PreviewLabels = { question: string; score: string; scoreLabel: string; due: string };

/** Aperçu du produit : un vrai rendu du tableau, une note de quiz, un rappel d'agenda. */
function ProductPreview({ boardTitle, preview, children }: { boardTitle: string; preview: PreviewLabels; children: ReactNode }) {
  return (
    <div className="atumi-fade-up atumi-delay relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="atumi-float relative overflow-hidden rounded-2xl border border-white/15 bg-[#F3F7FC] text-neutral-900 shadow-2xl shadow-primary/30">
        <div className="flex items-center justify-between bg-nuit/95 px-4 py-2 text-xs font-semibold text-white">
          <span className="flex items-center gap-2">
            <Image src="/prof-atumi.svg" alt="" width={20} height={20} />
            {boardTitle}
          </span>
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-white/30" />
            <span className="h-2 w-2 rounded-full bg-white/30" />
            <span className="h-2 w-2 rounded-full bg-accent" />
          </span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-white">{preview.question}</p>
          <div className="board-grid rounded-xl border border-nuit/10 bg-white/70 px-4 py-3 text-sm [&_h2]:mt-0 [&_h2]:text-base">{children}</div>
        </div>
      </div>
      <div className="atumi-float-alt absolute -bottom-7 -left-2 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-900 shadow-xl sm:-left-8">
        <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 font-bold text-green-700">
          ✓
        </span>
        <span className="flex flex-col">
          <span className="text-[11px] text-neutral-500">{preview.scoreLabel}</span>
          <span className="text-sm font-semibold">{preview.score}</span>
        </span>
      </div>
      <div className="atumi-float-alt absolute -right-1 -top-5 hidden items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-xl sm:flex">
        <span aria-hidden="true">📅</span>
        {preview.due}
      </div>
    </div>
  );
}

const FEATURE_BG = ["bg-primary", "bg-nuit", "bg-electrique", "bg-accent-text", "bg-primary-strong", "bg-electrique"];
const FEATURE_GLOW = ["bg-primary", "bg-electrique", "bg-electrique", "bg-accent", "bg-lavande", "bg-primary"];

function icon(content: ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {content}
    </svg>
  );
}

const FEATURE_ICONS = [
  icon(<path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4" />),
  icon(
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20l4-4 4 4M7 9h4M7 12h7" />
    </>,
  ),
  icon(<path d="M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" />),
  icon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>,
  ),
  icon(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>,
  ),
  icon(
    <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" />,
  ),
];
