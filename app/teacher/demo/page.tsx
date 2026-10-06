import type { Metadata } from "next";
import TeacherDashboard from "@/components/TeacherDashboard";
import { DEMO_CLASS, demoClassStats } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Демо-панель учителя — Обратный экзамен",
};

export default function TeacherDemoPage() {
  return <TeacherDashboard name={DEMO_CLASS.name} code={DEMO_CLASS.code} stats={demoClassStats()} demo />;
}
