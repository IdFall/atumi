import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";

import { HtmlLang } from "@/components/layout/html-lang";
import { ServiceWorkerRegister } from "@/components/offline/service-worker";
import { LocaleProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.name, description: t.app.tagline };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7557d9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {/* La langue vient d'un cookie : tout le contenu est rendu à la demande. */}
        <Suspense fallback={null}>
          <Localized>{children}</Localized>
        </Suspense>
      </body>
    </html>
  );
}

async function Localized({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <HtmlLang locale={locale} />
      {children}
    </LocaleProvider>
  );
}
