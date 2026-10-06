"use client";

import type { ReactNode } from "react";

export function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <span className="inline-flex gap-0.5 text-xl leading-none" aria-label={`Жизни: ${lives} из ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < lives ? "text-bad" : "text-line"} aria-hidden>
          ♥
        </span>
      ))}
    </span>
  );
}

export function Stars({ count, size = "text-xl" }: { count: number; size?: string }) {
  return (
    <span className={`inline-flex gap-0.5 leading-none ${size}`} aria-label={`Звёзд: ${count} из 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < count ? "text-accent" : "text-line"} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

export function Panel({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 sm:p-5 ${className}`}>
      {title ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "good";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-accent text-ink hover:brightness-110",
    good: "bg-good text-ink hover:brightness-110",
    secondary: "border border-line bg-panel-2 text-text hover:border-muted",
    ghost: "text-muted hover:text-text",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function InternAvatar({ size = "h-9 w-9 text-base" }: { size?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-intern/15 font-bold text-intern ring-1 ring-intern/40 ${size}`}
      aria-hidden
    >
      А
    </span>
  );
}
