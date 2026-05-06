import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "記帳網頁 - 儀表板",
  description: "個人記帳儀表板",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}
