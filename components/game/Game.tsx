"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  getCase,
  INTERN_LINES,
  pickReplacement,
  pickSessionCases,
  SESSION_LIVES,
  typeName,
} from "@/lib/catalog";
import { fetchInternReply, fetchJudgeVerdict, saveAttempt, type NetOptions } from "@/lib/client";
import { checkRefutation, explainRefutation, parseValues } from "@/lib/refute";
import { blindSpots, hintPenalty, MAX_HINTS, MAX_REFUTE_TRIES, roundScore, SCORE, stars } from "@/lib/scoring";
import { getStudent, recordSession, setStudent, type StudentIdentity } from "@/lib/session";
import type { Case, Outcome } from "@/lib/types";
import { Button, Hearts, InternAvatar, Panel, Stars } from "./ui";

const EXPLAIN_MIN = 10;
const EXPLAIN_MAX = 200;
const TYPING_MS = 500;

type Phase = "pick" | "explain" | "prove" | "done";

interface ChatMsg {
  key: string;
  from: "intern" | "student";
  text: string;
  tone?: "concede" | "neutral";
}

interface Round {
  token: number;
  caseId: string;
  phase: Phase;
  wrongLines: number[];
  foundLine: number | null;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  proofFeedback: string | null;
  chat: ChatMsg[];
  typing: boolean;
  outcome: Outcome | null;
  livesLost: number;
  score: number;
}

interface RoundResult {
  caseId: string;
  typeId: string;
  outcome: Outcome;
  score: number;
  stars: number;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  livesLost: number;
}

interface GameState {
  caseIds: string[];
  index: number;
  lives: number;
  total: number;
  results: RoundResult[];
  round: Round;
  over: boolean;
  flash: { kind: "good" | "bad"; key: number } | null;
}

function newRound(caseId: string, token: number): Round {
  return {
    token,
    caseId,
    phase: "pick",
    wrongLines: [],
    foundLine: null,
    hintsUsed: 0,
    causeOk: null,
    refuteTries: 0,
    proofFeedback: null,
    chat: [{ key: `${token}-0`, from: "intern", text: INTERN_LINES.greeting }],
    typing: false,
    outcome: null,
    livesLost: 0,
    score: 0,
  };
}

function newGame(fixedCaseId: string | null, token: number): GameState {
  const caseIds = fixedCaseId ? [fixedCaseId] : pickSessionCases();
  return {
    caseIds,
    index: 0,
    lives: SESSION_LIVES,
    total: 0,
    results: [],
    round: newRound(caseIds[0], token),
    over: false,
    flash: null,
  };
}

