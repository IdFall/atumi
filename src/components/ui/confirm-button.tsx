"use client";

import { useState, type ReactNode } from "react";

/**
 * Bouton d'action destructive confirmé dans la page (pas de fenêtre
 * `confirm()`, bloquée dans certains navigateurs intégrés) : un premier appui
 * affiche l'avertissement, le second envoie le formulaire.
 */
export function ConfirmButton({
  label,
  warning,
  confirmLabel,
  cancelLabel,
  pending,
  hidden,
}: {
  label: string;
  warning: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  /** Champs cachés du formulaire parent, déjà rendus par l'appelant. */
  hidden?: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={DANGER_LINK}>
        {label}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={label} className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
      <p>{warning}</p>
      {hidden}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white disabled:opacity-60">
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="rounded-lg px-3 py-1.5 font-medium">
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

export const DANGER_LINK =
  "rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950";
export const EDIT_LINK =
  "rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-soft dark:text-lavande";
