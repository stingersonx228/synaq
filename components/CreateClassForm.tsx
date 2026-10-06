"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Created = { name: string; code: string; link: string };
type State = { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string } | { kind: "created"; data: Created };

export default function CreateClassForm() {
  const [name, setName] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const trimmed = name.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || state.kind === "pending") return;
    setState({ kind: "pending" });
    try {
      const res = await fetch("/api/teacher/class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.status === 503) {
        setState({ kind: "error", message: "База данных не подключена, поэтому создать класс сейчас нельзя." });
        return;
      }
      const data: unknown = await res.json();
      if (!res.ok || typeof data !== "object" || data === null) throw new Error("bad response");
      const { code, token, name: savedName } = data as Record<string, unknown>;
      if (typeof code !== "string" || typeof token !== "string" || typeof savedName !== "string") {
        throw new Error("bad response");
      }
      setState({
        kind: "created",
        data: { name: savedName, code, link: `${window.location.origin}/teacher/${token}` },
      });
    } catch {
      setState({ kind: "error", message: "Не получилось создать класс. Проверьте интернет и попробуйте ещё раз." });
    }
  }

  if (state.kind === "created") return <CreatedClass data={state.data} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Название класса</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="Например, 9 «Б», алгебра"
          className="rounded-xl border border-line bg-ink px-4 py-3 text-xl outline-none focus:border-accent"
        />
      </label>
      {state.kind === "error" ? (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2" role="alert">
          {state.message}{" "}
          <Link href="/teacher/demo" className="text-accent underline">
            Посмотреть демо-панель
          </Link>
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!trimmed || state.kind === "pending"}
        className="min-h-12 rounded-xl bg-accent px-4 py-3 text-lg font-bold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state.kind === "pending" ? "Создаём…" : "Создать класс"}
      </button>
    </form>
  );
}

function CreatedClass({ data }: { data: Created }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-muted">Код класса «{data.name}» для учеников</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="font-mono text-4xl font-bold tracking-[0.3em] text-accent">{data.code}</span>
          <CopyButton text={data.code} />
        </div>
        <p className="mt-1 text-muted">Ученики вводят его на главной странице вместе с псевдонимом.</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">Секретная ссылка на вашу панель</p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={data.link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 py-2 font-mono text-sm"
            aria-label="Ссылка на панель учителя"
          />
          <CopyButton text={data.link} />
        </div>
      </div>
      <p className="rounded-xl border-2 border-bad/60 bg-bad/10 px-4 py-3 text-lg font-semibold" role="alert">
        Сохраните ссылку сейчас: она показывается один раз, восстановить её нельзя. Не отправляйте её ученикам.
      </p>
      <a
        href={data.link}
        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-panel-2 px-4 text-lg font-semibold hover:border-muted"
      >
        Открыть панель
      </a>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="min-h-10 shrink-0 rounded-xl border border-line px-3 font-semibold hover:border-muted"
    >
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}
