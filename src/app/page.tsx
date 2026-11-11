import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { getT } from "@/i18n/server";

/**
 * Accueil public, version claire : fond lumineux avec des halos de couleur
 * (violet, bleu électrique, cyan), aperçu du produit, chiffres clés,
 * fonctionnalités, étapes, citation et appel à l'action. Animations lentes,
 * coupées quand le système demande moins de mouvement.
 */
export default async function Home() {
  const t = await getT();
  const h = t.home;
  return (
    <main className="atumi-clair flex flex-1 flex-col bg-[#F7F9FD] text-nuit [color-scheme:light]">
      {/* Bandeau */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="atumi-orb absolute -left-32 -top-24 h-[28rem] w-[28rem] rounded-full bg-lavande/50 blur-3xl" />
          <div className="atumi-orb atumi-orb-slow absolute -right-24 top-10 h-[26rem] w-[26rem] rounded-full bg-accent/25 blur-3xl" />
          <div className="atumi-orb absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-electrique/20 blur-3xl" />
          <div className="atumi-grid-light absolute inset-0" />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-5 sm:px-6 lg:pb-24">
          <nav className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-lg font-extrabold tracking-[0.2em] text-primary-strong dark:text-lavande">
              <span aria-hidden="true" className="atumi-logo-dot h-7 w-7 rounded-full" />
              {t.app.name}
            </p>
            <div className="flex items-center gap-3">
              <Link href="/a-propos" className="hidden text-sm font-medium text-primary-strong underline-offset-4 hover:underline sm:inline dark:text-lavande">
                {h.aboutLink}
              </Link>
              <LocaleSwitcher />
            </div>
          </nav>

          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div className="atumi-fade-up flex flex-col gap-5">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold text-primary-strong shadow-sm backdrop-blur dark:bg-white/10 dark:text-lavande">
                <span className="relative flex h-2 w-2">
                  <span className="atumi-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {h.badge}
              </p>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-nuit via-primary to-electrique bg-clip-text text-transparent dark:from-white dark:via-lavande dark:to-accent">{h.slogan}</span>
              </h1>
              <p className="max-w-xl text-base text-neutral-600 sm:text-lg dark:text-neutral-300">{h.heroIntro}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/connexion"
                  className="rounded-xl border-2 border-primary/30 bg-white px-6 py-3 text-center font-semibold text-primary-strong shadow-sm transition hover:border-primary dark:bg-transparent dark:text-lavande"
                >
                  {h.signIn}
                </Link>
                <Link
                  href="/inscription"
                  className="rounded-xl bg-gradient-to-r from-primary to-electrique px-6 py-3 text-center font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
                >
                  {h.signUp}
                </Link>
              </div>
              <p className="text-sm text-neutral-500">{h.trial}</p>
              <Link href="/a-propos" className="text-sm font-medium text-primary-strong underline-offset-4 hover:underline sm:hidden dark:text-lavande">
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
      <section className="mx-auto -mt-6 w-full max-w-6xl px-4 sm:px-6">
        <dl className="grid grid-cols-2 gap-y-2 rounded-2xl border border-neutral-200/80 bg-white/90 px-2 py-5 shadow-sm backdrop-blur lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900">
          {h.stats.map((s) => (
            <div key={s.value} className="flex flex-col gap-0.5 px-2 py-2 text-center">
              <dt className="order-2 text-xs text-neutral-500 sm:text-sm">{s.label}</dt>
              <dd className="order-1 bg-gradient-to-r from-primary to-electrique bg-clip-text text-base font-bold text-transparent sm:text-lg">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Fonctionnalités */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6">
        <header className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{h.featuresTitle}</h2>
          <p className="text-neutral-600 dark:text-neutral-300">{h.featuresIntro}</p>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {h.features.map((f, i) => (
            <li
              key={f.title}
              className="group flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl ${FEATURE_SOFT[i % FEATURE_SOFT.length]}`}>
                {FEATURE_ICONS[i % FEATURE_ICONS.length]}
              </span>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Étapes */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{h.stepsTitle}</h2>
        <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <span aria-hidden="true" className="absolute left-8 right-8 top-[2.1rem] hidden h-0.5 bg-gradient-to-r from-primary via-electrique to-accent opacity-40 lg:block" />
          {h.steps.map((step, index) => (
            <li key={step.title} className="relative flex flex-col gap-2 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-electrique text-sm font-bold text-white shadow-md shadow-primary/30">{index + 1}</span>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Citation et appel final */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="relative isolate mx-auto flex w-full max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[#6a5ce6] to-electrique px-6 py-14 text-center text-white shadow-xl shadow-primary/20">
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <div className="atumi-orb absolute -left-10 top-0 h-56 w-56 rounded-full bg-accent/40 blur-3xl" />
            <div className="atumi-orb atumi-orb-slow absolute -bottom-10 right-0 h-56 w-56 rounded-full bg-lavande/50 blur-3xl" />
          </div>
          <figure className="flex max-w-3xl flex-col gap-2">
            <blockquote className="text-2xl font-semibold italic leading-snug sm:text-3xl">
              {h.quoteOpen}
              {h.quote}
              {h.quoteClose}
            </blockquote>
            <figcaption className="text-sm text-white/85">{h.quoteNote}</figcaption>
          </figure>
          <p className="text-lg font-semibold">{h.ctaTitle}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/connexion" className="rounded-xl border border-white/50 bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20">
              {h.signIn}
            </Link>
            <Link href="/inscription" className="rounded-xl bg-white px-6 py-3 font-semibold text-primary-strong shadow-lg transition hover:bg-primary-soft">
              {h.signUp}
            </Link>
          </div>
          <p className="text-sm text-white/80">{h.trial}</p>
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
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/25 via-electrique/15 to-accent/25 blur-2xl" />
      <div className="atumi-float relative overflow-hidden rounded-2xl border border-white bg-white text-neutral-900 shadow-2xl shadow-primary/20">
        <div className="flex items-center justify-between bg-gradient-to-r from-nuit to-[#1b2f63] px-4 py-2 text-xs font-semibold text-white">
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
          <div className="board-grid rounded-xl border border-nuit/10 bg-[#F3F7FC] px-4 py-3 text-sm [&_h2]:mt-0 [&_h2]:text-base">{children}</div>
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

const FEATURE_SOFT = [
  "bg-primary-soft text-primary-strong",
  "bg-[#E6ECFF] text-electrique",
  "bg-[#E0F7F9] text-accent-text",
  "bg-[#FDEBDD] text-orange-700",
  "bg-[#EFE9FF] text-primary",
  "bg-[#E6F6EC] text-green-700",
];

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
