import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import TeacherDashboard from "@/components/TeacherDashboard";
import { getSupabase } from "@/lib/supabase";
import { loadClassDashboard, type ClassDashboard } from "@/lib/teacher";

// The URL carries the teacher secret: keep it out of search engines and Referer headers.
export const metadata: Metadata = {
  title: "Панель учителя | Обратный экзамен",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TeacherPanelPage({ params }: PageProps<"/teacher/[token]">) {
  const { token } = await params;
  const db = getSupabase();
  if (!db) {
    return (
      <Notice title="База данных не подключена">
        Панель учителя работает только с подключённой базой. Пример панели можно посмотреть на{" "}
        <Link href="/teacher/demo" className="text-pen underline">
          демо-странице
        </Link>
        .
      </Notice>
    );
  }

  let dashboard: ClassDashboard | null;
  try {
    dashboard = await loadClassDashboard(db, token);
  } catch {
    return <Notice title="Не удалось загрузить данные">Попробуйте обновить страницу через минуту.</Notice>;
  }
  if (!dashboard) notFound();
  return <TeacherDashboard name={dashboard.name} code={dashboard.code} stats={dashboard.stats} />;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{children}</p>
    </main>
  );
}
