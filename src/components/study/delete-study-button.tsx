"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { useT } from "@/i18n/client";
import { deleteQuizAction, deleteSynthesisAction, type DeleteState } from "@/server/study/manage";

/** Bouton « Supprimer » d'un quiz ou d'une synthèse, confirmé dans la page. */
export function DeleteStudyButton({ kind, id, warning }: { kind: "quiz" | "synthesis"; id: string; warning: string }) {
  const t = useT();
  const d = t.studyDelete;
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: DeleteState, formData: FormData) => {
    const result = await (kind === "quiz" ? deleteQuizAction : deleteSynthesisAction)(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <ConfirmButton
        label={d.delete}
        warning={warning}
        confirmLabel={pending ? d.deleting : d.confirm}
        cancelLabel={d.cancel}
        pending={pending}
        hidden={<input type="hidden" name="id" value={id} />}
      />
      {state.error ? (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {d.errors[state.error]}
        </span>
      ) : null}
    </form>
  );
}
