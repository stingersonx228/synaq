"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRightIcon,
  ChatTextIcon,
  CheckIcon,
  FunctionIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  PaperPlaneRightIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { SESSION_LIVES } from "@/lib/catalog";
import { hintPenalty, MAX_HINTS, MAX_REFUTE_TRIES, SCORE, stars } from "@/lib/scoring";
import type { StudentIdentity } from "@/lib/session";
import type { Case, Outcome } from "@/lib/types";
import type { ChatMsg, GameState, Phase, Round } from "./model";
import { Button, Hearts, InternAvatar, Stars, Wordmark } from "./ui";

export const EXPLAIN_MIN = 10;
export const EXPLAIN_MAX = 200;

export const OUTCOME_TITLE: Record<Outcome, string> = {
  solved: "Алибек сдался",
  wrong_line: "Жизни закончились",
  false_accusation: "Ложная тревога",
  missed_clean: "Ошибка проскочила",
  failed_proof: "Доказательство не удалось",
};

// ---------- Top bar ----------

export function TopBar({
  game,
  offline,
  student,
}: {
  game: GameState;
  offline: boolean;
  student: StudentIdentity | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4">
        <Wordmark />
        <RoundTrack game={game} />
        <div className="ml-auto flex items-center gap-4">
          <Hearts lives={Math.max(0, game.lives)} max={SESSION_LIVES} />
          <span className="font-mono text-lg font-semibold tabular-nums" aria-label={`Очки: ${game.total}`}>
            {game.total}
          </span>
          <span className="hidden items-center gap-1.5 text-sm text-muted md:inline-flex">
            {offline ? <WifiSlashIcon size={16} aria-label="Офлайн" /> : null}
            {student ? student.nickname : "гость"}
          </span>
        </div>
      </div>
    </header>
  );
}

