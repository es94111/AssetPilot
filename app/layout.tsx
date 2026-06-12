import type { Metadata } from "next";
import "./globals.css";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { HTML_LANG } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/i18n/I18nProvider";

export const metadata: Metadata = {
  title: "AssetPilot - 個人財務指揮中心",
  description: "自架、加密的個人財務管理工具，整合記帳、預算、台股投資與報表分析。",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=window.matchMedia('(prefers-color-scheme:dark)').matches;var dark=t==='dark'||(t==='system'&&d);var root=document.documentElement;if(dark){root.classList.add('dark-mode');root.style.backgroundColor='#0c0f16';root.style.colorScheme='dark';}else{root.style.backgroundColor='#f4f6fa';root.style.colorScheme='light';}}catch(e){}})();`;

  const locale = await resolveLocale();
  const dict = getDictionary(locale);

  return (
    <html lang={HTML_LANG[locale]}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <I18nProvider locale={locale} dict={dict}>
          <main>{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
