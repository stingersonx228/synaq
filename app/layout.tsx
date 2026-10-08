import type { Metadata, Viewport } from "next";
import { Caveat, Geist, JetBrains_Mono, PT_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist" });
// Textbook headings and the intern's ballpoint handwriting.
const ptSerif = PT_Serif({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], variable: "--font-pt-serif" });
const caveat = Caveat({ subsets: ["latin", "cyrillic"], variable: "--font-caveat" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains" });

const DESCRIPTION = "Игра по алгебре: ИИ-стажёр Алибек ошибается, а ты находишь ошибку и доказываешь её контрпримером.";

// Runs while the HTML is parsed, before red-pen marks are painted (see .pen-anim in globals.css).
// It adds a class to <html>, hence suppressHydrationWarning below.
const PEN_ANIM_SCRIPT = `if(document.visibilityState==="visible"&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("pen-anim")`;

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
  themeColor: "#fbfcfd",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`h-full ${geist.variable} ${ptSerif.variable} ${caveat.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: PEN_ANIM_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
