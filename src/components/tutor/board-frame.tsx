"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useT } from "@/i18n/client";

/**
 * Cadre du tableau d'explication du Prof NEO : bandeau « Tableau », surface
 * quadrillée, et bouton pour l'afficher en plein écran (fenêtre par-dessus la
 * page, qui marche aussi sur iPhone, où le plein écran du navigateur n'existe pas).
 */
export function BoardFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [expanded]);

  return (
    <section
      aria-label={t.board.title}
      className={
        expanded
          ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#F3F7FC] dark:bg-neutral-950"
          : "flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-nuit/15 bg-[#F3F7FC] shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      }
    >
      <header className="flex items-center justify-between gap-2 bg-nuit px-4 py-2 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="4" width="18" height="12" rx="1.5" />
            <path d="M8 20l4-4 4 4M7 9h6M7 12h9" />
          </svg>
          {t.board.title}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-lavande hover:bg-white/10"
        >
          {expanded ? t.board.close : t.board.expand}
        </button>
      </header>
      <div
        className={`board-grid min-w-0 flex-1 px-4 py-4 ${expanded ? "overflow-y-auto" : ""}`}
      >
        <div className={expanded ? "mx-auto w-full max-w-3xl text-[17px]" : ""}>{children}</div>
      </div>
      {footer ? <div className="border-t border-nuit/10 px-4 py-2 dark:border-neutral-800">{footer}</div> : null}
    </section>
  );
}
