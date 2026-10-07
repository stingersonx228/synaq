import { CASES } from "@/lib/catalog";
import { keepNumbersTogether } from "@/lib/format";
import type { TypeStat } from "@/lib/stats";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Turns the class's blind spots into a short plan for the next lesson, using the catalog's
 * own explanation of each error type. Static content, so it prints as part of the report.
 */
export default function LessonPlan({ spots }: { spots: TypeStat[] }) {
  const items = spots
    .map((spot) => ({ spot, c: CASES.find((c) => c.type_id === spot.typeId) }))
    .filter((x): x is { spot: TypeStat; c: (typeof CASES)[number] } => x.c !== undefined);
  if (items.length === 0) return null;

  return (
    <section className="mt-10 break-inside-avoid">
      <h2 className="font-display text-xl font-bold">Что разобрать на уроке</h2>
      <p className="mt-1 max-w-[70ch] text-muted">
        План на 10-15 минут по главным слепым пятнам класса. Задачу можно выписать на доску и попросить класс найти
        ошибку, как в игре.
      </p>
      <ol className="mt-5 flex flex-col gap-5">
        {items.map(({ spot, c }, i) => {
          const wrongStep = c.bug ? c.steps[c.bug.accept_steps[0] - 1] : null;
          return (
            <li key={spot.typeId} className="break-inside-avoid rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-semibold">
                  <span className="mr-2 font-mono text-muted">{i + 1}</span>
                  {spot.name}
                </h3>
                <span className="text-sm text-muted">проблемных раундов {pct(spot.problemRate)}</span>
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[11rem_1fr]">
                {c.bug ? (
                  <>
                    <dt className="text-muted">Типичная ошибка</dt>
                    <dd className="leading-relaxed">{keepNumbersTogether(c.bug.cause)}</dd>
                    <dt className="text-muted">Как объяснить</dt>
                    <dd className="leading-relaxed">{keepNumbersTogether(c.bug.fix)}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-muted">Что происходит</dt>
                    <dd className="leading-relaxed">
                      Ученики ищут ошибку там, где её нет, и обвиняют верные шаги вместо того, чтобы проверить их.
                    </dd>
                    <dt className="text-muted">Как объяснить</dt>
                    <dd className="leading-relaxed">
                      Прежде чем назвать шаг неверным, подставьте ответ в исходное условие: если обе части равны,
                      решение верное.
                    </dd>
                  </>
                )}
                <dt className="text-muted">Задача для доски</dt>
                <dd className="leading-relaxed">
                  {keepNumbersTogether(c.task)}
                  {wrongStep ? (
                    <span className="mt-1 block text-muted">
                      Решение «стажёра» с ошибкой в шаге: <span className="text-text">«{keepNumbersTogether(wrongStep)}»</span>
                    </span>
                  ) : (
                    <span className="mt-1 block text-muted">
                      Покажите решение целиком: <span className="text-text">{c.steps.join(" ")}</span>
                    </span>
                  )}
                </dd>
                <dt className="text-muted">Вопрос классу</dt>
                <dd className="leading-relaxed">{c.hints[1]}</dd>
              </dl>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
