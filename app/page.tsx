import Link from "next/link";
import {
  ArrowRightIcon,
  ChalkboardTeacherIcon,
  ChatCircleDotsIcon,
  FunctionIcon,
  ListChecksIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import JoinForm from "@/components/JoinForm";
import SolutionSheet from "@/components/game/SolutionSheet";
import { buttonClass, InternAvatar, Wordmark } from "@/components/game/ui";
import { CASES, getCase } from "@/lib/catalog";
import { plural } from "@/lib/plural";
import { codeFromParam } from "@/lib/schemas";

// Not the stage demo case (pct-01): the landing must not give away the answer the jury sees later.
const PREVIEW = getCase("pct-03")!;

const BUGGY = CASES.filter((c) => c.bug !== null);
const ERROR_TYPES = new Set(BUGGY.map((c) => c.type_id)).size;

const WHY = [
  {
    Icon: ListChecksIcon,
    title: `${CASES.length} ${plural(CASES.length, ["задача", "задачи", "задач"])}, ${ERROR_TYPES} ${plural(ERROR_TYPES, ["тип", "типа", "типов"])} ошибок`,
    text: "Каждая ошибка заложена заранее и размечена: какая строка неверна, в чём причина и каким числом её опровергнуть. ИИ ничего не выдумывает.",
  },
  {
    Icon: FunctionIcon,
    title: "Сдаётся только по математике",
    text: "Контрпример ученика проверяет код, а не нейросеть. Уговорить Алибека нельзя: нужно число, которое ломает его решение.",
  },
  {
    Icon: ChatCircleDotsIcon,
    title: "ИИ только озвучивает",
    text: "Нейросеть пишет реплики упрямого стажёра и оценивает объяснение. Без неё игра работает целиком, даже офлайн.",
  },
  {
    Icon: ShieldCheckIcon,
    title: "Без персональных данных",
    text: "Вход по коду класса и псевдониму. Объяснение без имени уходит в модель ИИ только для оценки, мы его не храним.",
  },
] as const;

const FLOW = [
  ["Найди", "Нажми на строку, где Алибек ошибся. Или докажи, что ошибок нет: иногда он прав."],
  ["Объясни", "Напиши, что именно не так. Алибек будет спорить: он уверен в себе."],
  ["Докажи", "Подбери число-контрпример. Проверяет математика, а не ИИ, поэтому сдача честная."],
] as const;

export default async function Home({ searchParams }: PageProps<"/">) {
  const initialCode = codeFromParam((await searchParams).code);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <Wordmark />
        <Link href="/teacher" className="-mr-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text">
          <ChalkboardTeacherIcon size={18} aria-hidden />
          Учителю
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pt-16 [&>*]:min-w-0">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl xl:text-6xl">
              ИИ ошибся.
              <br />
              <span className="text-pen">Докажи это.</span>
            </h1>
            <p className="mt-6 max-w-[34ch] text-xl leading-relaxed text-muted">
              Стажёр Алибек решает задачи по алгебре и уверен, что прав. Найди ошибку и опровергни её числом.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/play" className={buttonClass("primary", "text-lg")}>
                Начать игру
                <ArrowRightIcon size={20} weight="bold" aria-hidden />
              </Link>
              <a href="#join" className={buttonClass("secondary", "text-lg")}>
                Войти по коду класса
              </a>
            </div>
          </div>

          <figure className="relative" aria-label="Пример раунда">
            <div className="rounded-xl border border-line bg-surface p-3 shadow-[0_30px_80px_-30px_rgb(255_106_61/0.25)] sm:p-4">
              <p className="px-2 pb-2 pt-1 text-muted sm:px-3">{PREVIEW.task}</p>
              <SolutionSheet
                steps={PREVIEW.steps}
                answer={PREVIEW.answer}
                lineState={(n) => (n === 2 ? "marked" : "idle")}
                compact
              />
            </div>
            <figcaption className="relative -mt-5 ml-auto mr-3 flex max-w-xs items-start gap-3 sm:mr-6">
              <InternAvatar />
              <p className="rounded-xl rounded-tl-sm bg-surface-2 px-4 py-2.5 leading-snug ring-1 ring-line">
                {PREVIEW.bug!.defense[0]}
              </p>
            </figcaption>
          </figure>
        </section>

        <section className="border-y border-line bg-surface/60">
          <ol className="mx-auto grid w-full max-w-7xl grid-cols-1 divide-y divide-line px-4 md:grid-cols-3 md:divide-x md:divide-y-0">
            {FLOW.map(([verb, text], i) => (
              <li key={verb} className={`py-8 md:py-12 ${i === 0 ? "md:pr-10" : i === 1 ? "md:px-10" : "md:pl-10"}`}>
                <h2 className="font-display text-3xl font-bold">
                  {verb}
                  <span className="text-pen">.</span>
                </h2>
                <p className="mt-3 max-w-[38ch] text-lg leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 pt-20 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              Это не «попроси ChatGPT притвориться глупым»
            </h2>
            <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-muted">
              Чат-бот может ошибиться случайно и сдаться от любого нажима. Алибек ошибается по плану и признаёт
              ошибку только перед доказательством.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {WHY.map(({ Icon, title, text }) => (
              <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5">
                <Icon size={28} weight="duotone" className="mt-0.5 text-pen" aria-hidden />
                <div>
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-1 max-w-[60ch] leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="join"
          className="mx-auto grid w-full max-w-7xl scroll-mt-8 grid-cols-1 gap-10 px-4 py-20 lg:grid-cols-[1fr_28rem] [&>*]:min-w-0"
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
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <JoinForm initialCode={initialCode} />
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between">
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

      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-muted">
          Без рекламы и трекеров. Имён не собираем, объяснения учеников не храним.
        </p>
      </footer>
    </div>
  );
}