function RoundTrack({ game }: { game: GameState }) {
  return (
    <ol className="hidden items-center gap-1.5 sm:flex" aria-label={`Раунд ${game.index + 1} из ${game.caseIds.length}`}>
      {game.caseIds.map((id, i) => {
        const result = game.results[i];
        const tone = result
          ? result.outcome === "solved"
            ? "bg-good"
            : "bg-bad"
          : i === game.index
            ? "bg-pen"
            : "bg-line";
        const label = result
          ? `Раунд ${i + 1}: ${result.outcome === "solved" ? "выигран" : "проигран"}`
          : i === game.index
            ? `Раунд ${i + 1}: идёт`
            : `Раунд ${i + 1}: впереди`;
        return (
          <li key={`${id}-${i}`} title={label} className={`h-1.5 w-7 rounded-full transition-colors duration-300 ${tone}`}>
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Phase steps ----------

const STEPS: { phase: Exclude<Phase, "done">; label: string; Icon: typeof MagnifyingGlassIcon }[] = [
  { phase: "pick", label: "Найди строку", Icon: MagnifyingGlassIcon },
  { phase: "explain", label: "Объясни", Icon: ChatTextIcon },
  { phase: "prove", label: "Докажи", Icon: FunctionIcon },
];

export function PhaseSteps({ phase }: { phase: Phase }) {
  const current = phase === "done" ? STEPS.length : STEPS.findIndex((s) => s.phase === phase);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Шаги раунда">
      {STEPS.map(({ phase: p, label, Icon }, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={p}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-300 sm:text-base ${
              active ? "border-pen bg-pen/10 text-text" : done ? "border-line text-muted" : "border-line/50 text-muted"
            }`}
          >
            {done ? (
              <CheckIcon size={18} className="shrink-0 text-good" aria-hidden />
            ) : (
              <Icon size={18} className={`shrink-0 ${active ? "text-pen" : ""}`} aria-hidden />
            )}
            <span className="truncate">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Alibek ----------

export function internMood(round: Round, clean: boolean): string {
  if (round.phase === "pick") return "уверен в себе";
  if (round.phase !== "done") return "спорит";
  if (round.outcome === "solved") return clean ? "доволен собой" : "сдался";
  return "торжествует";
}

export function InternPanel({
  chat,
  typing,
  mood,
  c,
  hintsUsed,
  hintsDisabled,
  onHint,
}: {
  chat: ChatMsg[];
  typing: boolean;
  mood: string;
  c: Case;
  hintsUsed: number;
  hintsDisabled: boolean;
  onHint: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat.length, typing]);

  return (
    <aside className="flex flex-col rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <InternAvatar size="lg" />
        <div>
          <p className="font-display text-lg font-bold">Алибек</p>
          <p className="text-sm text-muted">
            ИИ-стажёр, сейчас <span className="text-intern">{mood}</span>
          </p>
        </div>
      </div>

      <ol ref={listRef} className="flex max-h-[24rem] min-h-[12rem] flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {chat.map((m) => (
          <ChatBubble key={m.key} msg={m} />
        ))}
        {typing ? <TypingBubble /> : null}
      </ol>

      <div className="border-t border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-medium">
            <LightbulbIcon size={18} className="text-pen" aria-hidden />
            Подсказки
          </p>
          {hintsUsed < MAX_HINTS ? (
            <button
              type="button"
              onClick={onHint}
              disabled={hintsDisabled}
              className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium transition hover:border-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              Открыть подсказку <span className="font-mono text-bad">−{SCORE.hintCost[hintsUsed]}</span>
            </button>
          ) : (
            <span className="text-sm text-muted">все открыты</span>
          )}
        </div>
        {hintsUsed > 0 ? (
          <ol className="mt-3 flex flex-col gap-2">
            {c.hints.slice(0, hintsUsed).map((h, i) => (
              <li key={i} className="rise flex gap-2 text-base leading-snug">
                <span className="font-mono text-pen">{i + 1}</span>
                <span>{h}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </aside>
  );
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  if (msg.from === "student") {
    return (
      <li className="rise flex justify-end">
        <p className="max-w-[88%] rounded-xl rounded-br-sm bg-pen/12 px-4 py-2.5 leading-snug ring-1 ring-pen/30">
          {msg.text}
        </p>
      </li>
    );
  }
  return (
    <li className="rise flex">
      <p
        className={`max-w-[88%] rounded-xl rounded-bl-sm px-4 py-2.5 leading-snug ${
          msg.tone === "concede" ? "bg-good/15 ring-1 ring-good/50" : "bg-surface-2"
        }`}
      >
        {msg.text}
      </p>
    </li>
  );
}

function TypingBubble() {
  return (
    <li className="flex" aria-label="Алибек печатает">
      <span className="inline-flex gap-1 rounded-xl rounded-bl-sm bg-surface-2 px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot h-2 w-2 rounded-full bg-muted" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
    </li>
  );
}

/** On phones the chat sits below the sheet, so the latest reply is repeated next to the action. */
export function LatestReply({ chat, typing }: { chat: ChatMsg[]; typing: boolean }) {
  const last = [...chat].reverse().find((m) => m.from === "intern");
  if (!last && !typing) return null;
  return (
    <div className="flex items-start gap-3 lg:hidden" aria-hidden>
      <InternAvatar size="sm" />
      <p
        key={typing ? "typing" : last?.key}
        className={`rise rounded-xl rounded-tl-sm px-4 py-2.5 leading-snug ${
          last?.tone === "concede" && !typing ? "bg-good/15 ring-1 ring-good/50" : "bg-surface-2"
        }`}
      >
        {typing ? "Алибек печатает…" : last?.text}
      </p>
    </div>
  );
}

// ---------- Actions ----------

export function PickActions({ onClean, disabled }: { onClean: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-lg text-muted">Нажми на строку, где Алибек ошибся. Или проверь всё и скажи, что ошибок нет.</p>
      <Button variant="secondary" onClick={onClean} disabled={disabled}>
        <CheckIcon size={18} aria-hidden />
        Ошибок нет
      </Button>
    </div>
  );
}

export function ExplainForm({
  line,
  disabled,
  onSubmit,
}: {
  line: number | null;
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const len = text.trim().length;
  const ok = len >= EXPLAIN_MIN && text.length <= EXPLAIN_MAX;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ok && !disabled) onSubmit(text);
  };
  return (
    <form onSubmit={submit} className="rise flex flex-col gap-3">
      <label htmlFor="explain" className="text-lg font-medium">
        Что не так в строке {line}? Объясни своими словами.
      </label>
      <textarea
        id="explain"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, EXPLAIN_MAX))}
        maxLength={EXPLAIN_MAX}
        rows={3}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
        }}
        placeholder="Например: он посчитал… а надо…"
        className="w-full resize-none rounded-xl border border-line bg-ink px-4 py-3 text-lg outline-none transition placeholder:text-muted focus:border-pen"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`font-mono text-sm tabular-nums ${len > 0 && len < EXPLAIN_MIN ? "text-bad" : "text-muted"}`}>
          {text.length}/{EXPLAIN_MAX}
          {len < EXPLAIN_MIN ? `, ещё минимум ${EXPLAIN_MIN - len}` : ""}
        </span>
        <Button type="submit" disabled={!ok || disabled}>
          <PaperPlaneRightIcon size={18} weight="fill" aria-hidden />
          Отправить Алибеку
        </Button>
      </div>
    </form>
  );
}

export function ProofForm({
  c,
  tries,
  feedback,
  disabled,
  onSubmit,
}: {
  c: Case;
  tries: number;
  feedback: string | null;
  disabled: boolean;
  onSubmit: (raw: Record<string, string>) => void;
}) {
  const spec = c.bug!.refute;
  const [raw, setRaw] = useState<Record<string, string>>(() => Object.fromEntries(spec.vars.map((v) => [v, ""])));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) onSubmit(raw);
  };
  return (
    <form onSubmit={submit} className="rise flex flex-col gap-4">
      <p className="text-lg font-medium leading-snug">{spec.prompt}</p>
      <div className="flex flex-wrap gap-3">
        {spec.vars.map((v, i) => (
          <label key={v} className="flex items-center gap-2">
            <span className="font-mono text-xl text-pen">{v} =</span>
            <input
              value={raw[v] ?? ""}
              onChange={(e) => setRaw((r) => ({ ...r, [v]: e.target.value.slice(0, 24) }))}
              inputMode="decimal"
              autoComplete="off"
              autoFocus={i === 0}
              className="w-36 rounded-xl border border-line bg-ink px-4 py-3 font-mono text-xl tabular-nums outline-none transition focus:border-pen"
              aria-label={`Значение ${v}`}
            />
          </label>
        ))}
      </div>
      {feedback ? (
        <p key={feedback + tries} className="rise rounded-xl border border-bad/40 bg-bad/10 px-4 py-3" role="status">
          {feedback}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-muted">
          Попытки
          <span className="flex gap-1" aria-label={`Осталось попыток: ${MAX_REFUTE_TRIES - tries}`}>
            {Array.from({ length: MAX_REFUTE_TRIES }, (_, i) => (
              <span key={i} className={`h-2 w-5 rounded-full ${i < tries ? "bg-bad" : "bg-line"}`} />
            ))}
          </span>
          {tries === 0 ? <span>с первой +{SCORE.firstTry}</span> : null}
        </span>
        <Button type="submit" disabled={disabled}>
          Проверить доказательство
        </Button>
      </div>
    </form>
  );
}

// ---------- Debrief ----------

export function RoundDebrief({
  c,
  round,
  isLast,
  onNext,
}: {
  c: Case;
  round: Round;
  isLast: boolean;
  onNext: () => void;
}) {
  const outcome = round.outcome!;
  const won = outcome === "solved";
  const ref = useRef<HTMLDivElement>(null);
  // On phones the debrief appears below the fold; bring it into view once.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
  return (
    <div ref={ref} className="rise flex scroll-mt-20 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className={`font-display text-2xl font-bold sm:text-3xl ${won ? "text-good" : "text-bad"}`}>
          {c.bug ? OUTCOME_TITLE[outcome] : won ? "Верно, ошибок нет" : OUTCOME_TITLE[outcome]}
        </h2>
        <div className="flex items-center gap-3">
          <Stars count={stars(round.score)} size={26} />
          <span className="font-mono text-2xl font-semibold tabular-nums">+{round.score}</span>
        </div>
      </div>

      {won && c.bug ? <ScoreBreakdown round={round} /> : null}

      {c.bug ? (
        <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted">Ошибка в строке {c.bug.accept_steps.join(", ")}</dt>
          <dd className="text-lg leading-relaxed">{c.bug.cause}</dd>
          <dt className="text-muted">Как правильно</dt>
          <dd className="text-lg leading-relaxed">{c.bug.fix}</dd>
          <dt className="text-muted">Верный ответ</dt>
          <dd className="font-display text-xl font-bold text-good">{c.bug.correct_answer}</dd>
        </dl>
      ) : (
        <p className="text-lg leading-relaxed">
          Решение было верным, ответ <span className="font-semibold text-good">{c.answer}</span>.{" "}
          {won
            ? "Иногда стажёр не ошибается, и честная проверка тоже победа."
            : "Прежде чем обвинять строку, подставь ответ в исходное уравнение."}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} variant={won ? "good" : "primary"}>
          {isLast ? "Итоги" : "Следующий раунд"}
          <ArrowRightIcon size={18} weight="bold" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function ScoreBreakdown({ round }: { round: Round }) {
  const items: [string, number][] = [["Ошибка найдена и доказана", SCORE.found]];
  if (round.causeOk) items.push(["Причина названа верно", SCORE.causeOk]);
  if (round.refuteTries === 1) items.push(["С первой попытки", SCORE.firstTry]);
  if (round.hintsUsed > 0) items.push([`Подсказки: ${round.hintsUsed}`, -hintPenalty(round.hintsUsed)]);
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {items.map(([label, pts]) => (
        <li key={label} className="rounded-full bg-surface-2 px-3 py-1">
          {label}{" "}
          <span className={`font-mono ${pts >= 0 ? "text-good" : "text-bad"}`}>
            {pts >= 0 ? "+" : "−"}
            {Math.abs(pts)}
          </span>
        </li>
      ))}
      {round.causeOk === false ? (
        <li className="rounded-full bg-surface-2 px-3 py-1 text-muted">Причина не распознана, бонус не начислен</li>
      ) : null}
    </ul>
  );
}
