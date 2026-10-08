import { keepNumbersTogether } from "@/lib/format";
import { GradeCircle, MarginCross, Tick } from "@/components/PenMarks";

export type LineState = "idle" | "marked" | "cleared" | "bug";

/**
 * Alibek's solution in blue ballpoint on a squared notebook page. Line numbers sit in the
 * margin, and so do the student's red-pen marks: a cross on the wrong line, a tick on a line
 * that turned out right. Rows are two grid cells tall so the handwriting sits on the squares.
 */
export default function SolutionSheet({
  steps,
  answer,
  lineState,
  onPick,
  interactive = false,
  answerTone = "idle",
  grade = null,
}: {
  steps: string[];
  answer: string;
  lineState: (n: number) => LineState;
  onPick?: (n: number) => void;
  interactive?: boolean;
  answerTone?: "idle" | "good" | "bad";
  /** The red grade the student gives the solution once the round is over. */
  grade?: { mark: string; note: string } | null;
}) {
  const row =
    "group relative block w-full min-h-[calc(var(--grid)*2)] pl-[calc(var(--margin)+0.875rem)] pr-4 text-left sm:pr-6";
  return (
    <div className="notebook-sheet py-[var(--grid)]">
      <ol className="font-hand text-[1.55rem] leading-[calc(var(--grid)*2)] text-intern sm:text-[1.7rem]">
        {steps.map((text, i) => {
          const n = i + 1;
          const state = lineState(n);
          const clickable = interactive && state === "idle";
          const wrong = state === "marked" || state === "bug";
          const content = (
            <>
              <span className="absolute left-2 top-0 font-mono text-sm leading-[calc(var(--grid)*2)] text-faint sm:left-3">
                {n}
              </span>
              {wrong ? (
                <MarginCross className="absolute left-[calc(var(--margin)-1.85rem)] top-2.5 h-6 w-6 text-pen" delay={0} />
              ) : state === "cleared" ? (
                <Tick className="absolute left-[calc(var(--margin)-1.85rem)] top-2.5 h-6 w-6 text-pen" delay={0} />
              ) : null}
              <span className={`${wrong ? "pen-mark" : ""} ${state === "cleared" ? "opacity-60" : ""}`}>
                {keepNumbersTogether(text)}
              </span>
              {wrong ? <span className="sr-only"> (отмечена как ошибка)</span> : null}
              {state === "cleared" ? <span className="sr-only"> (строка верна)</span> : null}
              {clickable ? (
                <span
                  className="pointer-events-none ml-3 hidden text-[1.3rem] text-pen opacity-0 transition group-hover:opacity-100 sm:inline"
                  aria-hidden
                >
                  ← здесь ошибка?
                </span>
              ) : null}
            </>
          );
          // Only selectable lines are buttons; everything else is plain text for screen readers.
          return (
            <li key={n} className={state === "cleared" ? "shake" : undefined}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onPick?.(n)}
                  aria-label={`Строка ${n}: ${text} Отметить как ошибку`}
                  className={`${row} cursor-pointer transition-colors duration-150 hover:bg-pen/[0.06] active:bg-pen/10`}
                >
                  {content}
                </button>
              ) : (
                <div className={row}>{content}</div>
              )}
            </li>
          );
        })}
        <li className={`${row} mt-[var(--grid)]`}>
          <span className="font-sans text-base text-muted">Ответ Алибека: </span>
          <span className={answerTone === "bad" ? "pen-mark" : undefined}>{keepNumbersTogether(answer)}</span>
          {answerTone === "good" ? <Tick className="ml-2 inline-block h-6 w-6 align-[-0.15em] text-pen" delay={0} /> : null}
        </li>
      </ol>

      {grade ? (
        <div className="mt-2 flex items-center justify-end gap-3 pr-6 font-hand text-pen sm:pr-10">
          <span className="-rotate-3 text-[1.6rem]">{grade.note}</span>
          <span className="relative inline-flex h-16 w-20 items-center justify-center" role="img" aria-label={`Оценка: ${grade.mark}`}>
            <GradeCircle className="absolute inset-0 h-full w-full" delay={350} />
            <span className="text-5xl leading-none" aria-hidden>
              {grade.mark}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
