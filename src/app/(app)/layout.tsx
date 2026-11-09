import { Suspense } from "react";

import { BottomNav, NavBar } from "@/components/app/bottom-nav";

/** Espace connecté : menu permanent ; chaque page lit la session elle-même, derrière un Suspense. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
      <div className="flex flex-1 flex-col pb-20 md:pb-0 md:pl-60">{children}</div>
    </>
  );
}
