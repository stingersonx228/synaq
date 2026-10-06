import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Обратный экзамен — проверь ИИ-стажёра",
  description: "Образовательная игра: найди ошибку ИИ-стажёра Алибека в решении и докажи её контрпримером.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
