"use client";

import Link from "next/link";
import { ArrowCounterClockwiseIcon, CheckIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { SESSION_LIVES, typeName } from "@/lib/catalog";
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
              <span className="ml-3 align-middle text-2xl font-medium text-muted sm:text-3xl">очков</span>
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

        <ol className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {game.results.map((r, i) => {
            const won = r.outcome === "solved";
            return (
              <li
                key={`${r.caseId}-${i}`}
                className={`rise flex items-start justify-between gap-3 rounded-xl border bg-surface p-4 ${
                  won ? "border-line" : "border-bad/40"
                }`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex gap-3">
                  {won ? (
                    <CheckIcon size={20} weight="bold" className="mt-0.5 shrink-0 text-good" aria-label="Решено" />
                  ) : (
                    <XIcon size={20} weight="bold" className="mt-0.5 shrink-0 text-bad" aria-label="Не решено" />
                  )}
                  <span className="leading-snug">{typeName(r.typeId)}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Stars count={r.stars} size={16} />
                  <span className="font-mono text-sm tabular-nums text-muted">{r.score}</span>
                </div>
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
                Эти ошибки ты пропустил или нашёл только с подсказкой. Повтори их в следующей игре.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {spots.map((t) => (
                  <li key={t} className="rounded-xl border border-pen/40 bg-pen/10 px-4 py-2 text-lg">
                    {typeName(t)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Button onClick={onRestart}>
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
