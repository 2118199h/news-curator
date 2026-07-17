// ========================================
// ArticleCard.tsx — 記事カード部品
// ========================================
// 1件の記事を表示するカード型のUI部品（コンポーネント）。
// タイトル・配信元・日付・要約・キーワードを1枚のカードにまとめる。
//
// 追加機能:
//   - NEWバッジ: 前回サイトを見た時より後に取得された記事に表示
//   - 既読管理: 一度クリックした記事はカード全体が薄く表示される
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

// この部品が受け取るデータの形
interface ArticleCardProps {
  article: Article;          // 記事データ
  isNew: boolean;            // 前回訪問より後の新着記事か
  isRead: boolean;           // 既読（クリック済み）か
  onRead: (url: string) => void;  // 記事がクリックされた時に呼ぶ関数
}

/**
 * 記事カードコンポーネント
 */
export default function ArticleCard({
  article,
  isNew,
  isRead,
  onRead,
}: ArticleCardProps) {
  // キーワード文字列（"AI,クラウド"）を配列（["AI", "クラウド"]）に変換
  // キーワードがない場合は空の配列にする
  const keywordList = article.keywords
    ? article.keywords.split(",").filter((k) => k.trim() !== "")
    : [];

  return (
    // 既読の記事には "read" クラスを付けて薄く表示する
    <div
      className={`article-card score-${article.relevance_score} ${isRead ? "read" : ""}`}
    >
      {/* 記事タイトル（クリックで元記事を新しいタブで開く＋既読として記録） */}
      <h2>
        {/* 未読の新着記事にはNEWバッジを表示 */}
        {isNew && !isRead && <span className="new-badge">NEW</span>}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onRead(article.url)}
        >
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
        {isRead && <span className="read-label">✓ 既読</span>}
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
