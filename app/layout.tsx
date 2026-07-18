import type { Metadata } from "next";
import "./globals.css";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary, getTranslator } from "@/lib/i18n/getDictionary";
import { HTML_DIR, HTML_LANG } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";

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
  const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=window.matchMedia('(prefers-color-scheme:dark)').matches;var dark=t==='dark'||(t==='system'&&d);var root=document.documentElement;if(dark){root.classList.add('dark-mode');root.style.backgroundColor='#0c0f16';root.style.colorScheme='dark';}else{root.style.backgroundColor='#f4f6fa';root.style.colorScheme='light';}}catch(e){}})();`;

  const locale = await resolveLocale();
  const dict = getDictionary(locale);

  return (
    <html lang={HTML_LANG[locale]} dir={HTML_DIR[locale]}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <I18nProvider locale={locale} dict={dict}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
