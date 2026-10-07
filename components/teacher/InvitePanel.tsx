"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowsOutIcon, CopyIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/game/ui";

/** Class code, join QR and link. Can go full screen on a projector so a whole room can join. */
export default function InvitePanel({ code, joinUrl, qrSvg }: { code: string; joinUrl: string; qrSvg: string }) {
  const ref = useRef<HTMLElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  // In-page overlay for browsers that refuse the Fullscreen API (iOS Safari, iframes).
  const [overlay, setOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  const fullscreen = nativeFullscreen || overlay;

  useEffect(() => {
    const onChange = () => setNativeFullscreen(document.fullscreenElement === ref.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlay(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function toggleFullscreen() {
    if (overlay) {
      setOverlay(false);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (ref.current?.requestFullscreen) await ref.current.requestFullscreen();
      else setOverlay(true);
    } catch {
      setOverlay(true);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const shortUrl = joinUrl.replace(/^https?:\/\//, "").replace(/#join$/, "");

  return (
    <section
      ref={ref}
      aria-label="Приглашение в класс"
      className={
        fullscreen
          ? `flex min-h-[100dvh] flex-col items-center justify-center gap-10 bg-ink p-10 text-center ${overlay ? "fixed inset-0 z-50 overflow-y-auto" : ""}`
          : "mt-6 grid gap-6 rounded-xl border border-line bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center print:hidden"
      }
    >
      <div
        className={`overflow-hidden rounded-xl bg-white ${fullscreen ? "w-[min(60vh,80vw)]" : "w-40 sm:w-44"}`}
        // The SVG is generated on our server from the join URL; it contains no user input but the code.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className={fullscreen ? "flex flex-col items-center gap-4" : "flex min-w-0 flex-col gap-3"}>
        <p className={fullscreen ? "text-3xl text-muted" : "text-muted"}>
          Отсканируй QR или открой ссылку и введи код
        </p>
        <p
          className={`font-mono font-bold tracking-[0.25em] text-pen ${fullscreen ? "text-[clamp(4rem,12vw,9rem)] leading-none" : "text-4xl sm:text-5xl"}`}
        >
          {code}
        </p>
        <p className={`break-all font-mono ${fullscreen ? "text-2xl" : "text-sm text-muted"}`}>{shortUrl}</p>
        <div className={`flex flex-wrap gap-3 ${fullscreen ? "justify-center" : ""}`}>
          <button type="button" onClick={toggleFullscreen} className={buttonClass(fullscreen ? "secondary" : "primary")}>
            {fullscreen ? <XIcon size={18} weight="bold" aria-hidden /> : <ArrowsOutIcon size={18} weight="bold" aria-hidden />}
            {fullscreen ? "Свернуть" : "На весь экран"}
          </button>
          {!fullscreen ? (
            <button type="button" onClick={copy} className={buttonClass("secondary")}>
              <CopyIcon size={18} aria-hidden />
              {copied ? "Скопировано" : "Копировать ссылку"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
