/**
 * Logo AtumiNeo (variante B choisie par Idrissa) : « ATUMI » en grand, le « I »
 * (Intelligent) et « NEO » en cyan, « NEO » dessous, aligné à droite.
 * Couleurs de la charte : violet #7557D9, cyan #13B8C8 (#0B7C88 pour du texte
 * cyan sur fond clair), blanc sur fond sombre. La taille suit `className`
 * (text-lg, text-2xl…). Sans hook : utilisable côté serveur comme client.
 */
export function Logo({
  label,
  tone = "auto",
  className = "",
}: {
  /** Nom lu par les lecteurs d'écran (t.app.name). */
  label: string;
  /** « auto » : fond clair, sombre en mode sombre ; « dark » : toujours sur fond sombre. */
  tone?: "auto" | "dark";
  className?: string;
}) {
  const main = tone === "dark" ? "text-white" : "text-primary dark:text-white";
  const cyan = tone === "dark" ? "text-accent" : "text-accent-text dark:text-accent";
  return (
    <span role="img" aria-label={label} className={`inline-flex flex-col items-end font-black leading-[0.9] ${className}`}>
      <span aria-hidden="true" className={`tracking-[0.06em] ${main}`}>
        ATUM<span className={cyan}>I</span>
      </span>
      <span aria-hidden="true" className={`-mr-[0.12em] mt-[0.1em] text-[0.42em] font-extrabold tracking-[0.3em] ${cyan}`}>
        NEO
      </span>
    </span>
  );
}
