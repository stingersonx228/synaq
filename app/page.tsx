import Link from "next/link";
import JoinForm from "@/components/JoinForm";
import { InternAvatar } from "@/components/game/ui";

const STEPS = [
  ["Найди строку", "Алибек решил задачу и где-то ошибся. Нажми на неверную строку — или скажи, что ошибок нет."],
  ["Объясни причину", "Напиши, что именно он сделал не так. Алибек будет спорить — он уверен в себе."],
  ["Докажи числом", "Подбери контрпример. Проверку делает математика, а не ИИ: если доказательство верное, Алибек сдаётся."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <section>
          <p className="font-semibold text-accent">Обратный экзамен</p>
          <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">
            Теперь ты проверяешь ИИ, а не он тебя.
          </h1>
          <p className="mt-4 text-xl leading-relaxed text-muted">
            ИИ-стажёр Алибек решает задачи по алгебре и делает ошибки новичка. Найди ошибку, объясни её и докажи —
            так готовятся к ЕНТ без страха ошибиться.
          </p>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-panel p-4">
            <InternAvatar size="h-10 w-10 text-lg" />
            <p className="text-lg leading-snug">
              «Я всё решил правильно. Скидки складываются, корень из 9 — это 3. Можешь проверить, но ошибок не
              найдёшь».
            </p>
          </div>

          <ol className="mt-8 flex flex-col gap-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 font-bold text-accent">
                  {i + 1}
                </span>
                <div>
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <h2 className="mb-4 text-2xl font-bold">Войти в класс</h2>
          <JoinForm />
          <div className="my-5 flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            или
            <span className="h-px flex-1 bg-line" />
          </div>
          <Link
            href="/play"
            className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-panel-2 px-4 text-lg font-semibold hover:border-muted"
          >
            Играть без регистрации
          </Link>
          <p className="mt-3 text-center text-sm text-muted">Прогресс сохранится только на этом устройстве.</p>
        </section>
      </div>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-muted">
        <Link href="/teacher" className="font-semibold text-text hover:text-accent">
          Я учитель →
        </Link>
        <span className="text-sm">Без рекламы и трекеров. Настоящие имена не собираем.</span>
      </footer>
    </main>
  );
}
