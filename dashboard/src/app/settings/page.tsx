// ========================================
// settings/page.tsx — 設定ページ
// ========================================
// サイト上でキーワードを編集するためのページ。
// URL: /settings
//
// 画面の構成:
//   1. GitHubトークンの登録（初回のみ・ログインに相当）
//   2. カテゴリごとのキーワード編集（1行に1キーワード）
//   3. 保存ボタン → GitHubのkeywords.jsonに保存される
//
// 保存したキーワードは、次回のニュース収集から反映される。
// ========================================

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ArticlesData } from "@/lib/types";
import { getToken, saveToken, clearToken, getFile, putFile } from "@/lib/github";

export default function SettingsPage() {
  // ============================================
  // 状態（state）の定義
  // ============================================

  // トークンが登録済みかどうか
  const [hasToken, setHasToken] = useState(false);

  // トークン入力欄の内容
  const [tokenInput, setTokenInput] = useState("");

  // カテゴリごとのキーワード（テキストエリアの中身）
  // 例: { telecom: "KDDI\nソフトバンク", ... }
  const [keywordTexts, setKeywordTexts] = useState<Record<string, string>>({});

  // カテゴリの表示名（articles.jsonから取得）
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});

  // keywords.json の保存に必要なバージョン識別子
  const [fileSha, setFileSha] = useState("");

  // 画面に表示するメッセージ（成功・エラー）
  const [message, setMessage] = useState("");

  // 読み込み中・保存中の状態
  const [loading, setLoading] = useState(false);

  // ============================================
  // 初期化: トークンの有無を確認し、あればキーワードを読み込む
  // ============================================
  useEffect(() => {
    if (getToken()) {
      setHasToken(true);
      loadKeywords();
    }
  }, []);

  /** GitHubからキーワード設定を読み込む */
  async function loadKeywords() {
    setLoading(true);
    setMessage("");
    try {
      // --- keywords.json を読み込む ---
      const file = await getFile("collector/keywords.json");
      const data = JSON.parse(file.content);
      setFileSha(file.sha);

      // カテゴリごとのキーワード配列を「1行1キーワード」のテキストに変換
      const texts: Record<string, string> = {};
      for (const [categoryId, keywords] of Object.entries(data)) {
        if (categoryId.startsWith("_")) continue; // "_説明" などの特殊キーは除く
        if (Array.isArray(keywords)) {
          texts[categoryId] = keywords.join("\n");
        }
      }
      setKeywordTexts(texts);

      // --- カテゴリの表示名を articles.json から取得 ---
      const basePath =
        process.env.NODE_ENV === "production" ? "/news-curator" : "";
      const response = await fetch(`${basePath}/data/articles.json`);
      if (response.ok) {
        const articlesData: ArticlesData = await response.json();
        const names: Record<string, string> = {};
        for (const [id, info] of Object.entries(articlesData.categories)) {
          // 国内/海外がわかるように表示名を作る
          const lang = (info.language ?? "ja") === "en" ? "【海外】" : "【国内】";
          names[id] = `${lang} ${info.display_name}`;
        }
        setCategoryNames(names);
      }
    } catch (e) {
      setMessage(`読み込みエラー: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }

  /** トークンを保存して編集画面に進む */
  function handleSaveToken() {
    if (!tokenInput.trim().startsWith("github_pat_") && !tokenInput.trim().startsWith("ghp_")) {
      setMessage("トークンの形式が正しくありません（github_pat_ または ghp_ で始まります）");
      return;
    }
    saveToken(tokenInput);
    setTokenInput("");
    setHasToken(true);
    setMessage("");
    loadKeywords();
  }

  /** トークンを削除する（ログアウト） */
  function handleLogout() {
    clearToken();
    setHasToken(false);
    setKeywordTexts({});
    setMessage("トークンを削除しました");
  }

  /** キーワードをGitHubに保存する */
  async function handleSave() {
    setLoading(true);
    setMessage("");
    try {
      // テキストエリアの内容をキーワード配列に戻す
      // （空行や前後の空白は取り除く）
      const data: Record<string, string[] | string> = {
        _説明:
          "このファイルはWebサイトの設定画面から編集されるキーワード一覧です。ここにあるカテゴリのキーワードは config.yaml より優先されます。",
      };
      for (const [categoryId, text] of Object.entries(keywordTexts)) {
        data[categoryId] = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "");
      }

      // GitHubに保存（= コミットされる）
      await putFile(
        "collector/keywords.json",
        JSON.stringify(data, null, 2) + "\n",
        fileSha,
        "サイトからキーワードを更新"
      );

      // 保存後は新しいバージョン識別子を取得し直す
      const file = await getFile("collector/keywords.json");
      setFileSha(file.sha);

      setMessage("✅ 保存しました！次回のニュース収集（または更新ボタン）から反映されます");
    } catch (e) {
      setMessage(`保存エラー: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // 画面の描画
  // ============================================
  return (
    <main>
      <header className="header">
        <div className="container">
          <h1>⚙️ 設定 — 収集キーワードの編集</h1>
          <p className="subtitle">
            <Link href="/" style={{ color: "white" }}>
              ← ダッシュボードに戻る
            </Link>
          </p>
        </div>
      </header>

      <div className="container">
        {/* メッセージ表示欄 */}
        {message && <p className="settings-message">{message}</p>}

        {!hasToken ? (
          /* ============================================
             トークン未登録: 登録フォームを表示（ログイン画面に相当）
             ============================================ */
          <div className="settings-card">
            <h2>初回設定: GitHubトークンの登録</h2>
            <p className="settings-note">
              キーワードの編集にはGitHubトークン（あなた専用の鍵）が必要です。
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
              placeholder="github_pat_ で始まるトークンを貼り付け"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button className="settings-button" onClick={handleSaveToken}>
              登録する
            </button>
          </div>
        ) : (
          /* ============================================
             トークン登録済み: キーワード編集画面を表示
             ============================================ */
          <>
            <div className="settings-card">
              <h2>キーワードの編集</h2>
              <p className="settings-note">
                1行に1つのキーワードを入力してください。
                キーワードのどれか1つでもタイトル・概要に含まれる記事が収集されます。
              </p>

              {loading && <p>読み込み中...</p>}

              {/* カテゴリごとにテキストエリアを表示 */}
              {Object.entries(keywordTexts).map(([categoryId, text]) => (
                <div key={categoryId} className="keyword-editor">
                  <h3>{categoryNames[categoryId] ?? categoryId}</h3>
                  <textarea
                    className="settings-textarea"
                    rows={Math.min(10, text.split("\n").length + 1)}
                    value={text}
                    onChange={(e) =>
                      setKeywordTexts({
                        ...keywordTexts,
                        [categoryId]: e.target.value,
                      })
                    }
                  />
                </div>
              ))}

              <button
                className="settings-button"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "保存中..." : "💾 キーワードを保存"}
              </button>
            </div>

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