function addMsg(round: Round, from: ChatMsg["from"], text: string, tone?: ChatMsg["tone"]): Round {
  return { ...round, chat: [...round.chat, { key: `${round.token}-${round.chat.length}`, from, text, tone }] };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OUTCOME_TITLE: Record<Outcome, string> = {
  solved: "Раунд выигран",
  wrong_line: "Жизни закончились",
  false_accusation: "Ложная тревога",
  missed_clean: "Ошибка проскочила",
  failed_proof: "Доказательство не удалось",
};

export default function Game({ fixedCaseId, offline }: { fixedCaseId: string | null; offline: boolean }) {
  const tokenRef = useRef(1);
  const [game, setGame] = useState<GameState>(() => newGame(fixedCaseId, 1));
  const [student, setStudentState] = useState<StudentIdentity | null>(() => (offline ? null : getStudent()));
  const judgeRef = useRef<{ token: number; verdict: Promise<boolean> } | null>(null);
  const explanationRef = useRef("");
  const savedRef = useRef(new WeakSet<RoundResult>());

  const { round } = game;
  const c = getCase(round.caseId) as Case;
  const net: NetOptions = { offline, studentId: student?.studentId ?? null };
  const busy = round.typing;

  const nextToken = () => ++tokenRef.current;

  // Sends each finished round to the class dashboard once (results are compared by identity).
  const studentId = student?.studentId ?? null;
  useEffect(() => {
    if (offline || !studentId) return;
    for (const r of game.results) {
      if (savedRef.current.has(r)) continue;
      savedRef.current.add(r);
      const { caseId, outcome, hintsUsed, causeOk, refuteTries, livesLost } = r;
      void saveAttempt({ studentId, caseId, outcome, hintsUsed, causeOk, refuteTries, livesLost }).then((status) => {
        if (status === "unauthorized") {
          setStudent(null);
          setStudentState(null);
        }
      });
    }
  }, [game.results, offline, studentId]);

  /** Applies `fn` to the round only if it is still the same round (guards async replies). */
  const updateRound = (token: number, fn: (r: Round) => Round) =>
    setGame((g) => (g.round.token === token ? { ...g, round: fn(g.round) } : g));

  async function internSays(token: number, text: Promise<string> | string, tone?: ChatMsg["tone"]) {
    updateRound(token, (r) => ({ ...r, typing: true }));
    const [reply] = await Promise.all([text, wait(TYPING_MS)]);
    updateRound(token, (r) => addMsg({ ...r, typing: false }, "intern", reply, tone));
  }

  function finishRound(token: number, outcome: Outcome, patch: Partial<Round>, lifeLost: boolean) {
    setGame((g) => {
      if (g.round.token !== token) return g;
      const r = { ...g.round, ...patch };
      const livesLost = r.livesLost + (lifeLost ? 1 : 0);
      const score = roundScore({
        outcome,
        clean: c.bug === null,
        causeOk: r.causeOk,
        refuteTries: r.refuteTries,
        hintsUsed: r.hintsUsed,
      });
      const result: RoundResult = {
        caseId: r.caseId,
        typeId: c.type_id,
        outcome,
        score,
        stars: stars(score),
        hintsUsed: r.hintsUsed,
        causeOk: r.causeOk,
        refuteTries: r.refuteTries,
        livesLost,
      };
      return {
        ...g,
        lives: g.lives - (lifeLost ? 1 : 0),
        total: g.total + score,
        results: [...g.results, result],
        flash: { kind: outcome === "solved" ? "good" : "bad", key: Date.now() },
        round: { ...r, phase: "done", outcome, livesLost, score, typing: false },
      };
    });
  }

  function loseLife(token: number) {
    setGame((g) =>
      g.round.token === token
        ? {
            ...g,
            lives: g.lives - 1,
            flash: { kind: "bad", key: Date.now() },
            round: { ...g.round, livesLost: g.round.livesLost + 1 },
          }
        : g,
    );
  }

  function pickLine(step: number) {
    if (round.phase !== "pick" || busy || round.wrongLines.includes(step)) return;
    const token = round.token;
    updateRound(token, (r) => addMsg(r, "student", `Ошибка в строке ${step}.`));
    if (!c.bug) {
      updateRound(token, (r) => addMsg(r, "intern", c.falseAccusation ?? ""));
      finishRound(token, "false_accusation", {}, true);
      return;
    }
    if (c.bug.accept_steps.includes(step)) {
      updateRound(token, (r) => ({ ...r, phase: "explain", foundLine: step }));
      void internSays(token, "Ну и что там, по-твоему, не так? Объясни.");
      return;
    }
    updateRound(token, (r) => ({ ...r, wrongLines: [...r.wrongLines, step] }));
    if (game.lives - 1 <= 0) {
      updateRound(token, (r) => addMsg(r, "intern", INTERN_LINES.wrongLine(step)));
      finishRound(token, "wrong_line", {}, true);
      return;
    }
    loseLife(token);
    void internSays(token, INTERN_LINES.wrongLine(step));
  }

  function declareClean() {
    if (round.phase !== "pick" || busy) return;
    const token = round.token;
    updateRound(token, (r) => addMsg(r, "student", "Ошибок нет."));
    if (!c.bug) {
      updateRound(token, (r) => addMsg(r, "intern", INTERN_LINES.cleanWin, "concede"));
      finishRound(token, "solved", {}, false);
    } else {
      updateRound(token, (r) => addMsg(r, "intern", INTERN_LINES.missedBug));
      finishRound(token, "missed_clean", {}, true);
    }
  }

  function submitExplanation(text: string) {
    const clean = text.trim().replace(/\s+/g, " ");
    if (round.phase !== "explain" || busy || clean.length < EXPLAIN_MIN) return;
    const token = round.token;
    updateRound(token, (r) => ({ ...addMsg(r, "student", clean), phase: "prove" }));
    const verdict = fetchJudgeVerdict(c.id, clean, net);
    judgeRef.current = { token, verdict };
    void verdict.then((v) => updateRound(token, (r) => ({ ...r, causeOk: v })));
    explanationRef.current = clean;
    void internSays(token, fetchInternReply(c.id, 0, clean, net));
  }


  async function submitProof(raw: Record<string, string>) {
    if (round.phase !== "prove" || busy || !c.bug) return;
    const token = round.token;
    const bug = c.bug;
    const result = checkRefutation(bug.refute, parseValues(bug.refute.vars, raw));
    if (!result.ok && result.reason === "invalid_input") {
      updateRound(token, (r) => ({ ...r, proofFeedback: explainRefutation(result) }));
      return;
    }
    const tries = round.refuteTries + 1;
    const shown = bug.refute.vars.map((v) => `${v} = ${raw[v]?.trim()}`).join(", ");
    updateRound(token, (r) => addMsg({ ...r, refuteTries: tries }, "student", `Проверь при ${shown}.`));

    if (result.ok) {
      updateRound(token, (r) => ({ ...r, proofFeedback: null, typing: true }));
      const pending = judgeRef.current?.token === token ? judgeRef.current.verdict : Promise.resolve(false);
      const [causeOk] = await Promise.all([pending, wait(TYPING_MS)]);
      updateRound(token, (r) => addMsg({ ...r, typing: false, causeOk }, "intern", bug.concede, "concede"));
      finishRound(token, "solved", { causeOk, refuteTries: tries }, false);
      return;
    }

    const feedback = explainRefutation(result);
    if (tries >= MAX_REFUTE_TRIES) {
      updateRound(token, (r) => addMsg({ ...r, proofFeedback: feedback }, "intern", "Три попытки — и ничего. Значит, я прав!"));
      finishRound(token, "failed_proof", {}, true);
      return;
    }
    updateRound(token, (r) => ({ ...r, proofFeedback: feedback }));
    const reply =
      tries === 1
        ? fetchInternReply(c.id, 1, explanationRef.current, net)
        : INTERN_LINES.proofFailed[result.reason];
    await internSays(token, reply);
  }

  function openHint() {
    if (round.phase === "done" || round.hintsUsed >= MAX_HINTS) return;
    updateRound(round.token, (r) => ({ ...r, hintsUsed: r.hintsUsed + 1 }));
  }

  function swapIntern() {
    if (round.phase === "done") return;
    const replacement = pickReplacement(round.caseId, game.caseIds);
    if (!replacement) return;
    const token = nextToken();
    judgeRef.current = null;
    setGame((g) => {
      const caseIds = [...g.caseIds];
      caseIds[g.index] = replacement;
      return { ...g, caseIds, round: newRound(replacement, token) };
    });
  }

  function nextRound() {
    const nextIndex = game.index + 1;
    if (game.lives <= 0 || nextIndex >= game.caseIds.length) {
      const spots = blindSpots(game.results);
      recordSession({
        finishedAt: new Date().toISOString(),
        score: game.total,
        rounds: game.results.length,
        solved: game.results.filter((r) => r.outcome === "solved").length,
        blindSpots: spots,
      });
      setGame((g) => ({ ...g, over: true, flash: null }));
      return;
    }
    const token = nextToken();
    judgeRef.current = null;
    setGame((g) => ({ ...g, index: nextIndex, round: newRound(g.caseIds[nextIndex], token), flash: null }));
  }

  function restart() {
    judgeRef.current = null;
    setGame(newGame(fixedCaseId, nextToken()));
  }

  const flash = game.flash ? (
    <div
      key={game.flash.key}
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-50 ${game.flash.kind === "good" ? "flash-good" : "flash-bad"}`}
    />
  ) : null;

  if (game.over) {
    return (
      <SessionSummary
        game={game}
        fixedCaseId={fixedCaseId}
        offline={offline}
        student={student}
        onRestart={restart}
      />
    );
  }

  const solvedGreen = round.phase === "done" && round.outcome === "solved";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      {flash}
      <header className="sticky top-0 z-40 -mx-4 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
        <Link href="/" className="font-bold text-accent">
          Обратный экзамен
        </Link>
        <Hearts lives={game.lives} max={SESSION_LIVES} />
        <span className="font-semibold tabular-nums">
          {game.total} <span className="text-muted">очков</span>
        </span>
        <span className="text-muted">
          Раунд {game.index + 1}/{game.caseIds.length}
        </span>
        <span className="ml-auto flex items-center gap-2 text-sm text-muted">
          {offline ? <span className="rounded-full border border-line px-2 py-0.5">офлайн</span> : null}
          {student ? <span>{student.nickname}</span> : <span>без регистрации</span>}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel
            title={
              <span className="flex items-center justify-between gap-2">
                <span>
                  Задача · {c.topic} · {c.level} класс
                </span>
                {round.phase !== "done" ? (
                  <button
                    type="button"
                    onClick={swapIntern}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 normal-case tracking-normal text-muted hover:bg-panel-2 hover:text-text"
                    title="Заменить задачу на другую из каталога"
                  >
                    <span aria-hidden>⇄</span> Запасной стажёр
                  </button>
                ) : null}
              </span>
            }
          >
            <p className="text-xl font-medium leading-relaxed sm:text-2xl">{c.task}</p>
          </Panel>

          <Panel
            className={`transition-colors duration-500 ${solvedGreen ? "border-good bg-good/10" : ""}`}
            title={
              <span className="flex items-center gap-2 normal-case tracking-normal">
                <InternAvatar size="h-7 w-7 text-sm" />
                <span className="text-text">Решение Алибека</span>
                <span className="text-muted">— стажёр, уверенный в себе</span>
              </span>
            }
          >
            <SolutionSteps c={c} round={round} onPick={pickLine} disabled={round.phase !== "pick" || busy} />
            <div className="mt-3 rounded-xl bg-panel-2 px-4 py-3 text-lg">
              <span className="text-muted">Ответ Алибека: </span>
              <span className="font-semibold">{c.answer}</span>
            </div>
            {round.phase === "pick" ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-muted">Нажми на строку с ошибкой — или:</p>
                <Button variant="secondary" onClick={declareClean} disabled={busy}>
                  Ошибок нет
                </Button>
              </div>
            ) : null}
          </Panel>

          {round.phase === "explain" ? (
            <ExplainForm key={round.token} disabled={busy} onSubmit={submitExplanation} line={round.foundLine} />
          ) : null}
          {round.phase === "prove" && c.bug ? (
            <ProofForm
              key={round.token}
              c={c}
              tries={round.refuteTries}
              feedback={round.proofFeedback}
              disabled={busy}
              onSubmit={submitProof}
            />
          ) : null}
          {round.phase === "done" && round.outcome ? (
            <RoundDebrief
              c={c}
              round={round}
              isLast={game.lives <= 0 || game.index + 1 >= game.caseIds.length}
              onNext={nextRound}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Chat chat={round.chat} typing={round.typing} />
          <Hints c={c} used={round.hintsUsed} disabled={round.phase === "done"} onOpen={openHint} />
        </div>
      </div>
    </div>
  );
}

function SolutionSteps({
  c,
  round,
  onPick,
  disabled,
}: {
  c: Case;
  round: Round;
  onPick: (step: number) => void;
  disabled: boolean;
}) {
  const reveal = round.phase === "done";
  return (
    <ol className="flex flex-col gap-2">
      {c.steps.map((text, i) => {
        const n = i + 1;
        const wrongPick = round.wrongLines.includes(n);
        const found = round.foundLine === n;
        const isBug = reveal && c.bug?.accept_steps.includes(n);
        const state = isBug
          ? "border-bad bg-bad/10"
          : found
            ? "border-accent bg-accent/10"
            : wrongPick
              ? "border-line opacity-50 line-through decoration-bad/60"
              : "border-line hover:border-muted hover:bg-panel-2";
        return (
          <li key={n}>
            <button
              type="button"
              onClick={() => onPick(n)}
              disabled={disabled || wrongPick}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-lg leading-snug transition disabled:cursor-default ${state} ${wrongPick ? "shake" : ""}`}
            >
              <span className="mt-0.5 w-6 shrink-0 text-right font-mono text-base text-muted">{n}</span>
              <span className="flex-1">{text}</span>
              {isBug ? <span className="shrink-0 rounded bg-bad/20 px-2 text-sm text-bad">ошибка</span> : null}
              {found && !reveal ? <span className="shrink-0 rounded bg-accent/20 px-2 text-sm text-accent">нашёл</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ExplainForm({
  onSubmit,
  disabled,
  line,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
  line: number | null;
}) {
  const [text, setText] = useState("");
  const len = text.trim().length;
  const ok = len >= EXPLAIN_MIN && text.length <= EXPLAIN_MAX;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ok && !disabled) onSubmit(text);
  };
  return (
    <Panel title={`Шаг 2 · Объясни, в чём ошибка в строке ${line ?? ""}`} className="pop-in">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, EXPLAIN_MAX))}
          maxLength={EXPLAIN_MAX}
          rows={3}
          placeholder="Например: он сделал… а надо…"
          className="w-full resize-none rounded-xl border border-line bg-ink px-3 py-2 text-lg outline-none focus:border-accent"
          aria-label="Объяснение ошибки"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-sm tabular-nums ${len > 0 && len < EXPLAIN_MIN ? "text-bad" : "text-muted"}`}>
            {text.length}/{EXPLAIN_MAX} · минимум {EXPLAIN_MIN}
          </span>
          <Button type="submit" disabled={!ok || disabled}>
            Отправить Алибеку
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ProofForm({
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
  const left = MAX_REFUTE_TRIES - tries;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) onSubmit(raw);
  };
  return (
    <Panel title="Шаг 3 · Докажи на числах" className="pop-in">
      <p className="mb-3 text-lg leading-snug">{spec.prompt}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          {spec.vars.map((v) => (
            <label key={v} className="flex items-center gap-2 text-lg">
              <span className="font-mono text-accent">{v} =</span>
              <input
                value={raw[v] ?? ""}
                onChange={(e) => setRaw((r) => ({ ...r, [v]: e.target.value.slice(0, 24) }))}
                inputMode="decimal"
                autoComplete="off"
                className="w-32 rounded-xl border border-line bg-ink px-3 py-2 text-lg tabular-nums outline-none focus:border-accent"
                aria-label={`Значение ${v}`}
              />
            </label>
          ))}
        </div>
        {feedback ? (
          <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-base" role="status">
            {feedback}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted">
            Попыток осталось: {left} · с первой попытки +{SCORE.firstTry}
          </span>
          <Button type="submit" disabled={disabled}>
            Проверить
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function RoundDebrief({ c, round, isLast, onNext }: { c: Case; round: Round; isLast: boolean; onNext: () => void }) {
  const outcome = round.outcome!;
  const won = outcome === "solved";
  const bugLines = c.bug?.accept_steps.join(", ");
  return (
    <Panel className={`pop-in ${won ? "border-good" : "border-bad"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`text-2xl font-bold ${won ? "text-good" : "text-bad"}`}>{OUTCOME_TITLE[outcome]}</h2>
        <div className="flex items-center gap-3">
          <Stars count={stars(round.score)} size="text-2xl" />
          <span className="text-xl font-semibold tabular-nums">+{round.score}</span>
        </div>
      </div>
      {c.bug ? (
        <ScoreBreakdown round={round} />
      ) : null}
      <div className="mt-4 flex flex-col gap-3 text-lg leading-relaxed">
        {c.bug ? (
          <>
            <p>
              <span className="text-muted">Ошибка в строке {bugLines}: </span>
              {c.bug.cause}
            </p>
            <p>
              <span className="text-muted">Как правильно: </span>
              {c.bug.fix}
            </p>
            <p>
              <span className="text-muted">Верный ответ: </span>
              <span className="font-semibold text-good">{c.bug.correct_answer}</span>
            </p>
          </>
        ) : (
          <p>
            <span className="text-muted">Решение было верным. </span>
            Ответ Алибека <span className="font-semibold text-good">{c.answer}</span> правильный.{" "}
            {won
              ? "Иногда стажёр не ошибается, и честная проверка — тоже победа."
              : "Прежде чем обвинять строку, проверь её сам: подставь ответ в исходное уравнение."}
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onNext} variant={won ? "good" : "primary"}>
          {isLast ? "Итоги" : "Следующий раунд →"}
        </Button>
      </div>
    </Panel>
  );
}

