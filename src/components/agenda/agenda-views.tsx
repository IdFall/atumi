"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { ConfirmButton, EDIT_LINK } from "@/components/ui/confirm-button";
import { useLocale, useT } from "@/i18n/client";
import { DATE_LOCALES } from "@/i18n/messages";
import { daysBetween, shortTime, slotsByDay, type Reminder, type Weekday } from "@/lib/agenda";
import { deleteAgendaItemAction, setEventDoneAction, type AgendaFormState } from "@/server/agenda/actions";
import type { AgendaEvent, TimetableSlot } from "@/server/agenda/queries";

import { AddToggle, EventForm, SlotForm, type ModuleOption } from "./forms";

const BADGE: Record<Reminder, string> = {
  overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  today: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  tomorrow: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  soon: "bg-primary-soft text-primary-strong dark:bg-primary-strong/25 dark:text-lavande",
  later: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

/** « 12 nov. » ou « mer. 12 nov. » dans la langue de l'interface. */
export function useDayLabel() {
  const tag = DATE_LOCALES[useLocale()];
  return (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function ReminderBadge({ event, today }: { event: AgendaEvent; today: string }) {
  const a = useT().agenda;
  const label = a.reminders[event.reminder].replace("{days}", String(daysBetween(today, event.dueOn)));
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[event.reminder]}`}>{label}</span>;
}

/** Après une action, relit la page (la liste se met à jour sans rechargement). */
function useRefreshingAction(action: (prev: AgendaFormState, formData: FormData) => Promise<AgendaFormState>) {
  const router = useRouter();
  return useActionState(async (prev: AgendaFormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, {});
}

function DeleteButton({ kind, id, name }: { kind: "event" | "slot"; id: string; name: string }) {
  const a = useT().agenda;
  const [state, action, pending] = useRefreshingAction(deleteAgendaItemAction);
  return (
    <form action={action} className="contents">
      <ConfirmButton
        label={pending ? a.deleting : a.delete}
        warning={(kind === "event" ? a.confirmEvent : a.confirmSlot).replace("{name}", name)}
        confirmLabel={a.confirmYes}
        cancelLabel={a.cancel}
        pending={pending}
        hidden={
          <>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
          </>
        }
      />
      {state.error ? <span role="alert" className="text-xs text-red-700 dark:text-red-400">{a.errors[state.error]}</span> : null}
    </form>
  );
}

function EventItem({ event, today, modules }: { event: AgendaEvent; today: string; modules: ModuleOption[] }) {
  const a = useT().agenda;
  const dayLabel = useDayLabel();
  const [editing, setEditing] = useState(false);
  const [, doneAction, toggling] = useRefreshingAction(setEventDoneAction);

  if (editing) return <EventForm event={event} modules={modules} today={today} onClose={() => setEditing(false)} />;

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        <form action={doneAction}>
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="done" value={String(!event.done)} />
          <button
            type="submit"
            disabled={toggling}
            aria-label={event.done ? a.markUndone : a.markDone}
            aria-pressed={event.done}
            className={`mt-0.5 flex size-6 items-center justify-center rounded-full border-2 ${
              event.done ? "border-green-600 bg-green-600 text-white" : "border-neutral-400 hover:border-primary"
            }`}
          >
            {event.done ? "✓" : null}
          </button>
        </form>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{a.kinds[event.kind]}</span>
            <ReminderBadge event={event} today={today} />
          </div>
          <p className={`font-semibold ${event.done ? "text-neutral-500 line-through" : ""}`}>{event.title}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {dayLabel(event.dueOn)}
            {event.dueTime ? ` · ${shortTime(event.dueTime)}` : ""}
            {event.moduleName ? ` · ${event.moduleName}` : ""}
          </p>
          {event.note ? <p className="text-sm text-neutral-600 dark:text-neutral-300">{event.note}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2 pl-9 text-xs">
        {event.moduleId && !event.done ? (
          <Link href={`/cours/${event.moduleId}`} className={EDIT_LINK}>
            {a.reviseModule}
          </Link>
        ) : null}
        <button type="button" onClick={() => setEditing(true)} className={EDIT_LINK}>
          {a.edit}
        </button>
        <DeleteButton kind="event" id={event.id} name={event.title} />
      </div>
    </article>
  );
}

const GROUPS = [
  { key: "overdue", has: (r: Reminder) => r === "overdue" },
  { key: "soon", has: (r: Reminder) => r === "today" || r === "tomorrow" || r === "soon" },
  { key: "later", has: (r: Reminder) => r === "later" },
  { key: "done", has: (r: Reminder) => r === "done" },
] as const;

export function EventsView({ events, today, modules }: { events: AgendaEvent[]; today: string; modules: ModuleOption[] }) {
  const a = useT().agenda;
  return (
    <div className="flex flex-col gap-5">
      <AddToggle label={a.add}>{(close) => <EventForm modules={modules} today={today} onClose={close} />}</AddToggle>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          {a.empty}
        </p>
      ) : (
        GROUPS.map((group) => {
          const items = events.filter((e) => group.has(e.reminder));
          // Les échéances faites : les plus récentes d'abord.
          if (group.key === "done") items.reverse();
          if (items.length === 0) return null;
          return (
            <section key={group.key} className="flex flex-col gap-2">
              <h2 className={`text-sm font-semibold uppercase tracking-wide ${group.key === "overdue" ? "text-red-700 dark:text-red-400" : "text-neutral-500"}`}>
                {a.groups[group.key]} ({items.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((e) => (
                  <li key={e.id}>
                    <EventItem event={e} today={today} modules={modules} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function SlotItem({ slot, modules }: { slot: TimetableSlot; modules: ModuleOption[] }) {
  const a = useT().agenda;
  const [editing, setEditing] = useState(false);
  if (editing) return <SlotForm slot={slot} modules={modules} weekday={slot.weekday} onClose={() => setEditing(false)} />;
  const moduleName = modules.find((m) => m.id === slot.moduleId)?.name;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-baseline gap-3">
        <span className="w-24 shrink-0 font-mono text-sm text-accent-text dark:text-accent">
          {shortTime(slot.startsAt)}–{shortTime(slot.endsAt)}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{slot.label}</p>
          {slot.place || moduleName ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{[slot.place, moduleName].filter(Boolean).join(" · ")}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2 text-xs">
        <button type="button" onClick={() => setEditing(true)} className={EDIT_LINK}>
          {a.edit}
        </button>
        <DeleteButton kind="slot" id={slot.id} name={slot.label} />
      </div>
    </div>
  );
}

export function TimetableView({ slots, todayWeekday, modules }: { slots: TimetableSlot[]; todayWeekday: Weekday; modules: ModuleOption[] }) {
  const a = useT().agenda;
  const days = slotsByDay(slots);
  return (
    <div className="flex flex-col gap-5">
      <AddToggle label={a.addSlot}>{(close) => <SlotForm modules={modules} weekday={todayWeekday} onClose={close} />}</AddToggle>
      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          {a.emptyTimetable}
        </p>
      ) : (
        days.map((day) => (
          <section key={day.weekday} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {a.weekdays[day.weekday]}
              {day.weekday === todayWeekday ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] normal-case text-white">{a.today}</span>
              ) : null}
            </h2>
            <ul className="flex flex-col gap-2">
              {day.slots.map((s) => (
                <li key={s.id}>
                  <SlotItem slot={s} modules={modules} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
