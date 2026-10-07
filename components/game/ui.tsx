import Link from "next/link";
import type { ReactNode } from "react";
import { HeartIcon, RobotIcon, StarIcon } from "@phosphor-icons/react/dist/ssr";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-display text-sm font-bold tracking-tight text-text sm:text-base ${className}`}>
      Обратный <span className="text-pen">экзамен</span>
    </Link>
  );
}

export function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Жизни: ${lives} из ${max}`} role="img">
      {Array.from({ length: max }, (_, i) => (
        <HeartIcon
          key={i}
          size={22}
          weight={i < lives ? "fill" : "regular"}
          className={i < lives ? "text-bad" : "text-line"}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function Stars({ count, size = 20 }: { count: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Звёзд: ${count} из 3`} role="img">
      {[0, 1, 2].map((i) => (
        <StarIcon
          key={i}
          size={size}
          weight={i < count ? "fill" : "regular"}
          className={i < count ? "text-pen" : "text-line"}
          aria-hidden
        />
      ))}
    </span>
  );
}

const BUTTON_STYLES = {
  primary: "bg-pen text-ink hover:brightness-110",
  good: "bg-good text-ink hover:brightness-110",
  secondary: "border border-line bg-surface-2 text-text hover:border-muted",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
} as const;

export type ButtonVariant = keyof typeof BUTTON_STYLES;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${BUTTON_STYLES[variant]} ${extra}`;
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
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={buttonClass(variant, className)}>
      {children}
    </button>
  );
}

export function InternAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" }[size];
  const icon = { sm: 18, md: 22, lg: 30 }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-intern/12 text-intern ring-1 ring-intern/30 ${box}`}
      aria-hidden
    >
      <RobotIcon size={icon} weight="duotone" />
    </span>
  );
}