function ScoreBreakdown({ round }: { round: Round }) {
  if (round.outcome !== "solved") return null;
  const items: [string, number][] = [["Нашёл и доказал", SCORE.found]];
  if (round.causeOk) items.push(["Причина названа верно", SCORE.causeOk]);
  if (round.refuteTries === 1) items.push(["С первой попытки", SCORE.firstTry]);
  if (round.hintsUsed > 0) items.push([`Подсказки (${round.hintsUsed})`, -hintPenalty(round.hintsUsed)]);
  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-sm">
      {items.map(([label, pts]) => (
        <li key={label} className="rounded-full border border-line px-3 py-1">
          {label}{" "}
          <span className={pts >= 0 ? "text-good" : "text-bad"}>
            {pts >= 0 ? "+" : "−"}
            {Math.abs(pts)}
          </span>
        </li>
      ))}
      {round.causeOk === false ? (
        <li className="rounded-full border border-line px-3 py-1 text-muted">Причину назвать не получилось</li>
      ) : null}
    </ul>
  );
}

function Chat({ chat, typing }: { chat: ChatMsg[]; typing: boolean }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat.length, typing]);
  return (
    <Panel title="Разговор с Алибеком">
      <ul ref={listRef} className="flex max-h-[22rem] lg:max-h-[26rem] flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
        {chat.map((m) =>
          m.from === "intern" ? (
            <li key={m.key} className="pop-in flex items-end gap-2">
              <InternAvatar />
              <p
                className={`max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2 text-base leading-snug ${
                  m.tone === "concede" ? "bg-good/20 text-text ring-1 ring-good/50" : "bg-panel-2"
                }`}
              >
                {m.text}
              </p>
            </li>
          ) : (
            <li key={m.key} className="pop-in flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent/15 px-4 py-2 text-base leading-snug ring-1 ring-accent/30">
                {m.text}
              </p>
            </li>
          ),
        )}
        {typing ? (
          <li className="flex items-end gap-2 text-muted">
            <InternAvatar />
            <span className="animate-pulse">Алибек печатает…</span>
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}

function Hints({ c, used, disabled, onOpen }: { c: Case; used: number; disabled: boolean; onOpen: () => void }) {
  return (
    <Panel title="Подсказки">
      <ol className="flex flex-col gap-2">
        {c.hints.slice(0, used).map((h, i) => (
          <li key={i} className="pop-in rounded-xl bg-panel-2 px-3 py-2 text-base leading-snug">
            <span className="mr-2 text-accent">{i + 1}.</span>
            {h}
          </li>
        ))}
      </ol>
      {used < MAX_HINTS ? (
        <Button variant="secondary" onClick={onOpen} disabled={disabled} className="mt-3 w-full">
          Открыть подсказку {used + 1} <span className="text-bad">−{SCORE.hintCost[used]}</span>
        </Button>
      ) : (
        <p className="mt-3 text-sm text-muted">Все подсказки открыты.</p>
      )}
    </Panel>
  );
}

function SessionSummary({
  game,
  fixedCaseId,
  offline,
  student,
  onRestart,
}: {
  game: GameState;
  fixedCaseId: string | null;
  offline: boolean;
  student: StudentIdentity | null;
  onRestart: () => void;
}) {
  const played = game.results.length;
  const solved = game.results.filter((r) => r.outcome === "solved").length;
  const avg = played > 0 ? Math.round(game.total / played) : 0;
  const spots = blindSpots(game.results);
  const fullGameHref = offline ? "/play?offline=1" : "/play";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-muted">{game.lives > 0 ? "Сессия завершена" : "Жизни закончились"}</p>
      <h1 className="mt-1 text-4xl font-bold">
        {game.total} <span className="text-muted">очков</span>
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-lg">
        <Stars count={stars(avg)} size="text-3xl" />
        <span>
          Найдено и доказано: {solved} из {played}
        </span>
        <Hearts lives={Math.max(0, game.lives)} max={SESSION_LIVES} />
      </div>

      <Panel title="Раунды" className="mt-6">
        <ul className="flex flex-col gap-2">
          {game.results.map((r, i) => (
            <li key={`${r.caseId}-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-lg">
              <span>
                <span className="mr-2 text-muted">{i + 1}.</span>
                {typeName(r.typeId)}
              </span>
              <span className="flex items-center gap-3">
                <Stars count={r.stars} />
                <span className="w-12 text-right tabular-nums">{r.score}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Твои слепые пятна" className="mt-4">
        {spots.length === 0 ? (
          <p className="text-lg">Слепых пятен нет: все ошибки найдены без подсказок. Отличная проверка!</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {spots.map((t) => (
                <li key={t} className="rounded-full border border-bad/50 bg-bad/10 px-3 py-1 text-lg">
                  {typeName(t)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-muted">Эти типы ошибок ты не заметил или нашёл только с подсказкой. Повтори их.</p>
          </>
        )}
      </Panel>

      <p className="mt-4 text-sm text-muted">
        {student && !offline
          ? `Результаты сохранены для учителя класса «${student.className}».`
          : "Результат сохранён только на этом устройстве."}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onRestart}>Играть ещё</Button>
        {fixedCaseId ? (
          <Link href={fullGameHref} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold hover:border-muted">
            Полная игра (6 раундов)
          </Link>
        ) : null}
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl px-4 font-semibold text-muted hover:text-text">
          На главную
        </Link>
      </div>
    </main>
  );
}
