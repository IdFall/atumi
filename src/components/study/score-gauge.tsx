import { fill } from "@/i18n/format";
import { getT } from "@/i18n/server";

/** Jauge des réponses trouvées et non trouvées, avec le nombre puis le pourcentage. */
export async function ScoreGauge({ correct, total }: { correct: number; total: number }) {
  const t = await getT();
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const missed = total - correct;
  const label = fill(correct > 1 ? t.quiz.scorePlural : t.quiz.score, { correct, total, percent });
  return (
    <div role="img" aria-label={label} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-lg font-bold">{label}</p>
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        {correct > 0 ? <span className="bg-green-600" style={{ width: `${percent}%` }} /> : null}
        {missed > 0 ? <span className="flex-1 bg-red-600" /> : null}
      </div>
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-green-600" />
          <strong>{correct}</strong> {t.quiz.found} ({percent} %)
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-red-600" />
          <strong>{missed}</strong> {t.quiz.notFound} ({100 - percent} %)
        </span>
      </div>
    </div>
  );
}
