import { CheckIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { typeName } from "@/lib/catalog";
import type { RecentRound } from "@/lib/stats";
import type { Outcome } from "@/lib/types";

const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });

function verb(outcome: Outcome, clean: boolean): string {
  switch (outcome) {
    case "solved":
      return clean ? "подтвердил верное решение" : "разоблачил Алибека";
    case "failed_proof":
      return "не смог доказать ошибку";
    case "missed_clean":
      return "пропустил ошибку";
    case "wrong_line":
      return "потерял все жизни";
    case "false_accusation":
      return "обвинил верное решение";
  }
}

/** Latest rounds of the class, newest first. New rows animate in as the live panel refreshes. */
export default function RoundFeed({ rounds }: { rounds: RecentRound[] }) {
  if (rounds.length === 0) return null;
  return (
    <section className="mt-8 print:hidden" aria-label="Последние раунды">
      <h2 className="font-display text-xl font-bold">Последние раунды</h2>
      <ol className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {rounds.map((r) => {
          const won = r.outcome === "solved";
          return (
            <li
              key={`${r.at}-${r.nickname}-${r.typeId}`}
              className="rise grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-3"
            >
              {won ? (
                <CheckIcon size={18} weight="bold" className="text-good" aria-label="Победа" />
              ) : (
                <XIcon size={18} weight="bold" className="text-bad" aria-label="Поражение" />
              )}
              <p className="min-w-0 leading-snug">
                <span className="font-semibold">{r.nickname}</span> {verb(r.outcome, r.typeId === "clean")}
                <span className="text-muted">: {typeName(r.typeId)}</span>
              </p>
              <span className="flex items-baseline gap-3 text-sm">
                {won ? <span className="font-mono text-base text-good">+{r.score}</span> : null}
                <span className="font-mono text-muted">{timeFmt.format(new Date(r.at))}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
