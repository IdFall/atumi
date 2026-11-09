"use client";

import { useEffect } from "react";

import type { Locale } from "@/config/countries";

/** Met à jour l'attribut lang de la page selon la langue de l'interface. */
export function HtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
