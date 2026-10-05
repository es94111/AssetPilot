import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary, getTranslator } from "@/lib/i18n/getDictionary";
import { HTML_DIR, HTML_LANG } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import SplashIntro from "@/components/public/SplashIntro";
import { themeInitScript } from "@/lib/themeScript";

// 標題字與內文字分開載入：Fraunces 走暖感襯線 display，Inter 維持內文可讀性。
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const t = getTranslator(locale);

  return {
    title: t("public.common.metadataTitle"),
    description: t("public.common.metadataDescription"),
    applicationName: "AssetPilot",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "AssetPilot",
      statusBarStyle: "default",
    },
    icons: {
      icon: "/favicon.svg",
      apple: "/icons/icon-192.png",
    },
  };
}

// theme-color 需與 manifest 的 theme_color 一致，讓 Android 安裝後的狀態列與
// standalone 視窗外框相符（Next.js 16 要求 themeColor 由 viewport 匯出）。
export function generateViewport(): Viewport {
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#b0521c" },
      { media: "(prefers-color-scheme: dark)", color: "#141210" },
    ],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveLocale();
  const dict = getDictionary(locale);

  return (
    <html lang={HTML_LANG[locale]} dir={HTML_DIR[locale]} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <I18nProvider locale={locale} dict={dict}>
          <ToastProvider>
            {children}
            <SplashIntro />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
