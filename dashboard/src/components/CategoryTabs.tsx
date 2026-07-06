// ========================================
// CategoryTabs.tsx — カテゴリ切替タブ部品
// ========================================
// 「通信・キャリア」「AI・クラウド」などのカテゴリを
// 切り替えるためのタブボタンを表示する部品。
// タブをクリックすると、そのカテゴリの記事だけが表示される。
// ========================================

import type { CategoryInfo } from "@/lib/types";

// この部品が受け取るデータの形
interface CategoryTabsProps {
  categories: Record<string, CategoryInfo>;  // カテゴリ一覧
  articleCounts: Record<string, number>;     // カテゴリごとの記事数
  activeCategory: string;                    // 現在選択中のカテゴリID
  onSelect: (categoryId: string) => void;    // タブがクリックされた時に呼ぶ関数
}

export default function CategoryTabs({
  categories,
  articleCounts,
  activeCategory,
  onSelect,
}: CategoryTabsProps) {
  return (
    <div className="tabs">
      {/* 「すべて」タブ（全カテゴリの記事を表示する） */}
      <button
        className={`tab ${activeCategory === "all" ? "active" : ""}`}
        onClick={() => onSelect("all")}
      >
        すべて
        <span className="count">
          {/* 全カテゴリの記事数を合計する */}
          {Object.values(articleCounts).reduce((sum, n) => sum + n, 0)}
        </span>
      </button>

      {/* カテゴリごとのタブを1つずつ作る */}
      {Object.entries(categories).map(([categoryId, info]) => (
        <button
          key={categoryId}
          // 選択中のタブには "active" クラスを付けて色を変える
          className={`tab ${activeCategory === categoryId ? "active" : ""}`}
          onClick={() => onSelect(categoryId)}
        >
          {info.display_name}
          <span className="count">{articleCounts[categoryId] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
