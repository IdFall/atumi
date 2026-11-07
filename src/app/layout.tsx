import type { Metadata, Viewport } from "next";

import { getMessages } from "@/i18n/messages";

import "./globals.css";

const t = getMessages("fr");

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7557d9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
