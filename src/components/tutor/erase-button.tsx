"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { useT } from "@/i18n/client";
import { deleteConversationsAction } from "@/server/tutor/manage";

/** Efface une conversation (ou toutes), après confirmation dans la page. */
export function EraseButton({ conversationId, redirectAfter = false }: { conversationId?: string; redirectAfter?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const e = t.tutor.erase;
  const all = !conversationId;
  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await deleteConversationsAction(formData);
          if (redirectAfter) router.push("/professeur");
          router.refresh();
        })
      }
    >
      <ConfirmButton
        label={all ? e.all : redirectAfter ? e.conversation : e.one}
        warning={all ? e.confirmAll : e.confirmOne}
        confirmLabel={e.confirmYes}
        cancelLabel={e.cancel}
        pending={pending}
        hidden={all ? <input type="hidden" name="all" value="1" /> : <input type="hidden" name="id" value={conversationId} />}
      />
    </form>
  );
}
