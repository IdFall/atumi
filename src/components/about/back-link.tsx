"use client";

import { useRouter } from "next/navigation";

/**
 * Retour à la page précédente (accueil, tableau de bord ou professeur) ;
 * à défaut d'historique, retour à l'accueil.
 */
export function BackLink({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="self-start text-sm font-medium text-primary dark:text-lavande"
    >
      ← {label}
    </button>
  );
}
