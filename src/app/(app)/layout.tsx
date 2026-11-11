import { Suspense } from "react";

import { BottomNav, NavBar } from "@/components/app/bottom-nav";
import { IdleSignOut } from "@/components/auth/idle-sign-out";

/** Espace connecté : menu permanent (marge entre le menu latéral et le contenu sur ordinateur) ; chaque page lit la session elle-même, derrière un Suspense. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <IdleSignOut />
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
      <div className="flex flex-1 flex-col pb-20 md:pb-0 md:pl-56 md:pr-2 [&>main]:md:px-8">{children}</div>
    </>
  );
}
