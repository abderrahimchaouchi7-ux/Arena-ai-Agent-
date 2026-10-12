import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";
import { readLangCookie } from "@/lib/auth";
import { DEFAULT_LANG, LANG_META, LANGS, type Lang } from "@/lib/config";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "RABT — Artisans de confiance",
  description:
    "RABT met en relation les clients avec des artisans vérifiés : eau, gaz, électricité, plomberie, carrelage, peinture et construction.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RABT" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0c6b5c",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLang = await readLangCookie();
  const lang: Lang = LANGS.includes(cookieLang as Lang) ? (cookieLang as Lang) : DEFAULT_LANG;
  const meta = LANG_META[lang];

  return (
    <html lang={lang} dir={meta.dir} suppressHydrationWarning>
      <body className="antialiased">
        <LangProvider initial={lang}>{children}</LangProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
