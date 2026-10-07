import type { Metadata } from "next";
import Link from "next/link";
import CreateClassForm from "@/components/CreateClassForm";
import { Wordmark } from "@/components/game/ui";

export const metadata: Metadata = {
  title: "Для учителя | Synaq",
};

export default function TeacherPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <Wordmark />
      <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
        <section>
          <h1 className="font-display text-4xl font-bold leading-tight">Панель учителя</h1>
          <p className="mt-4 text-xl leading-relaxed text-muted">
            Создайте класс и получите код для учеников и секретную ссылку на панель. На панели видно, какие типы ошибок
            класс не замечает: сложение процентов, потерянные корни, ОДЗ и другие.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-lg">
            <li>• Без регистрации и паролей: доступ к панели по секретной ссылке.</li>
            <li>• Ученики входят по коду класса и псевдониму, настоящие имена не нужны.</li>
            <li>• Объяснения учеников не сохраняются, только результаты раундов.</li>
          </ul>
          <Link href="/teacher/demo" className="mt-6 inline-block font-semibold text-pen underline">
            Посмотреть пример панели на демо-данных
          </Link>
        </section>
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="mb-4 font-display text-2xl font-bold">Создать класс</h2>
          <CreateClassForm />
        </section>
      </div>
    </main>
  );
}
