import type { Metadata } from "next";
import PlayClient from "@/components/game/PlayClient";
import { getCase } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Игра | Обратный экзамен",
};

export default async function PlayPage({ searchParams }: PageProps<"/play">) {
  const params = await searchParams;
  const caseParam = typeof params.case === "string" ? params.case : null;
  const fixedCaseId = caseParam && getCase(caseParam) ? caseParam : null;
  const offline = params.offline === "1";
  return <PlayClient fixedCaseId={fixedCaseId} offline={offline} />;
}
