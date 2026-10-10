"use client";

import dynamic from "next/dynamic";
import type { Subject } from "@/lib/types";

// The game reads localStorage and randomizes cases on start, so it renders only in the browser.
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <p className="mx-auto mt-24 text-lg text-muted">Алибек раскладывает задачи…</p>,
});

export default function PlayClient({
  fixedCaseId,
  offline,
  subject,
}: {
  fixedCaseId: string | null;
  offline: boolean;
  subject: Subject;
}) {
  return (
    <Game
      key={`${fixedCaseId ?? "session"}-${offline}-${subject}`}
      fixedCaseId={fixedCaseId}
      offline={offline}
      subject={subject}
    />
  );
}
