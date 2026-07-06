# ========================================
# main.py — News Curator メイン実行スクリプト
# ========================================
# ニュース収集の全体の流れを制御するエントリポイント（開始地点）。
#
# 実行方法:
#   cd collector
#   python main.py
#
# 処理の流れ:
#   1. 設定ファイル（config.yaml）を読み込む
#   2. データベースを準備する
#   3. RSSフィードから記事を取得する
#   4. ルールベースフィルタで不要な記事を除外する（無料）
#   5. Gemini APIで関連度を判定し、重要な記事だけ要約する
#   6. データベースに保存する
#   7. 古い記事を削除する
#   8. 実行ログを記録する
# ========================================

import sys   # 標準出力の文字コード設定用
import json  # エラー情報をJSON形式で記録するため

# Windowsのコマンドプロンプトでも日本語が文字化けしないよう、
# 出力の文字コードをUTF-8に設定する
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

# .env ファイルから環境変数（APIキー）を読み込む
# GitHub Actions上では .env がなくても、Secretsから環境変数が設定される
from dotenv import load_dotenv
load_dotenv()

# 自作モジュールの読み込み
from config_loader import load_config, get_categories, get_gemini_settings, get_general_settings
from database import (
    initialize_database, get_connection, save_article,
    save_run_log, delete_old_articles, article_exists,
)
from fetcher import fetch_all_feeds
from prefilter import prefilter_articles
from gemini_client import GeminiClient


def main():
    """ニュース収集のメイン処理"""

    print("=" * 50)
    print("News Curator — ニュース収集を開始します")
    print("=" * 50)

    # ============================================
    # ステップ1: 設定ファイルの読み込み
    # ============================================
    config = load_config()
    categories = get_categories(config)          # カテゴリ一覧
    gemini_settings = get_gemini_settings(config)  # Gemini API設定
    general_settings = get_general_settings(config)  # 一般設定

    # カテゴリIDをキーにした辞書も作っておく（prefilterで使う）
    categories_dict = dict(categories)

    # ============================================
    # ステップ2: データベースの準備
    # ============================================
    initialize_database()
    conn = get_connection()

    # 実行結果を記録する変数
    log_data = {
        "total_fetched": 0,     # RSS取得件数
        "prefiltered_out": 0,   # ルールベース除外件数
        "api_scored": 0,        # Gemini判定件数
        "api_passed": 0,        # 保存件数
        "errors": None,
    }
    errors = []  # エラーを記録するリスト

    try:
        # ============================================
        # ステップ3: RSSフィードから記事を取得
        # ============================================
        all_articles = fetch_all_feeds(categories)
        log_data["total_fetched"] = len(all_articles)

        # --- 既にデータベースにある記事を除外する ---
        # 前回の実行で保存済みの記事を再処理しないため
        new_articles = []
        for article in all_articles:
            if not article_exists(conn, article["url"]):
                new_articles.append(article)

        skipped = len(all_articles) - len(new_articles)
        if skipped > 0:
            print(f"\n[重複スキップ] {skipped}件は既に保存済みのためスキップします")

        # ============================================
        # ステップ4: ルールベースフィルタ（無料）
        # ============================================
        passed_articles, rejected_articles = prefilter_articles(
            new_articles, categories_dict
        )
        log_data["prefiltered_out"] = len(rejected_articles)

        # ============================================
        # ステップ5: Gemini APIで判定＋要約
        # ============================================
        # Geminiクライアントを準備（呼出上限・間隔は設定ファイルから）
        # APIキーが未設定の場合は、AI判定をスキップして
        # ルールベースフィルタを通過した記事をそのまま保存する
        gemini = None
        try:
            gemini = GeminiClient(
                max_calls=gemini_settings["max_calls_per_run"],
                sleep_seconds=gemini_settings["sleep_between_calls"],
            )
        except ValueError:
            print("\n[警告] GEMINI_API_KEY が未設定のため、AI判定をスキップします")
            print("[警告] キーワードフィルタを通過した記事をすべて保存します")

        min_score = gemini_settings["min_relevance_score"]

        saved_count = 0  # 保存した記事数

        # --- APIキーがない場合: AI判定なしで保存 ---
        if gemini is None:
            for article in passed_articles:
                # スコアは仮の値（min_score）を設定して保存する
                article["relevance_score"] = min_score
                article["summary"] = None
                article["keywords"] = None
                if save_article(conn, article):
                    saved_count += 1
            log_data["api_passed"] = saved_count
            conn.commit()
            # AI判定なしの場合はここで判定処理を終える
            passed_articles = []

        if gemini is not None:
            print(f"\n--- Gemini APIで {len(passed_articles)}件を判定します ---")

        for i, article in enumerate(passed_articles, start=1):
            # 進捗を表示（10件ごと）
            if i % 10 == 0:
                print(f"[進捗] {i}/{len(passed_articles)}件を処理済み...")

            # このカテゴリの判定基準（プロンプト）を取得
            category_prompt = categories_dict[article["category"]].get(
                "gemini_prompt", article["category"]
            )

            # --- 関連度スコアリング ---
            score = gemini.score_relevance(article, category_prompt)
            article["relevance_score"] = score
            log_data["api_scored"] += 1

            # スコアが基準未満の記事は保存しない
            if score < min_score:
                continue

            # --- 3行要約の生成（スコアが基準以上の記事だけ）---
            summary, keywords = gemini.summarize(article)
            article["summary"] = summary
            article["keywords"] = keywords

            # --- データベースに保存 ---
            if save_article(conn, article):
                saved_count += 1

            # API呼出上限に達していたらループを抜ける
            if gemini.call_count >= gemini.max_calls:
                print("[警告] API呼出上限に達したため、残りの記事はスキップします")
                break

        log_data["api_passed"] = saved_count
        conn.commit()  # ここまでの保存を確定

        # ============================================
        # ステップ6: 古い記事の削除
        # ============================================
        delete_old_articles(
            conn, retention_days=general_settings["articles_retention_days"]
        )
        conn.commit()

    except Exception as e:
        # 予期しないエラーが起きた場合は記録する
        errors.append(str(e))
        print(f"\n[エラー] 処理中にエラーが発生しました: {e}")

    finally:
        # ============================================
        # ステップ7: 実行ログの記録
        # ============================================
        # エラーがあればJSON形式で記録
        if errors:
            log_data["errors"] = json.dumps(errors, ensure_ascii=False)

        save_run_log(conn, log_data)
        conn.commit()
        conn.close()

    # ============================================
    # 実行結果のサマリー表示
    # ============================================
    print("\n" + "=" * 50)
    print("収集完了！ 実行結果:")
    print(f"  RSS取得:        {log_data['total_fetched']}件")
    print(f"  ルール除外:     {log_data['prefiltered_out']}件")
    print(f"  Gemini判定:     {log_data['api_scored']}件")
    print(f"  保存（重要記事）: {log_data['api_passed']}件")
    print("=" * 50)


# このファイルが直接実行された場合のみ main() を呼ぶ
# （他のファイルから import された場合は実行されない）
if __name__ == "__main__":
    main()
