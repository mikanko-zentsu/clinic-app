import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "接骨院 受付システム",
  description: "予約・受付を店頭で完結するiPad向けシステム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
