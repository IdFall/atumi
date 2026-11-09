import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HelpAskForm } from "@/components/help/ask-form";
import { ContactTeamForm } from "@/components/help/contact-form";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { FEATURED_ARTICLES, type HelpArticle } from "@/i18n/help-articles";
import { getLocale, getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { rateHelpAnswerAction } from "@/server/help/actions";
import { articlesForCountry, listRecentHelpQuestions, type HelpQuestion } from "@/server/help/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.help.title };
}

export default async function HelpPage({ searchParams }: PageProps<"/aide">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.help.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.help.intro}</p>
      </header>
      <Suspense fallback={null}>
        <HelpContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HelpContent({ searchParams }: { searchParams: PageProps<"/aide">["searchParams"] }) {
  const t = await getT();
  const [{ article: articleParam }, user, recent] = await Promise.all([
    searchParams,
    getCurrentUser(),
    listRecentHelpQuestions(),
  ]);
  const articles = articlesForCountry(user.countryCode, await getLocale());
  const selected = typeof articleParam === "string" ? articles.find((a) => a.id === articleParam) : undefined;

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">{t.help.featured}</h2>
        <ul className="flex flex-wrap gap-2">
          {articles
            .filter((a) => FEATURED_ARTICLES.includes(a.id))
            .map((a) => (
              <li key={a.id}>
                <Link
                  href={`/aide?article=${a.id}`}
                  aria-current={selected?.id === a.id ? "page" : undefined}
                  className={`inline-block rounded-full border px-3 py-1.5 text-sm ${
                    selected?.id === a.id
                      ? "border-primary bg-primary-soft font-semibold text-primary-strong dark:bg-primary-strong/25 dark:text-lavande"
                      : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-nuit"
                  }`}
                >
                  {a.title}
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {selected ? <ArticleView article={selected} /> : null}

      {recent.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label={t.help.recent}>
          {recent.map((q) => (
            <QuestionView key={q.id} question={q} />
          ))}
        </section>
      ) : null}

      <HelpAskForm />
      <ContactTeamForm />
    </>
  );
}

async function ArticleView({ article }: { article: HelpArticle }) {
  const t = await getT();
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-nuit">
      <h2 className="text-lg font-semibold">{article.title}</h2>
      {article.body.split("\n").map((line) => (
        <p key={line} className="text-sm leading-relaxed">
          {line}
        </p>
      ))}
      <Link href="/aide" className="text-sm text-primary dark:text-lavande">
        {t.help.back}
      </Link>
    </article>
  );
}

async function QuestionView({ question }: { question: HelpQuestion }) {
  const t = await getT();
  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-white">
        {question.question}
      </p>
      <div className="flex max-w-[92%] flex-col gap-2 self-start">
        <div className="rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <SynthesisContent markdown={question.answer ?? t.help.unavailable} />
        </div>
        {question.answer === null ? null : question.helpful === null ? (
          <form action={rateHelpAnswerAction} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <input type="hidden" name="id" value={question.id} />
            <span>{t.help.helpful}</span>
            <button type="submit" name="helpful" value="1" className="rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-700">
              {t.help.yes}
            </button>
            <button type="submit" name="helpful" value="0" className="rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-700">
              {t.help.no}
            </button>
          </form>
        ) : (
          <p className="text-xs text-neutral-500">{t.help.thanks}</p>
        )}
      </div>
    </div>
  );
}
