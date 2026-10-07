"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { joinClass } from "@/lib/client";
import { setStudent } from "@/lib/session";
import { buttonClass } from "./game/ui";

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const NICK_MIN = 2;
const NICK_MAX = 24;

const inputClass =
  "w-full min-w-0 rounded-xl border border-line bg-ink px-4 py-3 text-xl outline-none transition placeholder:text-muted focus:border-pen";

export default function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
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
    else if (res.error === "invalid") setError("Псевдоним: 2-24 символа, буквы, цифры, пробел, точка, дефис или _.");
    else if (res.error === "rate_limited") setError("Слишком много попыток входа. Подожди пару минут.");
    else {
      // No database or no network: play locally without bothering the student.
      setStudent(null);
      router.push("/play");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="class-code" className="font-medium">
          Код класса
        </label>
        <input
          id="class-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 6))}
          placeholder="K7M2QX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase tracking-[0.3em]`}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="font-medium">
          Псевдоним
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, NICK_MAX))}
          placeholder="Барыс_42"
          autoComplete="off"
          autoFocus={initialCode !== ""}
          aria-describedby="nickname-help"
          className={inputClass}
        />
        <p id="nickname-help" className="text-sm text-muted">
          Не пиши настоящее имя. Учитель узнает тебя по псевдониму.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={!valid || pending} className={buttonClass("primary", "w-full text-lg")}>
        {pending ? "Входим…" : "Войти в класс"}
      </button>
    </form>
  );
}
