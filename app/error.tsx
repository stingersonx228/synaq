"use client";

import Link from "next/link";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr";
import { buttonClass, Wordmark } from "@/components/game/ui";

// Last-resort screen for unexpected runtime errors. The offline demo link never needs the
// network or the database, so the stage demo always has a way back.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
      <Wordmark />
      <h1 className="mt-10 font-display text-3xl font-bold">Что-то пошло не так</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-muted">
        Страница не загрузилась. Попробуйте ещё раз. Если не помогает, откройте игру в офлайн-режиме: она
        работает без сети.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={retry} className={buttonClass("primary")}>
          <ArrowCounterClockwiseIcon size={18} weight="bold" aria-hidden />
          Попробовать снова
        </button>
        <Link href="/play?offline=1" className={buttonClass("secondary")}>
          Играть офлайн
        </Link>
        <Link href="/" className={buttonClass("ghost")}>
          На главную
        </Link>
      </div>
    </main>
  );
}
