"use client";

import { useEffect, useRef, useState } from "react";
import TeacherDashboard from "@/components/TeacherDashboard";
import { plural } from "@/lib/plural";
import type { ClassStats } from "@/lib/stats";
import InvitePanel from "./InvitePanel";

const POLL_MS = 5000;

const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

type Connection = "live" | "offline" | "gone";

function isStats(v: unknown): v is ClassStats {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.roundCount === "number" && Array.isArray(s.types) && Array.isArray(s.students);
}

/**
 * Teacher dashboard that refreshes itself while the tab is visible, so a projector shows
 * the class (or the jury) playing in real time.
 */
export default function LiveDashboard({
  token,
  name,
  code,
  initial,
  joinUrl,
  qrSvg,
}: {
  token: string;
  name: string;
  code: string;
  initial: ClassStats;
  joinUrl: string;
  qrSvg: string;
}) {
  const [stats, setStats] = useState(initial);
  const [connection, setConnection] = useState<Connection>("live");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [fresh, setFresh] = useState<{ rounds: number; key: number } | null>(null);
  const roundsRef = useRef(initial.roundCount);

  useEffect(() => {
    let stopped = false;
    async function tick() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/teacher/${token}/stats`, { cache: "no-store" });
        if (res.status === 404) {
          stopped = true;
          setConnection("gone");
          return;
        }
        if (!res.ok) {
          setConnection("offline");
          return;
        }
        const data: unknown = await res.json();
        const next = typeof data === "object" && data !== null ? (data as Record<string, unknown>).stats : null;
        if (!isStats(next)) {
          setConnection("offline");
          return;
        }
        const added = next.roundCount - roundsRef.current;
        roundsRef.current = next.roundCount;
        if (added > 0) setFresh({ rounds: added, key: Date.now() });
        setStats(next);
        setUpdatedAt(new Date());
        setConnection("live");
      } catch {
        setConnection("offline");
      }
    }
    const id = setInterval(() => void tick(), POLL_MS);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  const status = (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm print:hidden" role="status">
      {connection === "live" ? (
        <span className="inline-flex items-center gap-2 text-good">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-good" />
          </span>
          Обновляется вживую
          {updatedAt ? <span className="text-muted">в {timeFmt.format(updatedAt)}</span> : null}
        </span>
      ) : connection === "offline" ? (
        <span className="text-bad">Нет связи с сервером, пробую снова</span>
      ) : (
        <span className="text-bad">Класс не найден: возможно, он удалён</span>
      )}
      {fresh ? (
        <span key={fresh.key} className="rise rounded-full bg-good/15 px-3 py-0.5 font-medium text-good">
          +{fresh.rounds} {plural(fresh.rounds, ["новый раунд", "новых раунда", "новых раундов"])}
        </span>
      ) : null}
    </span>
  );

  return (
    <TeacherDashboard
      name={name}
      code={code}
      stats={stats}
      status={status}
      invite={<InvitePanel code={code} joinUrl={joinUrl} qrSvg={qrSvg} />}
    />
  );
}
