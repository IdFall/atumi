"use client";

import { useEffect } from "react";

import { clearOfflineData } from "@/lib/offline";

/** Page de connexion : plus aucune page d'élève ne reste gardée sur l'appareil. */
export function ClearOfflineData() {
  useEffect(() => {
    void clearOfflineData();
  }, []);
  return null;
}
