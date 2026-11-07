import Link from "next/link";
import type { ReactNode } from "react";

import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm font-semibold tracking-wide text-amber-700">
        {t.app.name}
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}
