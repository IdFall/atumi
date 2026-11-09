"use client";

import { useEffect, useState } from "react";

import { INACTIVE_PARAM } from "@/config/session";
import { useT } from "@/i18n/client";

/** Message sur /connexion après une déconnexion automatique pour inactivité. */
export function InactiveNotice() {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Lecture après le premier rendu : la page de connexion reste statique.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(new URLSearchParams(window.location.search).get(INACTIVE_PARAM) === "1");
  }, []);
  if (!show) return null;
  return (
    <p role="status" className="mb-4 rounded-lg bg-primary-soft p-3 text-sm text-primary-strong dark:bg-primary-strong/25 dark:text-lavande">
      {t.auth.inactiveSignedOut}
    </p>
  );
}
