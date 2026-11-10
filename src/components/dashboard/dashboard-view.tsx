import Link from "next/link";

import { AgendaReminders } from "@/components/agenda/reminders";
import { AccessBanner } from "@/components/courses/access-banner";
import type { Cycle } from "@/config/countries";
import { getT } from "@/i18n/server";
import type { Mission } from "@/lib/mission";
import type { AgendaEvent } from "@/server/agenda/queries";
import type { Access } from "@/server/courses/queries";
import type { DashboardStats, Gauge } from "@/server/dashboard/queries";

import { AiPlanet } from "./ai-planet";
import { AvatarButton } from "./avatar-button";
import { NeoIntro } from "./neo-intro";

/**
 * Accueil connecté : le poste de pilotage de l'élève. « Mes cours » range les
 * cours ; l'accueil dit quoi faire maintenant (prochaine mission), ce qu'il
 * reste sur le forfait (énergie) et où en est l'élève (progression), sous une
 * planète IA à anneaux.
 */

const SATELLITES = [
  { key: "tutor", href: "/professeur", icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" },
  { key: "import", href: "/importer", icon: "M12 16V4M7 9l5-5 5 5M4 20h16" },
  { key: "search", href: "/recherche", icon: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" },
  { key: "agenda", href: "/agenda", icon: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4" },
] as const;

export interface DashboardViewProps {
  userId: string;
  username: string;
  /** Lien signé de la photo de profil ; null sans photo (initiales). */
  avatarUrl: string | null;
  cycle: Cycle;
  access: Access;
  mission: Mission;
  reminders: AgendaEvent[];
  today: string;
  stats: DashboardStats;
  moduleCount: number;
}

/** Affichage de l'accueil, séparé de la lecture des données (aperçus et tests visuels). */
export async function DashboardView({ userId, username, avatarUrl, cycle, access, mission, reminders, today, stats, moduleCount }: DashboardViewProps) {
  const t = await getT();
  const missionText = t.dashboard.missions[mission.kind].replace("{title}", mission.title ?? "");

  return (
    <>
      <AccessBanner access={access} />

      {/* Station : planète IA, salutation, satellites (accès rapides) */}
      <section className="atumi-cosmos relative overflow-hidden rounded-3xl px-5 pb-5 pt-6 text-white shadow-lg shadow-primary/20 md:px-8 md:pb-8">
        <div className="relative z-10 flex items-center gap-4 md:max-w-[60%]">
          <AvatarButton userId={userId} username={username} avatarUrl={avatarUrl} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t.dashboard.station}</p>
            <h1 className="truncate text-2xl font-bold md:text-3xl">
              {t.dashboard.greeting}, {username}
            </h1>
            <p className="text-sm text-lavande">{t.dashboard.slogan}</p>
            <p className="text-xs text-white/60">{t.auth.cycles[cycle]}</p>
          </div>
        </div>
        <AiPlanet className="atumi-float mx-auto -my-2 w-full max-w-[340px] md:absolute md:-right-6 md:top-1/2 md:my-0 md:w-[420px] md:max-w-none md:-translate-y-1/2" />
        <nav className="relative z-10 mt-1 grid grid-cols-4 gap-2 md:mt-8 md:max-w-[55%]">
          {SATELLITES.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="group flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-1 py-3 text-center text-xs font-semibold backdrop-blur-sm hover:border-accent/60 hover:bg-white/10"
            >
              <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary to-electrique shadow-md shadow-accent/30 group-hover:from-accent group-hover:to-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={s.icon} />
                </svg>
              </span>
              {t.dashboard.satellites[s.key]}
            </Link>
          ))}
        </nav>
      </section>

      {/* Prof NEO se présente : ouvert tant qu'aucun cours n'est importé */}
      <NeoIntro open={moduleCount === 0} />

      {/* Demander à ATUMI : mène à la recherche (cours, web, outils) */}
      <form action="/recherche" role="search" className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-white p-1.5 pl-4 shadow-sm focus-within:ring-2 focus-within:ring-primary dark:border-neutral-800 dark:bg-neutral-950">
        <label htmlFor="dashboard-search" className="sr-only">
          {t.search.label}
        </label>
        <span className="size-2 shrink-0 rounded-full bg-accent shadow-[0_0_10px_2px] shadow-accent/60" aria-hidden="true" />
        <input
          id="dashboard-search"
          name="q"
          type="search"
          maxLength={100}
          placeholder={t.dashboard.askPlaceholder}
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none"
        />
        <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong">
          {t.search.submit}
        </button>
      </form>

      {/* Prochaine mission */}
      <section className="atumi-mission flex flex-col gap-3 rounded-2xl p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary dark:text-lavande">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t.dashboard.missionTitle}
          </h2>
          <p className="font-semibold">{missionText}</p>
        </div>
        <Link href={mission.href} className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-electrique px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-primary/30">
          {t.dashboard.missionCta[mission.kind]}
        </Link>
      </section>

      <AgendaReminders events={reminders} today={today} />

      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        {/* Énergie du forfait */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t.dashboard.energyTitle}</h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">{stats.hasAccess ? t.dashboard.energyHint : t.dashboard.noAccess}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            <EnergyGauge label={t.dashboard.energy.messages} gauge={stats.messages} unlimited={t.dashboard.unlimited} notIncluded={t.dashboard.notIncluded} />
            <EnergyGauge label={t.dashboard.energy.imports} gauge={stats.imports} unlimited={t.dashboard.unlimited} notIncluded={t.dashboard.notIncluded} />
            <EnergyGauge label={t.dashboard.energy.research} gauge={stats.research} unlimited={t.dashboard.unlimited} notIncluded={t.dashboard.notIncluded} />
            <EnergyGauge label={t.dashboard.energy.call} gauge={stats.callMinutes} unlimited={t.dashboard.unlimited} notIncluded={t.dashboard.notIncluded} />
          </ul>
        </section>

        {/* Progression */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t.dashboard.progressTitle}</h2>
          <ul className="grid grid-cols-3 gap-3 md:grid-cols-1">
            <Stat label={t.dashboard.progress.modules} value={String(moduleCount)} href="/cours" />
            <Stat label={t.dashboard.progress.quizzes} value={String(stats.quizzesDone)} />
            <Stat
              label={t.dashboard.progress.average}
              value={stats.averageScore === null ? t.dashboard.noQuizYet : `${Math.round(stats.averageScore * 100)} %`}
            />
          </ul>
        </section>
      </div>
    </>
  );
}

