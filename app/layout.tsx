import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-unbounded" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains" });

const DESCRIPTION = "Игра по алгебре: ИИ-стажёр Алибек ошибается, а ты находишь ошибку и доказываешь её контрпримером.";

// Vercel exposes the production domain at build time; locally the relative URLs are enough.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Synaq",
  description: DESCRIPTION,
  openGraph: {
    title: "Synaq: ИИ ошибся. Докажи это.",
    description: DESCRIPTION,
    siteName: "Synaq",
    locale: "ru_RU",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Synaq: ИИ ошибся. Докажи это.", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`h-full ${geist.variable} ${unbounded.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
