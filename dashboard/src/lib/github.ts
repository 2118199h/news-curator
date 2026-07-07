// ========================================
// github.ts — GitHub APIと通信する共通モジュール
// ========================================
// このサイトはサーバーを持たない「静的サイト」のため、
// 設定の保存や更新の実行は GitHub API を直接呼び出して行う。
//
// 【ログインの仕組み】
//   GitHubの「Personal Access Token（個人アクセストークン）」を
//   ブラウザに保存しておき、それを鍵としてAPIを呼び出す。
//   トークンは自分のブラウザ（localStorage）だけに保存され、
//   外部に送信されるのは GitHub API への通信のみ。
//
// 【できること】
//   - キーワード設定ファイル（keywords.json）の読み書き
//   - ニュース収集の手動実行（更新ボタン）
//   - 最終アクセス日時の記録（30日ルール用）
// ========================================

// 対象のGitHubリポジトリ（自分のリポジトリに合わせて変更する）
const OWNER = "2118199h";
const REPO = "news-curator";

// GitHub APIの共通URL
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;

// ============================================
// トークンの保存・取得
// localStorage = ブラウザ内の小さな保存領域。
// このサイトを開いたブラウザにだけ保存される。
// ============================================

/** 保存されているトークンを取得する（なければ null） */
export function getToken(): string | null {
  if (typeof window === "undefined") return null; // サーバー側では使えない
  return localStorage.getItem("github_token");
}

/** トークンをブラウザに保存する */
export function saveToken(token: string) {
  localStorage.setItem("github_token", token.trim());
}

/** トークンを削除する（ログアウトに相当） */
export function clearToken() {
  localStorage.removeItem("github_token");
}

// ============================================
// GitHub APIの呼び出しヘルパー
// ============================================

/** API呼び出しに共通で付けるヘッダー（認証情報など） */
function apiHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Base64文字列を日本語対応でデコードする関数。
 * GitHub APIはファイルの中身をBase64形式で返すため、
 * それを普通の文字列に戻す必要がある。
 */
function decodeBase64Utf8(base64: string): string {
  // 改行を除去してからデコードする（GitHubは76文字ごとに改行を入れる）
  const binary = atob(base64.replace(/\n/g, ""));
  // バイト列に変換してからUTF-8として読む（日本語対応のため）
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * 文字列を日本語対応でBase64にエンコードする関数。
 * ファイルを保存する時に使う。
 */
function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// ============================================
// ファイルの読み書き
// ============================================

/**
 * リポジトリ内のファイルを読み込む関数。
 *
 * 戻り値:
 *   { content: ファイルの中身, sha: ファイルの識別子 }
 *   ※ sha は保存時に「どのバージョンを上書きするか」を示すために必要
 */
export async function getFile(
  path: string
): Promise<{ content: string; sha: string }> {
  const token = getToken();
  if (!token) throw new Error("トークンが設定されていません");

  const response = await fetch(`${API_BASE}/contents/${path}`, {
    headers: apiHeaders(token),
    cache: "no-store", // 常に最新の内容を取得する
  });

  if (!response.ok) {
    throw new Error(`ファイルの読み込みに失敗しました（${response.status}）`);
  }

  const data = await response.json();
  return {
    content: decodeBase64Utf8(data.content),
    sha: data.sha,
  };
}

/**
 * リポジトリ内のファイルを保存（上書き）する関数。
 * 保存 = GitHubに新しいコミットが作られる。
 */
export async function putFile(
  path: string,
  content: string,
  sha: string,
  message: string
): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("トークンが設定されていません");

  const response = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: apiHeaders(token),
    body: JSON.stringify({
      message: message, // コミットメッセージ
      content: encodeBase64Utf8(content),
      sha: sha, // 上書き対象のバージョン
    }),
  });

  if (!response.ok) {
    throw new Error(`ファイルの保存に失敗しました（${response.status}）`);
  }
}

// ============================================
// ニュース収集の手動実行（更新ボタン）
// ============================================

/**
 * GitHub Actionsのニュース収集ワークフローを起動する関数。
 * サイトの「更新」ボタンから呼ばれる。
 */
export async function triggerUpdate(): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("トークンが設定されていません");

  const response = await fetch(
    `${API_BASE}/actions/workflows/collect.yml/dispatches`,
    {
      method: "POST",
      headers: apiHeaders(token),
      body: JSON.stringify({ ref: "main" }), // mainブランチで実行
    }
  );

  // 成功時は 204 No Content が返る
  if (!response.ok) {
    throw new Error(`更新の開始に失敗しました（${response.status}）`);
  }
}

// ============================================
// 最終アクセス日時の記録（30日ルール用）
// ============================================

/**
 * 「今サイトを見ています」という記録をGitHubに残す関数。
 * 30日以上アクセスがないと定期収集が止まる仕組みのために使う。
 *
 * 無駄なコミットを増やさないよう、前回の記録から
 * 24時間以上経っている場合だけ更新する。
 */
export async function recordAccess(): Promise<void> {
  const token = getToken();
  if (!token) return; // トークン未設定なら何もしない（エラーにもしない）

  try {
    const file = await getFile("data/last_access.json");
    const data = JSON.parse(file.content);

    // 前回の記録から24時間以内なら何もしない（コミットの節約）
    const last = new Date(data.last_access);
    const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) return;

    // 最終アクセス日時を現在時刻に更新して保存
    data.last_access = new Date().toISOString().slice(0, 19);
    await putFile(
      "data/last_access.json",
      JSON.stringify(data, null, 2) + "\n",
      file.sha,
      "サイトアクセスを記録"
    );
  } catch {
    // 記録に失敗してもサイトの表示には影響させない（静かに無視）
  }
}
