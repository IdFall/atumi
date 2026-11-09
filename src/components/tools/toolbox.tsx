"use client";

import { useState, useTransition, type ReactNode } from "react";

import { useLocale, useT } from "@/i18n/client";
import { calculate, type AngleUnit } from "@/lib/calculator";
import { ELEMENTS, elementPosition, type Element, type ElementCategory } from "@/lib/periodic-table";
import { convert, QUANTITIES, unitsOf, type Quantity } from "@/lib/units";
import { lookupReferenceAction } from "@/server/tools/actions";
import type { ReferenceResult } from "@/server/tools/reference";

const INPUT =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-950";

/** Boîte à outils : calculatrice, conversions, tableau périodique, formules, dictionnaire. Sans IA. */
export function Toolbox() {
  const t = useT().tools;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.intro}</p>
      <Tool title={t.calculator.title} open>
        <Calculator />
      </Tool>
      <Tool title={t.converter.title}>
        <Converter />
      </Tool>
      <Tool title={t.periodic.title}>
        <PeriodicTable />
      </Tool>
      <Tool title={t.formulas.title}>
        <Formulas />
      </Tool>
      <Tool title={t.dictionary.title}>
        <Dictionary />
      </Tool>
    </div>
  );
}

function Tool({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
        {title}
        <span aria-hidden="true" className="text-neutral-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">{children}</div>
    </details>
  );
}

function formatNumber(value: number, locale: string): string {
  return Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-6 && value !== 0)
    ? value.toExponential(6).replace(".", locale === "fr" ? "," : ".")
    : value.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 10 });
}

const KEYS = ["7", "8", "9", "÷", "(", "4", "5", "6", "×", ")", "1", "2", "3", "−", "^", "0", ",", "π", "+", "√"];
const FUNCTION_KEYS = ["sin(", "cos(", "tan(", "ln(", "log(", "!"];

