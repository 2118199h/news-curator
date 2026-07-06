// ========================================
// page.tsx — メインダッシュボードページ
// ========================================
// サイトを開いた時に表示されるメインページ。
//
// 処理の流れ:
//   1. articles.json を読み込む
//   2. カテゴリタブと記事一覧を表示する
//   3. タブをクリックするとそのカテゴリの記事だけに絞り込む
//
// "use client" について:
//   このページはタブの切り替え（クリック操作）があるため、
//   ブラウザ側で動く「クライアントコンポーネント」として宣言している。
// ========================================

"use client";

import { useState, useEffect } from "react";
import type { ArticlesData, Article } from "@/lib/types";
import Header from "@/components/Header";
import CategoryTabs from "@/components/CategoryTabs";
import ArticleCard from "@/components/ArticleCard";

export default function Home() {
  // ============================================
  // 状態（state）の定義
  // 状態とは「画面の表示に影響する、変化するデータ」のこと
  // ============================================

  // 読み込んだ記事データ全体（読み込み前は null）
  const [data, setData] = useState<ArticlesData | null>(null);

  // 現在選択中のカテゴリ（初期値は "all" = すべて表示）
  const [activeCategory, setActiveCategory] = useState("all");

  // 読み込みエラーが起きたかどうか
  const [loadError, setLoadError] = useState(false);

  // ============================================
  // データの読み込み
  // useEffect はページが表示された時に1回だけ実行される
  // ============================================
  useEffect(() => {
    // GitHub Pages では /news-curator/ がURLの先頭に付くため、
    // 環境に応じたパスで articles.json を読み込む
    const basePath = process.env.NODE_ENV === "production" ? "/news-curator" : "";

    fetch(`${basePath}/data/articles.json`)
      .then((response) => {
        if (!response.ok) throw new Error("読み込み失敗");
        return response.json();
      })
      .then((json: ArticlesData) => setData(json))
      .catch(() => setLoadError(true)); // エラー時はエラーフラグを立てる
  }, []);

  // ============================================
  // エラー時・読み込み中の表示
  // ============================================
  if (loadError) {
    return (
      <main>
        <Header generatedAt={null} totalArticles={0} />
        <div className="container">
          <p className="empty-message">
            データの読み込みに失敗しました。
            <br />
            まだ記事が収集されていない可能性があります。
            <br />
            collector/main.py と collector/export_json.py を実行してください。
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main>
        <Header generatedAt={null} totalArticles={0} />
        <div className="container">
          <p className="empty-message">読み込み中...</p>
        </div>
      </main>
    );
  }

  // ============================================
  // 記事の絞り込み
  // ============================================

  // カテゴリごとの記事数を数える（タブのバッジ表示用）
  const articleCounts: Record<string, number> = {};
  for (const article of data.articles) {
    articleCounts[article.category] = (articleCounts[article.category] ?? 0) + 1;
  }

  // 選択中のカテゴリの記事だけに絞り込む
  // "all" の場合は全記事を表示する
  const filteredArticles: Article[] =
    activeCategory === "all"
      ? data.articles
      : data.articles.filter((article) => article.category === activeCategory);

  // ============================================
  // 画面の描画
  // ============================================
  return (
    <main>
      {/* ヘッダー: タイトルと更新日時 */}
      <Header generatedAt={data.generated_at} totalArticles={data.total_articles} />

      <div className="container">
        {/* カテゴリ切替タブ */}
        <CategoryTabs
          categories={data.categories}
          articleCounts={articleCounts}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* 記事一覧（絞り込み後の記事を1件ずつカードで表示） */}
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        ) : (
          <p className="empty-message">このカテゴリの記事はまだありません</p>
        )}

        {/* フッター */}
        <footer className="footer">
          News Curator — RSSから自動収集し、Gemini AIがフィルタリングしています
        </footer>
      </div>
    </main>
  );
}
