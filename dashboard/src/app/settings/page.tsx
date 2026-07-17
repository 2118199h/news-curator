// ========================================
// settings/page.tsx — 設定ページ
// ========================================
// サイト上でカテゴリとキーワードを編集するためのページ。
// URL: /settings
//
// 画面の構成:
//   1. GitHubトークンの登録（初回のみ・ログインに相当）
//   2. カテゴリごとの編集カード
//      - 「企業・組織名」と「キーワード（単語）」を分けてタグ形式で編集
//      - タグの×で削除、入力欄＋追加ボタンで追加
//   3. カテゴリの新規追加・削除
//   4. 保存ボタン → GitHubのkeywords.jsonに保存される
//
// 保存した内容は、次回のニュース収集から反映される。
// ========================================

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken, saveToken, clearToken, getFile, putFile } from "@/lib/github";

// ============================================
// このページで扱うデータの形
// ============================================

/** カテゴリ1件分の編集データ */
interface CategoryEdit {
  display_name: string;  // 表示名（例: "通信・キャリア"）
  language: string;      // "ja"（国内） or "en"（海外）
  builtin: boolean;      // true = 元からあるカテゴリ（削除不可）
  companies: string[];   // 企業・組織名のリスト
  words: string[];       // 単語のリスト
}

// ============================================
// タグ編集の部品（企業名・単語の入力欄）
// ============================================

/** タグの一覧＋追加入力欄を表示する小さな部品 */
function TagEditor({
  label,        // 見出し（例: "🏢 企業・組織名"）
  placeholder,  // 入力欄のヒント文
  tags,         // 現在のタグ一覧
  onChange,     // タグが変わった時に呼ぶ関数
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  // 入力欄の文字
  const [input, setInput] = useState("");

  /** タグを追加する（重複と空文字は無視） */
  function addTag() {
    const value = input.trim();
    if (value === "" || tags.includes(value)) {
      setInput("");
      return;
    }
    onChange([...tags, value]);
    setInput("");
  }

  /** タグを削除する */
  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="tag-editor">
      <h4>{label}</h4>
      {/* タグの一覧（×ボタン付き） */}
      <div className="tag-list">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              className="tag-remove"
              onClick={() => removeTag(tag)}
              title="削除"
            >
              ×
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="tag-empty">（まだ登録されていません）</span>
        )}
      </div>
      {/* 追加入力欄: Enterキーでも追加できる */}
      <div className="tag-input-row">
        <input
          className="tag-input"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTag();
          }}
        />
        <button className="tag-add-button" onClick={addTag}>
          ＋ 追加
        </button>
      </div>
    </div>
  );
}

// ============================================
// メインの設定ページ
// ============================================

