// ========================================
// UpdateButton.tsx — ニュース更新ボタン部品
// ========================================
// クリックするとGitHub Actionsのニュース収集を起動する。
// 30日以上アクセスがなくて自動収集が止まった場合も、
// このボタンを押せば収集が再開される。
//
// トークンが未登録の場合は、設定ページへ誘導する。
// ========================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, triggerUpdate } from "@/lib/github";

export default function UpdateButton() {
  // ボタンの状態（idle=通常, running=実行中, done=完了, error=失敗）
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const router = useRouter(); // ページ移動用

  /** 更新ボタンが押された時の処理 */
  async function handleClick() {
    // トークンが未登録なら設定ページへ案内する
    if (!getToken()) {
      alert(
        "更新にはGitHubトークンの登録が必要です。\n設定ページで登録してください。"
      );
      router.push("/settings");
      return;
    }

    setStatus("running");
    try {
      await triggerUpdate(); // GitHub Actionsを起動
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  // 状態に応じてボタンの表示を変える
  if (status === "done") {
    return (
      <span className="update-status">
        ✅ 更新を開始しました（約5分後に再読み込みしてください）
      </span>
    );
  }

  return (
    <span>
      <button
        className="update-button"
        onClick={handleClick}
        disabled={status === "running"}
      >
        {status === "running" ? "起動中..." : "🔄 ニュースを更新"}
      </button>
      {status === "error" && (
        <span className="update-status error">
          更新の開始に失敗しました。トークンの権限（Actions: Read and
          write）を確認してください
        </span>
      )}
    </span>
  );
}
