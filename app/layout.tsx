import type { Metadata } from "next";
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
    icons: {
      icon: "/favicon.svg",
    },
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
    <html lang={HTML_LANG[locale]} dir={HTML_DIR[locale]}>
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
