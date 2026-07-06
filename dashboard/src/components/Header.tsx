// ========================================
// Header.tsx — ページ上部のヘッダー部品
// ========================================
// サイトのタイトルと、最終更新日時・記事総数を表示する。
// ========================================

// この部品が受け取るデータの形
interface HeaderProps {
  generatedAt: string | null;  // データの生成日時
  totalArticles: number;       // 記事の総数
}

/**
 * 日時を「2026年7月6日 07:00 更新」の形式に変換する関数
 */
function formatGeneratedAt(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")} 更新`;
}

export default function Header({ generatedAt, totalArticles }: HeaderProps) {
  return (
    <header className="header">
      <div className="container">
        <h1>📰 News Curator</h1>
        <p className="subtitle">
          AIが厳選した自分専用ニュース
          {generatedAt && ` ｜ ${formatGeneratedAt(generatedAt)}`}
          {` ｜ 全${totalArticles}件`}
        </p>
      </div>
    </header>
  );
}
