// ========================================
// CategoryTabs.tsx — カテゴリ切替タブ部品（複数選択対応）
// ========================================
// 「通信・キャリア」「AI・クラウド」などのカテゴリを
// 切り替えるためのタブボタンを表示する部品。
//
// 【複数選択の仕組み】
//   タブをクリックするたびに 選択⇔解除 が切り替わる（トグル動作）。
//   例えば「通信・キャリア」と「AI・クラウド」を両方選択すると、
//   2つのカテゴリの記事がまとめて表示される。
//   「すべて」をクリックすると選択が全解除され、全記事表示に戻る。
// ========================================

import type { CategoryInfo } from "@/lib/types";

// この部品が受け取るデータの形
interface CategoryTabsProps {
  categories: Record<string, CategoryInfo>;  // 表示するカテゴリ一覧
  articleCounts: Record<string, number>;     // カテゴリごとの記事数
  selectedCategories: Set<string>;           // 選択中のカテゴリID一覧（空=すべて表示）
  onToggle: (categoryId: string) => void;    // タブがクリックされた時に呼ぶ関数
  onClearAll: () => void;                    // 「すべて」がクリックされた時に呼ぶ関数
}

export default function CategoryTabs({
  categories,
  articleCounts,
  selectedCategories,
  onToggle,
  onClearAll,
}: CategoryTabsProps) {
  // 表示中のカテゴリ全体の記事数を合計する
  const totalCount = Object.keys(categories).reduce(
    (sum, id) => sum + (articleCounts[id] ?? 0),
    0
  );

  return (
    <div className="tabs">
      {/* 「すべて」タブ（何も選択していない状態 = 全記事表示） */}
      <button
        className={`tab ${selectedCategories.size === 0 ? "active" : ""}`}
        onClick={onClearAll}
      >
        すべて
        <span className="count">{totalCount}</span>
      </button>

      {/* カテゴリごとのタブを1つずつ作る（クリックで選択⇔解除） */}
      {Object.entries(categories).map(([categoryId, info]) => (
        <button
          key={categoryId}
          // 選択中のタブには "active" クラスを付けて色を変える
          className={`tab ${selectedCategories.has(categoryId) ? "active" : ""}`}
          onClick={() => onToggle(categoryId)}
        >
          {info.display_name}
          <span className="count">{articleCounts[categoryId] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
