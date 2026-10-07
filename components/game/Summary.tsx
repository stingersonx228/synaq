"use client";

import Link from "next/link";
import { ArrowCounterClockwiseIcon, CaretDownIcon, CheckIcon, TargetIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { getCase, SESSION_LIVES, typeName } from "@/lib/catalog";
import { plural } from "@/lib/plural";
import { blindSpots, stars } from "@/lib/scoring";
import type { StudentIdentity } from "@/lib/session";
import type { GameState } from "./model";
import { Button, buttonClass, Hearts, Stars, Wordmark } from "./ui";

export default function Summary({
  game,
  fixedCaseId,
  offline,
  student,
  onRestart,
  onPractice,
}: {
  game: GameState;
  fixedCaseId: string | null;
  offline: boolean;
  student: StudentIdentity | null;
  onRestart: () => void;
  onPractice: () => void;
}) {
  const played = game.results.length;
  const solved = game.results.filter((r) => r.outcome === "solved").length;
  const avg = played > 0 ? Math.round(game.total / played) : 0;
  const spots = blindSpots(game.results);
  const fullGameHref = offline ? "/play?offline=1" : "/play";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-lg text-muted">{game.lives > 0 ? "Сессия завершена" : "Жизни закончились"}</p>
            <h1 className="mt-2 font-display text-6xl font-bold tabular-nums sm:text-7xl">
              {game.total}
              <span className="ml-3 align-middle text-2xl font-medium text-muted sm:text-3xl">
                {plural(game.total, ["очко", "очка", "очков"])}
              </span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-lg">
            <Stars count={stars(avg)} size={32} />
            <span>
              Доказано <span className="font-mono font-semibold">{solved}</span> из{" "}
              <span className="font-mono font-semibold">{played}</span>
            </span>
            <Hearts lives={Math.max(0, game.lives)} max={SESSION_LIVES} />
          </div>
        </div>

        <ol className="mt-10 divide-y divide-line rounded-xl border border-line bg-surface">
          {game.results.map((r, i) => {
            const won = r.outcome === "solved";
            return (
              <li
                key={`${r.caseId}-${i}`}
                className="rise grid grid-cols-[1.75rem_1.5rem_1fr_auto] items-center gap-3 px-4 py-3 sm:px-5"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="font-mono text-muted tabular-nums">{i + 1}</span>
                {won ? (
                  <CheckIcon size={20} weight="bold" className="text-good" aria-label="Решено" />
                ) : (
                  <XIcon size={20} weight="bold" className="text-bad" aria-label="Не решено" />
                )}
                <span className="min-w-0 text-lg leading-snug">{typeName(r.typeId)}</span>
                <span className="flex items-center gap-3">
                  <Stars count={r.stars} size={18} />
                  <span className="w-10 text-right font-mono tabular-nums">{r.score}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Твои слепые пятна</h2>
          {spots.length === 0 ? (
            <p className="mt-3 max-w-[60ch] text-lg text-muted">
              Слепых пятен нет: все ошибки найдены без подсказок. Сильная проверка.
            </p>
          ) : (
            <>
              <p className="mt-2 max-w-[60ch] text-muted">
                Эти ошибки остались незамеченными или нашлись только с подсказкой. Нажми, чтобы разобраться, или потренируй их.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {spots.map((t) => {
                  // Explain with the case the student actually played for this error type.
                  const played = game.results.find((r) => r.typeId === t);
                  const c = played ? getCase(played.caseId) : undefined;
                  return (
                    <li key={t}>
                      <details className="group rounded-xl border border-pen/40 bg-pen/10 open:bg-surface">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-lg [&::-webkit-details-marker]:hidden">
                          {typeName(t)}
                          <CaretDownIcon
                            size={18}
                            className="shrink-0 text-pen transition-transform group-open:rotate-180"
                            aria-hidden
                          />
                        </summary>
                        <div className="flex flex-col gap-2 px-4 pb-4 leading-relaxed">
                          {c?.bug ? (
                            <>
                              <p>
                                <span className="text-muted">В чём ошибка: </span>
                                {c.bug.cause}
                              </p>
                              <p>
                                <span className="text-muted">Как правильно: </span>
                                {c.bug.fix}
                              </p>
                            </>
                          ) : (
                            <p>
                              <span className="text-muted">Что случилось: </span>
                              решение было верным, а ошибку ты увидел в правильном шаге. Прежде чем обвинять строку,
                              подставь ответ в исходное условие.
                            </p>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          {spots.length > 0 && !fixedCaseId ? (
            <Button onClick={onPractice}>
              <TargetIcon size={18} weight="bold" aria-hidden />
              Потренировать слепые пятна
            </Button>
          ) : null}
          <Button onClick={onRestart} variant={spots.length > 0 && !fixedCaseId ? "secondary" : "primary"}>
            <ArrowCounterClockwiseIcon size={18} weight="bold" aria-hidden />
            Играть ещё
          </Button>
          {fixedCaseId ? (
            <Link href={fullGameHref} className={buttonClass("secondary")}>
              Полная игра, 6 раундов
            </Link>
          ) : null}
          <Link href="/" className={buttonClass("ghost")}>
            На главную
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted">
          {student && !offline
            ? `Результаты отправлены учителю класса «${student.className}».`
            : "Результат сохранён только на этом устройстве."}
        </p>
      </main>
    </div>
  );
}
