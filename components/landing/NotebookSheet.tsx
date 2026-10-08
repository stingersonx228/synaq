import { keepNumbersTogether } from "@/lib/format";
import type { Case } from "@/lib/types";
import { GradeCircle, MarginCross } from "@/components/PenMarks";

/**
 * The landing preview: the intern's solution in blue ballpoint on a squared notebook page,
 * already checked by a student in red pen. Rows are two grid cells tall so the handwriting
 * sits on the squares.
 */
export default function NotebookSheet({ c, wrongLine, note }: { c: Case; wrongLine: number; note: string }) {
  const row = "relative pl-[calc(var(--margin)+0.875rem)] pr-5 sm:pr-8";
  return (
    <figure className="notebook-sheet py-[var(--grid)] lg:rotate-[0.6deg]">
      <figcaption className="sr-only">
        Пример: решение стажёра Алибека с пометками ученика. Ошибка в строке {wrongLine}.
      </figcaption>
      <p className={`${row} text-base leading-[var(--grid)] text-muted`}>{keepNumbersTogether(c.task)}</p>

      <ol className="mt-[var(--grid)] font-hand text-[1.55rem] leading-[calc(var(--grid)*2)] text-intern sm:text-[1.7rem]">
        {c.steps.map((step, i) => {
          const n = i + 1;
          const wrong = n === wrongLine;
          return (
            <li key={n} className={row}>
              {wrong ? (
                <MarginCross
                  className="absolute left-[calc(var(--margin)/2-0.75rem)] top-2.5 h-6 w-6 text-pen"
                  delay={500}
                />
              ) : null}
              <span className={wrong ? "pen-mark" : undefined}>{keepNumbersTogether(step)}</span>
              {wrong ? (
                <span className="block -rotate-2 pl-6 text-pen">
                  <span className="sr-only">Пометка ученика: </span>
                  {note}
                </span>
              ) : null}
            </li>
          );
        })}
        <li className={row}>
          <span className="font-sans text-base text-muted">Ответ: </span>
          {keepNumbersTogether(c.answer)}
        </li>
      </ol>

      <div className="mt-[var(--grid)] flex items-center justify-end gap-3 pr-6 font-hand text-pen sm:pr-10">
        <span className="text-[1.6rem] -rotate-3">Перепроверь!</span>
        <span className="relative inline-flex h-16 w-20 items-center justify-center" role="img" aria-label="Оценка: 2">
          <GradeCircle className="absolute inset-0 h-full w-full" delay={1100} />
          <span className="text-5xl leading-none" aria-hidden>
            2
          </span>
        </span>
      </div>
    </figure>
  );
}
