"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowsClockwiseIcon, PenNibIcon } from "@phosphor-icons/react/dist/ssr";
import { getCase, INTERN_LINES, pickPracticeCases, pickReplacement } from "@/lib/catalog";
import { fetchInternReply, fetchJudgeVerdict, newId, saveAttempt, type NetOptions } from "@/lib/client";
import { checkRefutation, explainRefutation, parseValues } from "@/lib/refute";
import { blindSpots, MAX_HINTS, MAX_REFUTE_TRIES, roundScore, stars } from "@/lib/scoring";
import { getStudent, recordSession, setStudent, type StudentIdentity } from "@/lib/session";
import type { Case, Outcome } from "@/lib/types";
import { addMsg, newGame, newRound, type ChatMsg, type GameState, type Round, type RoundResult } from "./model";
import {
  EXPLAIN_MIN,
  ExplainForm,
  InternPanel,
  internMood,
  LatestReply,
  PhaseSteps,
  PickActions,
  ProofForm,
  RoundDebrief,
  TopBar,
} from "./parts";
import SolutionSheet, { type LineState } from "./SolutionSheet";
import Confetti from "./Confetti";
import Summary from "./Summary";

const TYPING_MS = 500;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      const { attemptId, caseId, outcome, hintsUsed, causeOk, refuteTries, livesLost } = r;
      const payload = { attemptId, studentId, caseId, outcome, hintsUsed, causeOk, refuteTries, livesLost };
      void saveAttempt(payload).then((status) => {
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
        attemptId: newId(),
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
      updateRound(token, (r) => addMsg({ ...r, proofFeedback: feedback }, "intern", "Три попытки, и ничего. Значит, я прав!"));
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

  function practice() {
    judgeRef.current = null;
    const cases = pickPracticeCases(
      blindSpots(game.results),
      game.results.map((r) => r.caseId),
    );
    setGame(newGame(null, nextToken(), cases));
  }


  if (game.over) {
    return <Summary game={game} fixedCaseId={fixedCaseId} offline={offline} student={student} onRestart={restart} onPractice={practice} />;
  }

  const done = round.phase === "done";
  const won = done && round.outcome === "solved";
  const lineState = (n: number): LineState => {
    if (done && c.bug?.accept_steps.includes(n)) return "bug";
    if (round.foundLine === n) return "marked";
    if (round.wrongLines.includes(n)) return "cleared";
    return "idle";
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {game.flash ? (
        <div
          key={game.flash.key}
          aria-hidden
          className={`pointer-events-none fixed inset-0 z-40 ${game.flash.kind === "good" ? "flash-good" : "flash-bad"}`}
        />
      ) : null}
      {game.flash?.kind === "good" && won && c.bug ? <Confetti key={game.flash.key} /> : null}
      <TopBar game={game} offline={offline} student={student} />

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:py-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section key={round.token} className="rise">
            <div className="flex items-start justify-between gap-4">
              <p className="text-muted">
                {c.topic}, {c.level} класс
                <span className="sm:hidden">
                  {" "}
                  · раунд {game.index + 1} из {game.caseIds.length}
                </span>
              </p>
              {!done ? (
                <button
                  type="button"
                  onClick={swapIntern}
                  className="-mt-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm text-muted transition hover:bg-surface-2 hover:text-text active:scale-[0.98]"
                  title="Мгновенно заменить задачу на другую из каталога"
                  aria-label="Запасной стажёр: заменить задачу"
                >
                  <ArrowsClockwiseIcon size={18} aria-hidden />
                  <span className="hidden sm:inline">Запасной стажёр</span>
                </button>
              ) : null}
            </div>
            <h1 className="mt-2 max-w-[42ch] text-2xl font-semibold leading-snug sm:text-3xl">{c.task}</h1>
          </section>

          {round.phase === "pick" && !busy ? (
            // On phones the action panel is below the fold; say what to do right above the sheet.
            <p className="-mb-3 flex items-center gap-2 font-medium text-pen lg:hidden">
              <PenNibIcon size={18} weight="fill" aria-hidden />
              Нажми на строку, где Алибек ошибся
            </p>
          ) : null}

          <section
            className={`rounded-xl border bg-surface p-3 transition-colors duration-500 sm:p-4 ${
              won ? "border-good/70 bg-good/5" : "border-line"
            }`}
            aria-label="Решение Алибека"
          >
            <SolutionSheet
              steps={c.steps}
              answer={c.answer}
              lineState={lineState}
              onPick={pickLine}
              interactive={round.phase === "pick" && !busy}
              answerTone={done ? (c.bug ? "bad" : "good") : "idle"}
            />
          </section>

          <LatestReply chat={round.chat} typing={round.typing} />

          <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
            {!done && c.bug ? <PhaseSteps phase={round.phase} /> : null}
            {round.phase === "pick" ? <PickActions onClean={declareClean} disabled={busy} /> : null}
            {round.phase === "explain" ? (
              <ExplainForm key={round.token} line={round.foundLine} disabled={busy} onSubmit={submitExplanation} />
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
            {done ? (
              <RoundDebrief
                c={c}
                round={round}
                isLast={game.lives <= 0 || game.index + 1 >= game.caseIds.length}
                onNext={nextRound}
              />
            ) : null}
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <InternPanel
            chat={round.chat}
            typing={round.typing}
            mood={internMood(round, c.bug === null)}
            c={c}
            hintsUsed={round.hintsUsed}
            hintsDisabled={done}
            onHint={openHint}
          />
        </div>
      </main>
    </div>
  );
}
