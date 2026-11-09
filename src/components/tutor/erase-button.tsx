"use client";

import { useT } from "@/i18n/client";
import { deleteConversationsAction } from "@/server/tutor/manage";

/** Efface une conversation (ou toutes), après confirmation. */
export function EraseButton({ conversationId, redirectAfter = false }: { conversationId?: string; redirectAfter?: boolean }) {
  const t = useT();
  const e = t.tutor.erase;
  const all = !conversationId;
  return (
    <form
      action={deleteConversationsAction}
      onSubmit={(event) => {
        if (!window.confirm(all ? e.confirmAll : e.confirmOne)) event.preventDefault();
      }}
    >
      {all ? <input type="hidden" name="all" value="1" /> : <input type="hidden" name="id" value={conversationId} />}
      {redirectAfter ? <input type="hidden" name="redirect" value="1" /> : null}
      <button type="submit" className="text-xs font-medium text-red-700 dark:text-red-400">
        {all ? e.all : redirectAfter ? e.conversation : e.one}
      </button>
    </form>
  );
}
