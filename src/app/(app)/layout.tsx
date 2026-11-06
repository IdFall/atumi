import { Suspense } from "react";

import { BottomNav, NavBar } from "@/components/app/bottom-nav";

/** Espace connecté : chaque page lit la session elle-même, derrière un Suspense. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-20">{children}</div>
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
