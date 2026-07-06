// ========================================
// next.config.ts — Next.jsの設定ファイル
// ========================================
// このダッシュボードは「静的サイト」として書き出す設定にしている。
// 静的サイト = サーバー不要のHTMLファイル群。GitHub Pagesで無料公開できる。
// ========================================

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "export" = ビルド時に静的HTMLとして書き出す（out/ フォルダに生成される）
  output: "export",

  // GitHub Pagesでは https://ユーザー名.github.io/news-curator/ のように
  // リポジトリ名がURLに入るため、そのパスを設定する
  // ローカル開発時（npm run dev）はこの設定は無視される
  basePath: process.env.NODE_ENV === "production" ? "/news-curator" : "",

  // 画像最適化サーバーが使えないため無効化（静的サイトでは必須の設定）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
