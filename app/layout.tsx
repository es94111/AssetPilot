import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetPilot - 個人財務指揮中心",
  description: "自架、加密的個人財務管理工具，整合記帳、預算、台股投資與報表分析。",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=window.matchMedia('(prefers-color-scheme:dark)').matches;var dark=t==='dark'||(t==='system'&&d);var root=document.documentElement;if(dark){root.classList.add('dark-mode');root.style.backgroundColor='#0c0f16';root.style.colorScheme='dark';}else{root.style.backgroundColor='#f4f6fa';root.style.colorScheme='light';}}catch(e){}})();`;

  return (
    <html lang="zh-TW">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}
