import type { Metadata } from "next";
import PlayClient from "@/components/game/PlayClient";
import { DEFAULT_SUBJECT, getCase } from "@/lib/catalog";
import { SUBJECTS, type Subject } from "@/lib/types";

export const metadata: Metadata = {
  title: "Игра | Synaq",
};

export default async function PlayPage({ searchParams }: PageProps<"/play">) {
  const params = await searchParams;
  const caseParam = typeof params.case === "string" ? params.case : null;
  const fixedCaseId = caseParam && getCase(caseParam) ? caseParam : null;
  const offline = params.offline === "1";
  const subject = SUBJECTS.includes(params.subject as Subject) ? (params.subject as Subject) : DEFAULT_SUBJECT;
  return <PlayClient fixedCaseId={fixedCaseId} offline={offline} subject={subject} />;
}