function Calculator() {
  const t = useT().tools.calculator;
  const locale = useLocale();
  const [expression, setExpression] = useState("");
  const [angle, setAngle] = useState<AngleUnit>("deg");
  const result = expression.trim() ? calculate(expression, angle) : null;
  const key = "rounded-lg border border-neutral-200 py-2 text-base font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900";

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="calc" className="sr-only">
        {t.label}
      </label>
      <input
        id="calc"
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        placeholder={t.placeholder}
        inputMode="text"
        autoComplete="off"
        className={`${INPUT} font-mono`}
      />
      <p aria-live="polite" className="min-h-8 text-right font-mono text-2xl font-semibold">
        {result === null ? "" : result.ok ? `${t.equals} ${formatNumber(result.value, locale)}` : <span className="text-base font-normal text-red-700 dark:text-red-400">{t.errors[result.error]}</span>}
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => setExpression((e) => e + k)} className={key}>
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {FUNCTION_KEYS.map((k) => (
          <button key={k} type="button" onClick={() => setExpression((e) => e + k)} className={`${key} text-sm`}>
            {k.replace("(", "")}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div role="radiogroup" className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm dark:bg-neutral-900">
          {(["deg", "rad"] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={angle === a}
              onClick={() => setAngle(a)}
              className={`rounded-md px-3 py-1 font-medium ${angle === a ? "bg-white text-primary shadow-sm dark:bg-neutral-800 dark:text-lavande" : "text-neutral-600 dark:text-neutral-300"}`}
            >
              {t[a]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setExpression("")} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
          {t.clear}
        </button>
      </div>
      <p className="text-xs text-neutral-500">{t.hint}</p>
    </div>
  );
}

function Converter() {
  const t = useT().tools.converter;
  const locale = useLocale();
  const [quantity, setQuantity] = useState<Quantity>("length");
  const [raw, setRaw] = useState("1");
  const units = unitsOf(quantity);
  const [from, setFrom] = useState(units[0]);
  const [to, setTo] = useState(units[1]);
  const value = Number(raw.replace(",", ".").replace(/\s/g, ""));
  const result = raw.trim() ? convert(value, quantity, from, to) : null;

  function changeQuantity(q: Quantity) {
    const next = unitsOf(q);
    setQuantity(q);
    setFrom(next[0]);
    setTo(next[1]);
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1 font-medium">
        {t.quantity}
        <select value={quantity} onChange={(e) => changeQuantity(e.target.value as Quantity)} className={INPUT}>
          {QUANTITIES.map((q) => (
            <option key={q} value={q}>
              {t.quantities[q]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="flex flex-col gap-1 font-medium">
          {t.from}
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT}>
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          aria-label={t.swap}
          className="mb-1 rounded-lg border border-neutral-300 px-2 py-1.5 dark:border-neutral-700"
        >
          ⇄
        </button>
        <label className="flex flex-col gap-1 font-medium">
          {t.to}
          <select value={to} onChange={(e) => setTo(e.target.value)} className={INPUT}>
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 font-medium">
        {t.value}
        <input value={raw} onChange={(e) => setRaw(e.target.value)} inputMode="decimal" className={INPUT} />
      </label>
      <p aria-live="polite" className="rounded-lg bg-primary-soft/60 p-3 text-center text-lg font-semibold text-primary-strong dark:bg-primary-strong/20 dark:text-lavande">
        {result === null ? "—" : `${raw} ${from} = ${formatNumber(result, locale)} ${to}`}
      </p>
    </div>
  );
}

const CATEGORY_COLOR: Record<ElementCategory, string> = {
  alkali: "bg-red-100 dark:bg-red-950",
  alkalineEarth: "bg-orange-100 dark:bg-orange-950",
  transition: "bg-yellow-100 dark:bg-yellow-950",
  postTransition: "bg-teal-100 dark:bg-teal-950",
  metalloid: "bg-lime-100 dark:bg-lime-950",
  nonMetal: "bg-sky-100 dark:bg-sky-950",
  halogen: "bg-cyan-100 dark:bg-cyan-950",
  nobleGas: "bg-violet-100 dark:bg-violet-950",
  lanthanide: "bg-pink-100 dark:bg-pink-950",
  actinide: "bg-fuchsia-100 dark:bg-fuchsia-950",
};

function PeriodicTable() {
  const t = useT().tools.periodic;
  const locale = useLocale();
  const [selected, setSelected] = useState<Element>(ELEMENTS[0]);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500">{t.hint}</p>
      <div className={`flex items-center gap-3 rounded-lg p-3 ${CATEGORY_COLOR[selected.category]}`}>
        <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-white/70 dark:bg-black/30">
          <span className="text-[10px]">{selected.z}</span>
          <span className="text-xl font-bold leading-none">{selected.symbol}</span>
        </span>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-sm">
          <dt className="sr-only">Nom</dt>
          <dd className="col-span-2 font-semibold">{selected.name[locale]}</dd>
          <dt className="text-neutral-600 dark:text-neutral-300">{t.z}</dt>
          <dd>{selected.z}</dd>
          <dt className="text-neutral-600 dark:text-neutral-300">{t.mass}</dt>
          <dd>{selected.mass.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB")} g/mol</dd>
          <dt className="text-neutral-600 dark:text-neutral-300">{t.category}</dt>
          <dd>{t.categories[selected.category]}</dd>
        </dl>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[540px] gap-0.5" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
          {ELEMENTS.map((e) => {
            const { row, column } = elementPosition(e.z);
            return (
              <button
                key={e.z}
                type="button"
                onClick={() => setSelected(e)}
                aria-label={`${e.name[locale]} (${e.symbol})`}
                aria-pressed={selected.z === e.z}
                style={{ gridRow: row, gridColumn: column }}
                className={`flex aspect-square flex-col items-center justify-center rounded text-[11px] font-semibold leading-none ${CATEGORY_COLOR[e.category]} ${
                  selected.z === e.z ? "ring-2 ring-primary" : ""
                }`}
              >
                <span className="text-[7px] font-normal opacity-70">{e.z}</span>
                {e.symbol}
              </button>
            );
          })}
          {/* Ligne vide entre le tableau et les séries f. */}
          <div style={{ gridRow: 8, gridColumn: "1 / span 18" }} className="h-2" />
        </div>
      </div>
    </div>
  );
}

function Formulas() {
  const t = useT().tools.formulas;
  return (
    <div className="flex flex-col gap-4">
      {t.groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{group.title}</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {group.items.map((item) => (
              <li key={item} className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Dictionary() {
  const t = useT().tools.dictionary;
  const [word, setWord] = useState("");
  const [result, setResult] = useState<ReferenceResult | null>(null);
  const [pending, startTransition] = useTransition();
  const term = word.trim();

  const look = (kind: "dictionary" | "encyclopedia") => {
    if (!term || pending) return;
    startTransition(async () => {
      setResult(await lookupReferenceAction(kind, term).catch((): ReferenceResult => ({ ok: false, error: "unavailable" })));
    });
  };
  const button = "flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          look("dictionary");
        }}
      >
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder={t.placeholder} maxLength={100} className={INPUT} aria-label={t.placeholder} />
        <div className="flex gap-2">
          <button type="submit" disabled={!term || pending} className={`${button} bg-primary text-white`}>
            {t.define}
          </button>
          <button
            type="button"
            disabled={!term || pending}
            onClick={() => look("encyclopedia")}
            className={`${button} border-2 border-primary text-primary dark:border-lavande dark:text-lavande`}
          >
            {t.encyclopedia}
          </button>
        </div>
      </form>
      <div aria-live="polite">
        {pending ? (
          <p className="text-sm text-neutral-500">{t.loading}</p>
        ) : result ? (
          <ReferenceView result={result} />
        ) : (
          <p className="text-xs text-neutral-500">{t.hint}</p>
        )}
      </div>
    </div>
  );
}

function ReferenceView({ result }: { result: ReferenceResult }) {
  const t = useT().tools.dictionary;
  if (!result.ok) {
    return <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">{t[result.error]}</p>;
  }
  const link = "text-sm font-semibold text-primary underline-offset-4 hover:underline dark:text-lavande";
  if (result.kind === "dictionary") {
    return (
      <article className="flex flex-col gap-3 rounded-xl bg-primary-soft/50 p-4 dark:bg-neutral-900">
        <h3 className="text-lg font-bold">{result.word}</h3>
        {result.entries.map((entry, i) => (
          <section key={i} className="flex flex-col gap-1">
            {entry.partOfSpeech ? <p className="text-xs font-semibold uppercase tracking-wide text-primary-strong dark:text-lavande">{entry.partOfSpeech}</p> : null}
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
              {entry.definitions.map((d, j) => (
                <li key={j}>{d}</li>
              ))}
            </ol>
          </section>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href={result.url} target="_blank" rel="noopener noreferrer" className={link}>
            {t.seeOnSite}
          </a>
          <p className="text-xs text-neutral-500">{t.dictionaryCredit}</p>
        </div>
      </article>
    );
  }
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-primary-soft/50 p-4 dark:bg-neutral-900">
      <div className="flex gap-3">
        {result.image ? (
          // Vignette de l'article (Wikimedia), taille inconnue d'avance.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded-lg bg-white object-cover" />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-bold">{result.title}</h3>
          <p className="text-sm leading-relaxed">{result.extract}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={result.url} target="_blank" rel="noopener noreferrer" className={link}>
          {t.readMore}
        </a>
        <p className="text-xs text-neutral-500">{t.encyclopediaCredit}</p>
      </div>
    </article>
  );
}
