/**
 * Langue de l'interface d'un visiteur qui n'a encore rien choisi : celle de son
 * pays (déduit de l'adresse IP par l'hébergeur), sinon celle de son navigateur,
 * sinon le français. Le choix de l'élève (cookie) passe toujours avant.
 */
import { LOCALES, localeForCountry, type Locale } from "@/config/countries";

export function detectLocale({ country, acceptLanguage }: { country: string | null; acceptLanguage: string | null }): Locale {
  const fromCountry = localeForCountry(country);
  if (fromCountry) return fromCountry;
  return fromAcceptLanguage(acceptLanguage) ?? "fr";
}

/** Première langue gérée dans l'en-tête Accept-Language, par ordre de préférence. */
export function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.trim().slice(0, 2).toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1, index };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { lang } of ranked) {
    if ((LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return null;
}
