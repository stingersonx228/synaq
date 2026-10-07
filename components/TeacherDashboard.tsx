import type { ReactNode } from "react";
import { Wordmark } from "@/components/game/ui";
import LessonPlan from "@/components/teacher/LessonPlan";
import PrintButton from "@/components/teacher/PrintButton";
import RoundFeed from "@/components/teacher/RoundFeed";
import { typeName } from "@/lib/catalog";
import { plural } from "@/lib/plural";
import type { ClassStats } from "@/lib/stats";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Almaty",
});

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function TeacherDashboard({
  name,
  code,
  stats,
  demo = false,
  invite,
  status,
}: {
  name: string;
  code: string;
  stats: ClassStats;
  demo?: boolean;
  /** Join QR and link (real classes only). */
  invite?: ReactNode;
  /** Live-update indicator. */
  status?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      {demo ? (
        <div className="mb-6 rounded-xl border-2 border-pen bg-pen/10 px-5 py-4 text-center" role="note">
          <p className="font-display text-xl font-bold text-pen sm:text-2xl">ДЕМО-ДАННЫЕ, не реальные результаты</p>
          <p className="mt-1 text-muted">Класс из 30 вымышленных учеников, сгенерирован для показа панели учителя.</p>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Wordmark />
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Класс {name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {invite ? null : (
            <div className="rounded-xl border border-line bg-surface px-5 py-3 text-right">
              <p className="text-sm text-muted">Код для учеников</p>
              <p className="font-mono text-3xl font-bold tracking-[0.25em] text-pen">{code}</p>
            </div>
          )}
          <PrintButton />
        </div>
      </header>

      {invite}

      {status ? <div className="mt-6">{status}</div> : null}

      <p className={`${status ? "mt-2" : "mt-4"} text-lg text-muted`}>
        <span className="font-mono font-semibold text-text">{stats.studentCount}</span>{" "}
        {plural(stats.studentCount, ["ученик", "ученика", "учеников"])}{" "}
        {plural(stats.studentCount, ["сыграл", "сыграли", "сыграли"])}{" "}
        <span className="font-mono font-semibold text-text">{stats.roundCount}</span>{" "}
        {plural(stats.roundCount, ["раунд", "раунда", "раундов"])}
      </p>

      {status ? <RoundFeed rounds={stats.recent ?? []} /> : null}

      {stats.studentCount === 0 ? (
        <Empty>
          Пока никто не вошёл. Дайте ученикам код <b className="font-mono text-pen">{code}</b>: они вводят его на
          главной странице вместе с псевдонимом.
        </Empty>
      ) : stats.roundCount === 0 ? (
        <Empty>Ученики вошли, но ещё не сыграли ни одного раунда. Статистика появится после первых игр.</Empty>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold">Главные слепые пятна класса</h2>
            {stats.blindSpots.length === 0 ? (
              <p className="mt-2 text-muted">Слепых пятен нет: класс находит все типы ошибок.</p>
            ) : (
              <ol className="mt-4 divide-y divide-line border-y border-line">
                {stats.blindSpots.map((t, i) => (
                  <li key={t.typeId} className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-4 gap-y-1 py-4 sm:py-5">
                    <span className="font-mono text-lg text-muted">{i + 1}</span>
                    <span className="text-xl font-semibold leading-snug sm:text-2xl">{t.name}</span>
                    <span className="text-right">
                      <span className="block font-display text-3xl font-bold text-bad sm:text-4xl">
                        {pct(t.problemRate)}
                      </span>
                      <span className="text-sm text-muted">
                        {t.problemRounds} из {t.rounds}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <LessonPlan spots={stats.blindSpots} />

          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Какие типы ошибок класс не заметил</h2>
            <p className="mt-1 text-sm text-muted">
              Проблемный раунд: ошибку не нашли или не доказали, потеряли жизнь или открыли все 3 подсказки.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-surface text-sm text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Тип ошибки</th>
                    <th className="px-4 py-3 font-semibold">Проблемных</th>
                    <th className="px-4 py-3 text-right font-semibold">Раундов</th>
                    <th className="px-4 py-3 text-right font-semibold">Не нашли</th>
                    <th className="px-4 py-3 text-right font-semibold">−жизнь</th>
                    <th className="px-4 py-3 text-right font-semibold">3 подсказки</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.types.map((t) => (
                    <tr key={t.typeId} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2.5 w-28 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                            <div className="h-full rounded-full bg-bad" style={{ width: pct(t.problemRate) }} />
                          </div>
                          <span className="w-12 tabular-nums">{pct(t.problemRate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.rounds}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.missed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.lifeLost}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.fullHints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {stats.studentCount > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Ученики</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-surface text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Псевдоним</th>
                  <th className="px-4 py-3 text-right font-semibold">Раундов</th>
                  <th className="px-4 py-3 text-right font-semibold">Средний балл</th>
                  <th className="px-4 py-3 font-semibold">Слабые темы</th>
                  <th className="px-4 py-3 font-semibold">Последняя активность</th>
                </tr>
              </thead>
              <tbody>
                {stats.students.map((s) => (
                  <tr key={s.nickname} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{s.nickname}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.rounds}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.rounds > 0 ? s.avgScore : "-"}</td>
                    <td className="px-4 py-3">
                      {(s.weakTypes ?? []).length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {(s.weakTypes ?? []).map((t) => (
                            <li key={t} className="rounded-full bg-bad/12 px-2.5 py-0.5 text-sm">
                              {typeName(t)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted">{s.rounds > 0 ? "нет" : "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {s.lastActive ? dateFmt.format(new Date(s.lastActive)) : "раундов пока нет"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}


function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-8 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-lg leading-relaxed">{children}</p>;
}
