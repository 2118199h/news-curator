// ========================================
// page.tsx — メインダッシュボードページ
// ========================================
// サイトを開いた時に表示されるメインページ。
//
// 画面の構成:
//   1. ヘッダー（タイトル・更新日時）
//   2. 言語切替（国内ニュース / 海外ニュース）← 別画面として切り替わる
//   3. カテゴリタブ（複数選択できる）
//   4. 記事一覧
//
// "use client" について:
//   このページはクリック操作（タブ切替など）があるため、
//   ブラウザ側で動く「クライアントコンポーネント」として宣言している。
// ========================================

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ArticlesData, Article, CategoryInfo } from "@/lib/types";
import Header from "@/components/Header";
import CategoryTabs from "@/components/CategoryTabs";
import ArticleCard from "@/components/ArticleCard";
import UpdateButton from "@/components/UpdateButton";
import { recordAccess } from "@/lib/github";

export default function Home() {
  // ============================================
  // 状態（state）の定義
  // 状態とは「画面の表示に影響する、変化するデータ」のこと
  // ============================================

  // 読み込んだ記事データ全体（読み込み前は null）
  const [data, setData] = useState<ArticlesData | null>(null);

  // 表示中の言語画面（"ja" = 国内ニュース, "en" = 海外ニュース）
  const [activeLanguage, setActiveLanguage] = useState<"ja" | "en">("ja");

  // 選択中のカテゴリID一覧（複数選択できるので Set を使う）
  // Set とは「重複のない値の集まり」。空の場合は「すべて表示」の意味
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );

  // 読み込みエラーが起きたかどうか
  const [loadError, setLoadError] = useState(false);

  // --- NEWバッジ・既読管理用の状態 ---
  // 前回訪問した日時。これより新しく取得された記事に「NEW」を付ける
  const [newThreshold, setNewThreshold] = useState<string | null>(null);

  // 既読（クリック済み）記事のURL一覧
  const [readUrls, setReadUrls] = useState<Set<string>>(new Set());

  // 「未読のみ表示」モードのON/OFF
  const [unreadOnly, setUnreadOnly] = useState(false);

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

    // 「サイトを見た」記録をGitHubに残す（30日ルール用）
    // トークン未登録なら何もしない。失敗しても表示に影響しない。
    recordAccess();

    // --- NEWバッジの基準時刻を決める ---
    // 「前回の訪問」を記録しておき、それより新しい記事にNEWを付ける。
    // ページを再読み込みしただけでNEWが消えないよう、
    // 30分以上間が空いた時だけ「新しい訪問」とみなす。
    const now = new Date().toISOString();
    const currentVisit = localStorage.getItem("visit_current"); // 直近の閲覧時刻
    const prevVisit = localStorage.getItem("visit_prev");       // 前回の訪問時刻

    if (currentVisit) {
      const minutesSince =
        (Date.now() - new Date(currentVisit).getTime()) / (1000 * 60);
      if (minutesSince > 30) {
        // 30分以上ぶりの訪問 → 「前回の訪問」を更新する
        localStorage.setItem("visit_prev", currentVisit);
        setNewThreshold(currentVisit);
      } else {
        // 直前にも見ていた（再読み込みなど） → 基準は変えない
        setNewThreshold(prevVisit);
      }
    }
    localStorage.setItem("visit_current", now);

    // --- 既読記事のURL一覧を読み込む ---
    try {
      const saved = JSON.parse(localStorage.getItem("read_urls") ?? "[]");
      if (Array.isArray(saved)) setReadUrls(new Set(saved));
    } catch {
      // 壊れていたら無視して空から始める
    }
  }, []);

  /** 記事がクリックされた時: 既読として記録する */
  function markAsRead(url: string) {
    setReadUrls((prev) => {
      const next = new Set(prev);
      next.add(url);
      // ブラウザに保存する（最新500件だけ保持して肥大化を防ぐ）
      localStorage.setItem(
        "read_urls",
        JSON.stringify([...next].slice(-500))
      );
      return next;
    });
  }

  // ============================================
  // タブ操作の関数
  // ============================================

  /** カテゴリタブがクリックされた時: 選択⇔解除を切り替える */
  function toggleCategory(categoryId: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev); // 今の選択状態をコピー
      if (next.has(categoryId)) {
        next.delete(categoryId); // 選択済みなら解除
      } else {
        next.add(categoryId); // 未選択なら追加
      }
      return next;
    });
  }

  /** 「すべて」がクリックされた時: 選択を全解除する */
  function clearCategories() {
    setSelectedCategories(new Set());
  }

  /** 言語画面を切り替えた時: カテゴリ選択もリセットする */
  function switchLanguage(lang: "ja" | "en") {
    setActiveLanguage(lang);
    setSelectedCategories(new Set()); // 画面が変わるので選択をリセット
  }

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

  // --- ステップ1: 表示中の言語のカテゴリだけを取り出す ---
  // 例: 国内画面なら language が "ja" のカテゴリだけ
  const visibleCategories: Record<string, CategoryInfo> = {};
  for (const [id, info] of Object.entries(data.categories)) {
    // language が未設定の古いデータは日本語（ja）とみなす
    const lang = info.language ?? "ja";
    if (lang === activeLanguage) {
      visibleCategories[id] = info;
    }
  }

  // --- ステップ2: カテゴリごとの記事数を数える（タブのバッジ表示用） ---
  const articleCounts: Record<string, number> = {};
  for (const article of data.articles) {
    articleCounts[article.category] =
      (articleCounts[article.category] ?? 0) + 1;
  }

  // --- ステップ3: 記事を絞り込む ---
  // 条件1: 表示中の言語のカテゴリに属していること
  // 条件2: カテゴリが選択されている場合は、そのカテゴリに属していること
  //        （何も選択されていなければ、言語内の全記事を表示）
  const filteredArticles: Article[] = data.articles.filter((article) => {
    // 条件1: この記事のカテゴリが表示中の言語のものか
    if (!(article.category in visibleCategories)) return false;

    // 条件2: カテゴリが選択されていれば、選択されたものだけ
    if (selectedCategories.size > 0 && !selectedCategories.has(article.category)) {
      return false;
    }

    // 条件3: 「未読のみ表示」がONなら、既読の記事を隠す
    if (unreadOnly && readUrls.has(article.url)) return false;

    return true;
  });

  /** 記事が「NEW」かどうかを判定する関数 */
  function isNewArticle(article: Article): boolean {
    // 前回の訪問記録がなければ（初めての訪問）NEWは付けない
    if (!newThreshold) return false;
    // 前回訪問より後に取得された記事ならNEW
    return article.fetched_at > newThreshold;
  }

  // NEW記事と未読記事の数（ボタンの表示用）
  const unreadCount = filteredArticles.filter(
    (a) => !readUrls.has(a.url)
  ).length;

  // ============================================
  // 画面の描画
  // ============================================
  return (
    <main>
      {/* ヘッダー: タイトルと更新日時 */}
      <Header
        generatedAt={data.generated_at}
        totalArticles={data.total_articles}
      />

      <div className="container">
        {/* 操作バー: 更新ボタン・未読フィルタ・設定ページへのリンク */}
        <div className="action-bar">
          <UpdateButton />
          {/* 未読のみ表示の切替ボタン */}
          <button
            className={`unread-toggle ${unreadOnly ? "active" : ""}`}
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            {unreadOnly ? "📖 すべて表示" : `📬 未読のみ（${unreadCount}）`}
          </button>
          <Link href="/settings" className="settings-link">
            ⚙️ 設定
          </Link>
        </div>

        {/* 言語切替（国内 / 海外）: 別画面のように切り替わる */}
        <div className="language-switch">
          <button
            className={`language-button ${activeLanguage === "ja" ? "active" : ""}`}
            onClick={() => switchLanguage("ja")}
          >
            🇯🇵 国内ニュース
          </button>
          <button
            className={`language-button ${activeLanguage === "en" ? "active" : ""}`}
            onClick={() => switchLanguage("en")}
          >
            🇺🇸 海外ニュース
          </button>
        </div>

        {/* カテゴリ切替タブ（複数選択可能） */}
        <CategoryTabs
          categories={visibleCategories}
          articleCounts={articleCounts}
          selectedCategories={selectedCategories}
          onToggle={toggleCategory}
          onClearAll={clearCategories}
        />

        {/* 記事一覧（絞り込み後の記事を1件ずつカードで表示） */}
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              isNew={isNewArticle(article)}
              isRead={readUrls.has(article.url)}
              onRead={markAsRead}
            />
          ))
        ) : (
          <p className="empty-message">
            {unreadOnly
              ? "未読の記事はありません 🎉"
              : "該当する記事はまだありません"}
          </p>
        )}

        {/* フッター */}
        <footer className="footer">
          News Curator — RSSから自動収集し、フィルタリングして表示しています
        </footer>
      </div>
    </main>
  );
}
