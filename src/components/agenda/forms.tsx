"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type ReactNode } from "react";

import { useT } from "@/i18n/client";
import { shortTime, WEEKDAYS, type Weekday } from "@/lib/agenda";
import { saveEventAction, saveSlotAction, type AgendaFormState } from "@/server/agenda/actions";
import type { AgendaEvent, TimetableSlot } from "@/server/agenda/queries";
import { EVENT_KINDS } from "@/server/agenda/schemas";

const INPUT =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-950";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <label htmlFor={htmlFor} className="font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Formulaire enregistré par une Server Action ; se referme une fois enregistré. */
function useSaveForm(action: (prev: AgendaFormState, formData: FormData) => Promise<AgendaFormState>, onSaved: () => void) {
  const router = useRouter();
  return useActionState(async (prev: AgendaFormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.saved) {
      onSaved();
      router.refresh();
    }
    return result;
  }, {});
}

function Buttons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  const a = useT().agenda;
  return (
    <div className="flex gap-2">
      <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? a.saving : a.save}
      </button>
      <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
        {a.cancel}
      </button>
    </div>
  );
}

function ErrorLine({ error }: { error?: AgendaFormState["error"] }) {
  const a = useT().agenda;
  return error ? (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {a.errors[error]}
    </p>
  ) : null;
}

export function EventForm({
  event,
  today,
  onClose,
}: {
  event?: AgendaEvent;
  today: string;
  onClose: () => void;
}) {
  const a = useT().agenda;
  const [state, action, pending] = useSaveForm(saveEventAction, onClose);
  const key = event?.id ?? "new";
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4 dark:bg-primary-strong/10">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <Field label={a.fields.kind} htmlFor={`kind-${key}`}>
          <select id={`kind-${key}`} name="kind" defaultValue={event?.kind ?? "devoir"} className={INPUT}>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {a.kinds[k]}
              </option>
            ))}
          </select>
        </Field>
      <Field label={a.fields.title} htmlFor={`title-${key}`}>
        <input id={`title-${key}`} name="title" required maxLength={200} defaultValue={event?.title} placeholder={a.fields.titlePlaceholder} className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={a.fields.dueOn} htmlFor={`due-${key}`}>
          <input id={`due-${key}`} name="dueOn" type="date" required defaultValue={event?.dueOn ?? today} className={INPUT} />
        </Field>
        <Field label={a.fields.dueTime} htmlFor={`time-${key}`}>
          <input id={`time-${key}`} name="dueTime" type="time" defaultValue={shortTime(event?.dueTime ?? null) ?? ""} className={INPUT} />
        </Field>
      </div>
      <Field label={a.fields.note} htmlFor={`note-${key}`}>
        <textarea id={`note-${key}`} name="note" rows={2} maxLength={1000} defaultValue={event?.note ?? ""} className={INPUT} />
      </Field>
      <ErrorLine error={state.error} />
      <Buttons pending={pending} onCancel={onClose} />
    </form>
  );
}

export function SlotForm({
  slot,
  weekday,
  onClose,
}: {
  slot?: TimetableSlot;
  weekday: Weekday;
  onClose: () => void;
}) {
  const a = useT().agenda;
  const [state, action, pending] = useSaveForm(saveSlotAction, onClose);
  const key = slot?.id ?? "new";
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4 dark:bg-primary-strong/10">
      {slot ? <input type="hidden" name="id" value={slot.id} /> : null}
      <Field label={a.fields.label} htmlFor={`label-${key}`}>
        <input id={`label-${key}`} name="label" required maxLength={120} defaultValue={slot?.label} placeholder={a.fields.labelPlaceholder} className={INPUT} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={a.fields.weekday} htmlFor={`day-${key}`}>
          <select id={`day-${key}`} name="weekday" defaultValue={slot?.weekday ?? weekday} className={INPUT}>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {a.weekdays[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={a.fields.startsAt} htmlFor={`start-${key}`}>
          <input id={`start-${key}`} name="startsAt" type="time" required defaultValue={shortTime(slot?.startsAt ?? null) ?? "08:00"} className={INPUT} />
        </Field>
        <Field label={a.fields.endsAt} htmlFor={`end-${key}`}>
          <input id={`end-${key}`} name="endsAt" type="time" required defaultValue={shortTime(slot?.endsAt ?? null) ?? "10:00"} className={INPUT} />
        </Field>
      </div>
      <Field label={a.fields.place} htmlFor={`place-${key}`}>
        <input id={`place-${key}`} name="place" maxLength={80} defaultValue={slot?.place ?? ""} className={INPUT} />
      </Field>
      <ErrorLine error={state.error} />
      <Buttons pending={pending} onCancel={onClose} />
    </form>
  );
}

/** Bouton « Ajouter » qui déplie le formulaire voulu. */
export function AddToggle({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children(() => setOpen(false))}</>;
  return (
    <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white">
      + {label}
    </button>
  );
}
