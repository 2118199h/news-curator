// ========================================
// types.ts — TypeScript型定義
// ========================================
// TypeScriptの「型」とは、データの形を事前に決めておく仕組み。
// 例えば「記事には必ずタイトルとURLがある」と定義しておくことで、
// タイプミスやデータの間違いをエディタが教えてくれる。
//
// ここでは articles.json の中身の形を定義している。
// ========================================

/** 記事1件分のデータの形 */
export interface Article {
  id: number;                    // 記事の一意なID
  title: string;                 // 記事タイトル
  url: string;                   // 記事のURL
  source: string;                // 配信元の名前（例: "ITmedia Mobile"）
  category: string;              // カテゴリID（例: "telecom"）
  published_at: string | null;   // 公開日時（ない場合もある）
  fetched_at: string;            // 取得日時
  description: string | null;    // 記事の概要文
  relevance_score: number;       // 関連度スコア（3〜5）
  summary: string | null;        // Geminiが生成した3行要約
  keywords: string | null;       // カンマ区切りのキーワード（例: "AI,クラウド"）
}

/** カテゴリ情報の形 */
export interface CategoryInfo {
  display_name: string;   // 画面に表示する名前（例: "通信・キャリア"）
  description: string;    // カテゴリの説明文
}

/** articles.json 全体の形 */
export interface ArticlesData {
  generated_at: string;                        // JSONが生成された日時
  total_articles: number;                      // 記事の総数
  categories: Record<string, CategoryInfo>;    // カテゴリID → カテゴリ情報の対応表
  articles: Article[];                         // 記事の配列
}