export default function SettingsPage() {
  // --- 状態（state）の定義 ---
  const [hasToken, setHasToken] = useState(false);       // トークン登録済みか
  const [tokenInput, setTokenInput] = useState("");      // トークン入力欄
  const [categories, setCategories] = useState<Record<string, CategoryEdit>>({}); // 全カテゴリの編集データ
  const [fileSha, setFileSha] = useState("");            // 保存に必要なバージョン識別子
  const [message, setMessage] = useState("");            // 成功・エラーメッセージ
  const [loading, setLoading] = useState(false);         // 読み込み・保存中か
  const [newCatName, setNewCatName] = useState("");      // 新カテゴリの名前入力欄
  const [newCatLang, setNewCatLang] = useState("ja");    // 新カテゴリの言語選択

  // --- 初期化: トークンがあれば設定を読み込む ---
  useEffect(() => {
    if (getToken()) {
      setHasToken(true);
      loadSettings();
    }
  }, []);

  /** GitHubからカテゴリ・キーワード設定を読み込む */
  async function loadSettings() {
    setLoading(true);
    setMessage("");
    try {
      const file = await getFile("collector/keywords.json");
      const data = JSON.parse(file.content);
      setFileSha(file.sha);

      // JSONの中身を編集用のデータに変換する
      const loaded: Record<string, CategoryEdit> = {};
      for (const [id, entry] of Object.entries(data)) {
        if (id.startsWith("_")) continue; // "_説明" などは除く

        if (Array.isArray(entry)) {
          // 旧形式（ただのリスト）の場合は「単語」として読み込む
          loaded[id] = {
            display_name: id,
            language: "ja",
            builtin: true,
            companies: [],
            words: entry as string[],
          };
        } else if (typeof entry === "object" && entry !== null) {
          // 新形式
          const e = entry as Partial<CategoryEdit>;
          loaded[id] = {
            display_name: e.display_name ?? id,
            language: e.language ?? "ja",
            builtin: e.builtin ?? false,
            companies: e.companies ?? [],
            words: e.words ?? [],
          };
        }
      }
      setCategories(loaded);
    } catch (e) {
      setMessage(`読み込みエラー: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }

  /** トークンを保存して編集画面に進む */
  function handleSaveToken() {
    const t = tokenInput.trim();
    if (!t.startsWith("github_pat_") && !t.startsWith("ghp_")) {
      setMessage("トークンの形式が正しくありません（ghp_ または github_pat_ で始まります）");
      return;
    }
    saveToken(t);
    setTokenInput("");
    setHasToken(true);
    setMessage("");
    loadSettings();
  }

  /** トークンを削除する（ログアウト） */
  function handleLogout() {
    clearToken();
    setHasToken(false);
    setCategories({});
    setMessage("トークンを削除しました");
  }

  /** カテゴリの編集内容を更新する（TagEditorから呼ばれる） */
  function updateCategory(id: string, patch: Partial<CategoryEdit>) {
    setCategories((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  /** 新しいカテゴリを追加する */
  function addCategory() {
    const name = newCatName.trim();
    if (name === "") {
      setMessage("カテゴリ名を入力してください");
      return;
    }
    // カテゴリIDは自動生成する（例: custom_1720000000）
    const id = `custom_${Date.now()}`;
    setCategories((prev) => ({
      ...prev,
      [id]: {
        display_name: name,
        language: newCatLang,
        builtin: false,   // サイトで追加したカテゴリは削除できる
        companies: [],
        words: [],
      },
    }));
    setNewCatName("");
    setMessage(`カテゴリ「${name}」を追加しました。キーワードを登録して保存してください`);
  }

  /** カテゴリを削除する（サイトで追加したものだけ） */
  function removeCategory(id: string) {
    const name = categories[id]?.display_name ?? id;
    if (!confirm(`カテゴリ「${name}」を削除しますか？`)) return;
    setCategories((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /** 設定をGitHubに保存する */
  async function handleSave() {
    setLoading(true);
    setMessage("");
    try {
      // 編集データをkeywords.jsonの形式に戻す
      const data: Record<string, unknown> = {
        _説明:
          "Webサイトの設定画面から編集されるカテゴリ・キーワード設定です。companies=企業・組織名、words=単語。両方をあわせて検索に使います。builtin=true のカテゴリは config.yaml 由来（サイトから削除不可）。ここにないカテゴリは config.yaml の設定がそのまま使われ、ここに新しいカテゴリを書くと自動で追加されます。",
      };
      for (const [id, cat] of Object.entries(categories)) {
        data[id] = {
          display_name: cat.display_name,
          language: cat.language,
          builtin: cat.builtin,
          companies: cat.companies,
          words: cat.words,
        };
      }

      await putFile(
        "collector/keywords.json",
        JSON.stringify(data, null, 2) + "\n",
        fileSha,
        "サイトからカテゴリ・キーワードを更新"
      );

      // 保存後は新しいバージョン識別子を取得し直す
      const file = await getFile("collector/keywords.json");
      setFileSha(file.sha);

      setMessage("✅ 保存しました！次回の収集（または更新ボタン）から反映されます");
    } catch (e) {
      setMessage(`保存エラー: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }

  // カテゴリを「国内→海外」の順に並べる（表示用）
  const sortedEntries = Object.entries(categories).sort(
    ([, a], [, b]) => (a.language === "ja" ? 0 : 1) - (b.language === "ja" ? 0 : 1)
  );

  // ============================================
  // 画面の描画
  // ============================================
  return (
    <main>
      <header className="header">
        <div className="container">
          <h1>⚙️ 設定 — カテゴリとキーワードの編集</h1>
          <p className="subtitle">
            <Link href="/" style={{ color: "white" }}>
              ← ダッシュボードに戻る
            </Link>
          </p>
        </div>
      </header>

      <div className="container">
        {message && <p className="settings-message">{message}</p>}

        {!hasToken ? (
          /* ============================================
             トークン未登録: 登録フォーム（ログイン画面に相当）
             ============================================ */
          <div className="settings-card">
            <h2>初回設定: GitHubトークンの登録</h2>
            <p className="settings-note">
              編集にはGitHubトークン（あなた専用の鍵）が必要です。
              以下の手順で取得して貼り付けてください。
              トークンはこのブラウザ内にだけ保存されます。
            </p>
            <ol className="settings-steps">
              <li>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=news-curator"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHubのトークン作成ページ
                </a>
                を開く（要ログイン。名前と権限は入力済みの状態で開きます）
              </li>
              <li>
                Expiration（有効期限）: 「<strong>No expiration</strong>」を選択
                <br />
                → 無期限なので、二度と再生成する必要がありません
              </li>
              <li>ページ下部の「Generate token」ボタンを押す</li>
              <li>表示された ghp_ で始まるトークンをコピーして、下に貼り付け</li>
            </ol>
            <input
              type="password"
              className="settings-input"
              placeholder="ghp_ で始まるトークンを貼り付け"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button className="settings-button" onClick={handleSaveToken}>
              登録する
            </button>
          </div>
        ) : (
          /* ============================================
             トークン登録済み: カテゴリ編集画面
             ============================================ */
          <>
            <p className="settings-note" style={{ marginBottom: 16 }}>
              「企業・組織名」と「キーワード（単語）」のどちらか1つでも
              記事のタイトル・概要に含まれていれば収集されます。
              編集したら最後に「保存」を押してください。
            </p>

            {loading && <p>読み込み中...</p>}

            {/* カテゴリごとの編集カード */}
            {sortedEntries.map(([id, cat]) => (
              <div key={id} className="settings-card">
                <div className="category-header">
                  <h2>
                    {cat.language === "en" ? "🇺🇸" : "🇯🇵"} {cat.display_name}
                    <span className="category-lang">
                      {cat.language === "en" ? "海外ニュース" : "国内ニュース"}
                    </span>
                  </h2>
                  {/* サイトで追加したカテゴリだけ削除できる */}
                  {!cat.builtin && (
                    <button
                      className="settings-button danger small"
                      onClick={() => removeCategory(id)}
                    >
                      カテゴリを削除
                    </button>
                  )}
                </div>

                {/* 企業・組織名の編集 */}
                <TagEditor
                  label="🏢 企業・組織名"
                  placeholder="例: トヨタ自動車"
                  tags={cat.companies}
                  onChange={(tags) => updateCategory(id, { companies: tags })}
                />

                {/* 単語の編集 */}
                <TagEditor
                  label="🔍 キーワード（単語）"
                  placeholder="例: 自動運転"
                  tags={cat.words}
                  onChange={(tags) => updateCategory(id, { words: tags })}
                />
              </div>
            ))}

            {/* カテゴリの新規追加 */}
            {!loading && (
              <div className="settings-card">
                <h2>➕ カテゴリを追加</h2>
                <p className="settings-note">
                  情報源（RSS）の設定は不要です。同じ画面（国内/海外）の
                  ニュースソース全体から、キーワードに合う記事を集めます。
                </p>
                <div className="new-category-row">
                  <input
                    className="settings-input"
                    style={{ marginBottom: 0 }}
                    placeholder="カテゴリ名（例: 半導体、エネルギー）"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                  <select
                    className="settings-select"
                    value={newCatLang}
                    onChange={(e) => setNewCatLang(e.target.value)}
                  >
                    <option value="ja">🇯🇵 国内</option>
                    <option value="en">🇺🇸 海外</option>
                  </select>
                  <button className="settings-button" onClick={addCategory}>
                    追加
                  </button>
                </div>
              </div>
            )}

            {/* 保存ボタン（画面下部に固定表示） */}
            {!loading && Object.keys(categories).length > 0 && (
              <div className="save-bar">
                <button
                  className="settings-button save-main"
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? "保存中..." : "💾 すべての変更を保存"}
                </button>
              </div>
            )}

            <div className="settings-card">
              <h2>トークンの管理</h2>
              <button className="settings-button danger" onClick={handleLogout}>
                トークンを削除（ログアウト）
              </button>
            </div>
          </>
        )}

        <footer className="footer">
          変更は GitHub の keywords.json に保存され、次回の収集から反映されます
        </footer>
      </div>
    </main>
  );
}
