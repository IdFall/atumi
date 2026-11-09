import type { Locale } from "@/config/countries";
import { DATE_LOCALES } from "@/i18n/messages";

/** Formats des pages d'administration, selon la langue de l'interface. */
export function adminFormat(locale: Locale) {
  const tag = DATE_LOCALES[locale];
  const number = new Intl.NumberFormat(tag);
  return {
    tag,
    n: (value: number | null | undefined) => (value === null || value === undefined ? "—" : number.format(value)),
    date: (value: string | null) =>
      value ? new Date(value).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" }) : "—",
    dateTime: (value: string | null) =>
      value
        ? new Date(value).toLocaleString(tag, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : "—",
    day: (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
  };
}
