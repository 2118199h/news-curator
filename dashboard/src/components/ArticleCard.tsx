// ========================================
// ArticleCard.tsx — 記事カード部品
// ========================================
// 1件の記事を表示するカード型のUI部品（コンポーネント）。
// タイトル・配信元・日付・要約・キーワードを1枚のカードにまとめる。
// ========================================

import type { Article } from "@/lib/types";

// スコアの数字を日本語ラベルに変換する対応表
const SCORE_LABELS: Record<number, string> = {
  5: "★ 必読",
  4: "重要",
  3: "関連",
};

/**
 * 日付文字列を「1月15日 12:30」のような読みやすい形式に変換する関数
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "日付不明";

  const date = new Date(dateString);
  // 無効な日付の場合
  if (isNaN(date.getTime())) return "日付不明";

  return `${date.getMonth() + 1}月${date.getDate()}日 ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * 記事カードコンポーネント
 * 引数 article に記事1件分のデータを受け取って表示する
 */
export default function ArticleCard({ article }: { article: Article }) {
  // キーワード文字列（"AI,クラウド"）を配列（["AI", "クラウド"]）に変換
  // キーワードがない場合は空の配列にする
  const keywordList = article.keywords
    ? article.keywords.split(",").filter((k) => k.trim() !== "")
    : [];

  return (
    // className に score-4 などを付けると、CSSで左枠の色が変わる
    <div className={`article-card score-${article.relevance_score}`}>
      {/* 記事タイトル（クリックで元記事を新しいタブで開く） */}
      <h2>
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {article.title}
        </a>
      </h2>

      {/* メタ情報: 配信元・日付・スコア */}
      <div className="article-meta">
        <span className="source-badge">{article.source}</span>
        <span>{formatDate(article.published_at)}</span>
        <span className={`score-badge score-${article.relevance_score}`}>
          {SCORE_LABELS[article.relevance_score] ?? ""}
        </span>
      </div>

      {/* AIが生成した3行要約（ある場合のみ表示） */}
      {article.summary && (
        <p className="article-summary">{article.summary}</p>
      )}

      {/* キーワードタグ（ある場合のみ表示） */}
      {keywordList.length > 0 && (
        <div className="keywords">
          {keywordList.map((keyword) => (
            <span key={keyword} className="keyword-tag">
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
