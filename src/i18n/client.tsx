"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Locale } from "@/config/countries";

import { getMessages, type Messages } from "./messages";

const LocaleContext = createContext<Locale>("fr");

/** Transmet la langue de l'interface aux composants client. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Textes de l'interface dans la langue choisie. */
export function useT(): Messages {
  return getMessages(useLocale());
}
