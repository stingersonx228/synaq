import Link from "next/link";
import type { ReactNode } from "react";
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
}: {
  name: string;
  code: string;
  stats: ClassStats;
  demo?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      {demo ? (
        <div className="mb-6 rounded-2xl border-2 border-accent bg-accent/10 px-5 py-4 text-center" role="note">
          <p className="text-2xl font-black tracking-wide text-accent">ДЕМО-ДАННЫЕ, не реальные результаты</p>
          <p className="mt-1 text-muted">Класс из 30 вымышленных учеников, сгенерирован для показа панели учителя.</p>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="font-semibold text-accent">
            Обратный экзамен
          </Link>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Класс {name}</h1>
        </div>
        <div className="rounded-2xl border border-line bg-panel px-5 py-3 text-right">
          <p className="text-sm text-muted">Код для учеников</p>
          <p className="font-mono text-3xl font-bold tracking-[0.25em] text-accent">{code}</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <Metric label="Учеников" value={stats.studentCount} />
        <Metric label="Раундов сыграно" value={stats.roundCount} />
      </div>

      {stats.studentCount === 0 ? (
        <Empty>
          Пока никто не вошёл. Дайте ученикам код <b className="font-mono text-accent">{code}</b>: они вводят его на
          главной странице вместе с псевдонимом.
        </Empty>
      ) : stats.roundCount === 0 ? (
        <Empty>Ученики вошли, но ещё не сыграли ни одного раунда. Статистика появится после первых игр.</Empty>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-xl font-bold">Главные слепые пятна класса</h2>
            {stats.blindSpots.length === 0 ? (
              <p className="mt-2 text-muted">Слепых пятен нет: класс находит все типы ошибок.</p>
            ) : (
              <ol className="mt-3 grid gap-4 md:grid-cols-3">
                {stats.blindSpots.map((t, i) => (
                  <li key={t.typeId} className="rounded-2xl border border-bad/40 bg-bad/10 p-5">
                    <p className="text-sm font-semibold text-muted">№ {i + 1}</p>
                    <p className="mt-1 text-xl font-bold leading-snug">{t.name}</p>
                    <p className="mt-3 text-5xl font-black text-bad">{pct(t.problemRate)}</p>
                    <p className="mt-1 text-sm text-muted">
                      проблемных раундов ({t.problemRounds} из {t.rounds})
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold">Какие типы ошибок класс не заметил</h2>
            <p className="mt-1 text-sm text-muted">
              Проблемный раунд — ошибку не нашли или не доказали, потеряли жизнь или открыли все 3 подсказки.
            </p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-panel text-sm text-muted">
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
                          <div className="h-2.5 w-28 overflow-hidden rounded-full bg-panel-2" aria-hidden>
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
          <h2 className="text-xl font-bold">Ученики</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-panel text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Псевдоним</th>
                  <th className="px-4 py-3 text-right font-semibold">Раундов</th>
                  <th className="px-4 py-3 text-right font-semibold">Средний балл</th>
                  <th className="px-4 py-3 font-semibold">Последняя активность</th>
                </tr>
              </thead>
              <tbody>
                {stats.students.map((s) => (
                  <tr key={s.nickname} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{s.nickname}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.rounds}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.rounds > 0 ? s.avgScore : "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {s.lastActive ? dateFmt.format(new Date(s.lastActive)) : "ещё не играл"}
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-4xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-8 rounded-2xl border border-dashed border-line bg-panel px-5 py-8 text-lg leading-relaxed">{children}</p>;
}
