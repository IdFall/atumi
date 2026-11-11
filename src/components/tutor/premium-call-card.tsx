import Image from "next/image";
import Link from "next/link";

import { getT } from "@/i18n/server";

/** Annonce de l'appel voix avec le Prof, inclus dans les forfaits. */
export async function PremiumCallCard() {
  const t = await getT();
  const p = t.premiumCall;
  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={72} height={72} priority />
      <h1 className="text-2xl font-bold">{p.title}</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{p.intro}</p>
      <p className="font-semibold">{p.included}</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{p.soon}</p>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/abonnement" className="rounded-xl bg-primary px-5 py-3 font-semibold text-white">
          {p.subscribe}
        </Link>
        <Link href="/professeur" className="rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary-strong dark:text-lavande">
          {p.write}
        </Link>
      </div>
    </section>
  );
}
