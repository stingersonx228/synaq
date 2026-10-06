"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { joinClass } from "@/lib/client";
import { setStudent } from "@/lib/session";

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const NICK_MIN = 2;
const NICK_MAX = 24;

export default function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const normCode = code.trim().toUpperCase();
  const normNick = nickname.trim().replace(/\s+/g, " ");
  const valid = CODE_RE.test(normCode) && normNick.length >= NICK_MIN && normNick.length <= NICK_MAX;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    const res = await joinClass(normCode, normNick);
    if (res.ok) {
      setStudent({ studentId: res.studentId, nickname: res.nickname, className: res.className });
      router.push("/play");
      return;
    }
    setPending(false);
    if (res.error === "class_not_found") setError("Класс с таким кодом не найден. Проверь код у учителя.");
    else if (res.error === "invalid") setError("Проверь код класса и псевдоним.");
    else {
      // No database or no network: play locally without bothering the student.
      setStudent(null);
      router.push("/play");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Код класса</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="Например, K7M2QX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="rounded-xl border border-line bg-ink px-4 py-3 font-mono text-xl uppercase tracking-[0.3em] outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Псевдоним</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, NICK_MAX))}
          placeholder="Например, Барыс_42"
          autoComplete="off"
          className="rounded-xl border border-line bg-ink px-4 py-3 text-xl outline-none focus:border-accent"
        />
        <span className="text-sm text-muted">Не пиши настоящее имя — учитель узнает тебя по псевдониму.</span>
      </label>
      {error ? (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!valid || pending}
        className="min-h-12 rounded-xl bg-accent px-4 py-3 text-lg font-bold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
