"use client";

import { PrinterIcon } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/game/ui";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "print:hidden")}>
      <PrinterIcon size={18} aria-hidden />
      Распечатать отчёт
    </button>
  );
}
