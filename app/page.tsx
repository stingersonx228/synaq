import Link from "next/link";
import { ArrowRightIcon, ChalkboardTeacherIcon } from "@phosphor-icons/react/dist/ssr";
import JoinForm from "@/components/JoinForm";
import NotebookSheet from "@/components/landing/NotebookSheet";
import { Tick, Underline } from "@/components/PenMarks";
import { buttonClass, Wordmark } from "@/components/game/ui";
import { CASES, getCase, SUBJECT_NAMES } from "@/lib/catalog";
import { SUBJECTS } from "@/lib/types";
import { plural } from "@/lib/plural";
import { codeFromParam } from "@/lib/schemas";

// Not the stage demo case (pct-01): the landing must not give away the answer the jury sees later.
const PREVIEW = getCase("pct-03")!;
const PREVIEW_NOTE = "50% от 300 000, а не от 200 000";

const BUGGY = CASES.filter((c) => c.bug !== null);
const ERROR_TYPES = new Set(BUGGY.map((c) => c.type_id)).size;

const WHY = [
  {
    title: `${CASES.length} ${plural(CASES.length, ["задача", "задачи", "задач"])}, ${ERROR_TYPES} ${plural(ERROR_TYPES, ["тип", "типа", "типов"])} ошибок`,
    text: "Каждая ошибка заложена заранее и размечена: какая строка неверна, в чём причина и каким числом её опровергнуть. ИИ ничего не выдумывает.",
  },
  {
    title: "Сдаётся только по математике",
    text: "Контрпример ученика проверяет код, а не нейросеть. Уговорить Алибека нельзя: нужно число, которое ломает его решение.",
  },
  {
    title: "ИИ только озвучивает",
    text: "Нейросеть пишет реплики упрямого стажёра и оценивает объяснение. Без неё игра работает целиком, даже офлайн.",
  },
  {
    title: "Без персональных данных",
    text: "Вход по коду класса и псевдониму. Объяснение без имени уходит в модель ИИ только для оценки, мы его не храним.",
  },
] as const;

// The three moves of a round, each with what the student writes in red pen for the preview task.
const FLOW = [
  ["Найди", "Нажми на строку, где Алибек ошибся. Или докажи, что ошибок нет: иногда он прав.", "неверна строка 2"],
  ["Объясни", "Напиши, что именно не так. Алибек будет спорить: он уверен в себе.", "понижение считают от 300 000"],
  ["Докажи", "Подбери число-контрпример. Его проверяет код, поэтому уговорить Алибека нельзя.", "x = 100: у него 100, на деле 75"],
] as const;

export default async function Home({ searchParams }: PageProps<"/">) {
  const initialCode = codeFromParam((await searchParams).code);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <Link
          href="/teacher"
          className="-mr-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-medium text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <ChalkboardTeacherIcon size={18} aria-hidden />
          Учителю
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pt-14 [&>*]:min-w-0">
          <div>
            <h1 className="font-display text-[clamp(2.75rem,6.5vw,4.75rem)] font-bold leading-[1.02]">
              ИИ ошибся.
              <br />
              <span className="relative inline-block">
                Докажи это.
                <Underline className="absolute -bottom-2 left-0 h-4 w-full text-pen" delay={1500} />
              </span>
            </h1>
            <p className="mt-8 max-w-[36ch] text-xl leading-relaxed text-muted">
              Стажёр Алибек решает задачи по алгебре и физике и уверен, что прав. Найди ошибку и опровергни её
              числом.
            </p>
            <p className="mt-8 font-medium">Выбери предмет:</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {SUBJECTS.map((s, i) => (
                <Link key={s} href={`/play?subject=${s}`} className={buttonClass(i === 0 ? "primary" : "secondary", "text-lg")}>
                  {SUBJECT_NAMES[s].name}
                  <ArrowRightIcon size={20} weight="bold" aria-hidden />
                </Link>
              ))}
            </div>
            <a href="#join" className="mt-5 inline-flex min-h-11 items-center font-semibold text-pen underline underline-offset-4">
              Есть код класса? Войти
            </a>
          </div>

          <div>
            <NotebookSheet c={PREVIEW} wrongLine={2} note={PREVIEW_NOTE} />
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 pl-1 sm:pl-[4.5rem]">
              <span className="text-sm text-muted">Алибек спорит:</span>
              <span className="font-hand text-[1.55rem] leading-tight text-intern">«{PREVIEW.bug!.defense[0]}»</span>
            </p>
          </div>
        </section>

        <section className="border-y border-line bg-ink">
          <ol className="mx-auto grid w-full max-w-6xl grid-cols-1 divide-y divide-line px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0">
            {FLOW.map(([verb, text, mark], i) => (
              <li key={verb} className={`py-9 md:py-12 ${i === 0 ? "md:pr-10" : i === 1 ? "md:px-10" : "md:pl-10"}`}>
                <h2 className="font-display text-3xl font-bold">{verb}</h2>
                <p className="mt-3 max-w-[36ch] text-lg leading-relaxed text-muted">{text}</p>
                <p className="mt-4 -rotate-1 font-hand text-[1.7rem] leading-tight text-pen" aria-hidden>
                  {mark}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 pt-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              Это не «попроси ChatGPT притвориться глупым»
            </h2>
            <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-muted">
              Чат-бот ошибается случайно и сдаётся от любого нажима. Алибек ошибается по плану и признаёт ошибку
              только перед доказательством.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-line border-y border-line bg-ink">
            {WHY.map(({ title, text }) => (
              <li key={title} className="grid grid-cols-[2.25rem_1fr] gap-3 py-5">
                <Tick className="mt-0.5 h-7 w-7 text-pen" />
                <div>
                  <h3 className="font-display text-xl font-bold">{title}</h3>
                  <p className="mt-1 max-w-[60ch] leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="join"
          className="mx-auto grid w-full max-w-6xl scroll-mt-8 grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_28rem] [&>*]:min-w-0"
        >
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Играешь с классом?</h2>
            <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-muted">
              Введи код от учителя и придумай псевдоним. Учитель увидит, какие ошибки класс пропускает, но не твоё
              настоящее имя: его мы не спрашиваем.
            </p>
            <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-muted">
              Без кода тоже можно играть. Тогда результат останется только на этом устройстве.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_18px_40px_-28px_oklch(0.3_0.04_260/0.35)] sm:p-6">
            <JoinForm initialCode={initialCode} />
          </div>
        </section>

        <section className="border-t border-line bg-ink">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Для учителя</h2>
              <p className="mt-2 max-w-[52ch] text-lg text-muted">
                Создайте класс за минуту и смотрите, какие типы ошибок ученики не замечают.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/teacher" className={buttonClass("secondary")}>
                Создать класс
              </Link>
              <Link href="/teacher/demo" className={buttonClass("ghost")}>
                Посмотреть пример панели
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-ink">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
          Без рекламы и трекеров. Имён не собираем, объяснения учеников не храним.
        </p>
      </footer>
    </div>
  );
}
