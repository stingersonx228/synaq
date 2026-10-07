import { CheckIcon, PenNibIcon } from "@phosphor-icons/react/dist/ssr";
import { keepNumbersTogether } from "@/lib/format";

export type LineState = "idle" | "marked" | "cleared" | "bug";

/**
 * Alibek's solution as numbered lines on a sheet. Pure presentation: the game passes
 * per-line states and a click handler; the landing page renders it statically.
 */
export default function SolutionSheet({
  steps,
  answer,
  lineState,
  onPick,
  interactive = false,
  answerTone = "idle",
  compact = false,
}: {
  steps: string[];
  answer: string;
  lineState: (n: number) => LineState;
  onPick?: (n: number) => void;
  interactive?: boolean;
  answerTone?: "idle" | "good" | "bad";
  compact?: boolean;
}) {
  return (
    <div>
      <ol className="flex flex-col">
        {steps.map((text, i) => {
          const n = i + 1;
          const state = lineState(n);
          const clickable = interactive && state === "idle";
          const rowClass = `group relative grid w-full grid-cols-[2.25rem_1fr_auto] items-start gap-3 rounded-xl px-2 ${
            compact ? "py-2" : "py-3"
          } text-left transition duration-150 sm:px-3 ${
            clickable ? "cursor-pointer hover:bg-surface-2 active:scale-[0.995]" : ""
          } ${state === "cleared" ? "shake" : ""}`;
          const content = (
            <>
              <span
                className={`pt-0.5 text-right font-mono text-base tabular-nums ${
                  state === "marked" || state === "bug" ? "text-pen" : "text-muted"
                }`}
              >
                {n}
              </span>
              <span
                className={`${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"} leading-relaxed ${
                  state === "marked" || state === "bug" ? "pen-mark" : ""
                } ${state === "cleared" ? "text-muted" : ""}`}
              >
                {keepNumbersTogether(text)}
              </span>
              <LineTag state={state} clickable={clickable} />
            </>
          );
          // Only selectable lines are buttons; everything else is plain text for screen readers.
          return (
            <li key={n}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onPick?.(n)}
                  aria-label={`Строка ${n}: ${text}. Отметить как ошибку`}
                  className={rowClass}
                >
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      <div
        className={`mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-dashed px-4 py-3 ${
          answerTone === "good" ? "border-good/60" : answerTone === "bad" ? "border-pen/60" : "border-line"
        }`}
      >
        <span className="text-muted">Ответ Алибека</span>
        <span className="text-xl font-semibold">{keepNumbersTogether(answer)}</span>
      </div>
    </div>
  );
}

function LineTag({ state, clickable }: { state: LineState; clickable: boolean }) {
  if (state === "marked" || state === "bug") {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-pen/15 px-2.5 py-0.5 text-sm font-medium text-pen">
        <PenNibIcon size={14} weight="fill" aria-hidden />
        ошибка
      </span>
    );
  }
  if (state === "cleared") {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-sm text-muted">
        <CheckIcon size={14} aria-hidden />
        верно
      </span>
    );
  }
  if (clickable) {
    return (
      <span className="pointer-events-none absolute right-3 top-3 hidden items-center gap-1 rounded-full bg-ink/90 px-2.5 py-0.5 text-sm text-pen opacity-0 transition group-hover:opacity-100 sm:inline-flex">
        <PenNibIcon size={16} aria-hidden />
        отметить
      </span>
    );
  }
  return <span />;
}
