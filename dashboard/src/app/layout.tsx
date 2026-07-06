// ========================================
// layout.tsx — サイト全体の共通レイアウト
// ========================================
// Next.jsでは、このファイルが全ページの「外枠」になる。
// HTMLの<html>タグや<body>タグ、共通のCSS読み込みをここで行う。
// ========================================

import type { Metadata } from "next";
import "./globals.css"; // サイト全体のスタイルを読み込む

// ページのタイトルや説明文（ブラウザのタブに表示される）
export const metadata: Metadata = {
  title: "News Curator — 自分専用ニュースダッシュボード",
  description: "AIが厳選したニュースを毎日自動で収集するダッシュボード",
};

// 全ページの共通レイアウト
// children には各ページの中身（page.tsx）が入る
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