/** Jauge circulaire : ce qui reste du forfait (pleine = tout reste). */
function EnergyGauge({ label, gauge, unlimited, notIncluded }: { label: string; gauge: Gauge; unlimited: string; notIncluded: string }) {
  const radius = 20;
  const length = 2 * Math.PI * radius;
  const ratio = gauge.limit === null ? 1 : gauge.limit === 0 ? 0 : (gauge.left ?? 0) / gauge.limit;
  const low = gauge.limit !== null && gauge.limit > 0 && ratio < 0.2;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <svg viewBox="0 0 48 48" className="size-12 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="5" className="stroke-primary-soft dark:stroke-neutral-800" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - ratio)}
          className={low ? "stroke-orange-500" : gauge.limit === null ? "stroke-accent" : "stroke-primary"}
        />
      </svg>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">
          {gauge.limit === null ? (
            unlimited
          ) : gauge.limit === 0 ? (
            <span className="text-sm font-semibold text-neutral-500">{notIncluded}</span>
          ) : (
            <>
              {gauge.left}
              <span className="text-sm font-medium text-neutral-500"> / {gauge.limit}</span>
            </>
          )}
        </p>
        <p className="text-xs text-neutral-600 dark:text-neutral-300">{label}</p>
      </div>
    </li>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="text-2xl font-bold text-primary-strong dark:text-lavande">{value}</span>
      <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>
    </>
  );
  const className = "flex flex-col gap-0.5 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${className} hover:border-primary/40`}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}
