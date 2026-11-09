import type { ReactNode } from "react";

/**
 * Bandeau d'ambiance ATUMI : la sphère de particules (violet, bleu électrique)
 * sur fond nuit, avec un voile sombre pour garder le texte lisible.
 */
export function Hero({ children }: { children: ReactNode }) {
  return (
    <header
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-nuit bg-cover bg-center px-5 py-8 text-white shadow-lg"
      style={{ backgroundImage: "url(/sphere-atumi.webp)" }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-nuit/90 via-nuit/60 to-nuit/30" />
      <div className="relative flex flex-col gap-3">{children}</div>
    </header>
  );
}
