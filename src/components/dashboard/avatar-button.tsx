"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useT } from "@/i18n/client";
import { AVATAR_SIDE, initialsOf } from "@/lib/avatar";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { removeAvatarAction, setAvatarAction } from "@/server/profile/actions";

/** Recadre la photo au centre, en carré, et la réduit : petite et rapide à charger. */
async function squarePhoto(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIDE;
    canvas.height = AVATAR_SIDE;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } catch {
    return null;
  }
}

/** Photo de profil de l'élève (ou ses initiales) ; un clic pour l'ajouter, la changer ou la retirer. */
export function AvatarButton({ userId, username, avatarUrl }: { userId: string; username: string; avatarUrl: string | null }) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError(false);
    setMenu(false);
    const blob = await squarePhoto(file);
    if (!blob) {
      setBusy(false);
      setError(true);
      return;
    }
    const path = `${userId}/${Date.now()}.jpg`;
    const { error: uploadError } = await createBrowserSupabase().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
    const result = uploadError ? { ok: false } : await setAvatarAction(path).catch(() => ({ ok: false }));
    setBusy(false);
    if (!result.ok) setError(true);
    else router.refresh();
  }

  async function remove() {
    setBusy(true);
    setMenu(false);
    const result = await removeAvatarAction().catch(() => ({ ok: false }));
    setBusy(false);
    if (!result.ok) setError(true);
    else router.refresh();
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => (avatarUrl ? setMenu((v) => !v) : input.current?.click())}
        disabled={busy}
        aria-label={avatarUrl ? t.dashboard.avatar.change : t.dashboard.avatar.add}
        aria-expanded={avatarUrl ? menu : undefined}
        className="group relative grid size-16 place-items-center rounded-full bg-gradient-to-br from-accent via-primary to-electrique p-[2.5px] shadow-lg shadow-accent/30 md:size-20"
      >
        <span className="grid size-full place-items-center overflow-hidden rounded-full bg-nuit">
          {avatarUrl ? (
            // Lien signé de Supabase Storage (privé, une heure) : pas d'optimisation d'image Next.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-xl font-bold tracking-wide text-white md:text-2xl">{initialsOf(username)}</span>
          )}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-nuit bg-accent text-nuit" aria-hidden="true">
          {busy ? (
            <span className="size-2.5 animate-pulse rounded-full bg-nuit" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {menu ? (
        <div role="menu" className="absolute left-0 top-full z-20 mt-2 flex w-48 flex-col overflow-hidden rounded-xl border border-white/10 bg-nuit text-sm shadow-xl">
          <button type="button" role="menuitem" onClick={() => input.current?.click()} className="px-4 py-2.5 text-left hover:bg-white/10">
            {t.dashboard.avatar.change}
          </button>
          <button type="button" role="menuitem" onClick={() => void remove()} className="px-4 py-2.5 text-left text-red-300 hover:bg-white/10">
            {t.dashboard.avatar.remove}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">
          {t.dashboard.avatar.error}
        </p>
      ) : null}
    </div>
  );
}
