# ========================================
# export_json.py — SQLite → JSON 書き出しスクリプト
# ========================================
# データベースに保存された記事を、ダッシュボード（Next.js）が
# 読み込めるJSON形式のファイルに書き出す。
#
# 実行方法:
#   cd collector
#   python export_json.py
#
# 出力先:
#   dashboard/public/data/articles.json
#
# なぜJSONに書き出すのか:
#   ダッシュボードは「静的サイト」（サーバーなしで動くWebページ）として
#   作るため、データベースに直接アクセスできない。
#   そこで、表示に必要なデータをあらかじめJSONファイルに書き出しておき、
#   ダッシュボードはそのファイルを読み込んで表示する。
# ========================================

import os    # ファイルパス操作用
import sys   # 標準出力の文字コード設定用
import json  # JSON書き出し用

# Windowsのコマンドプロンプトでも日本語が文字化けしないよう、
# 出力の文字コードをUTF-8に設定する
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
from datetime import datetime  # 現在時刻の記録用

# 自作モジュールの読み込み
from config_loader import load_config, get_categories, get_general_settings
from database import get_connection, get_recent_articles


# 出力先のJSONファイルパス
# collector/ から見て ../dashboard/public/data/articles.json
OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "dashboard", "public", "data"
)
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "articles.json")


def export_articles():
    """記事データをJSONファイルに書き出すメイン関数"""

    print("JSONファイルの書き出しを開始します...")

    # ============================================
    # ステップ1: 設定とデータベースの準備
    # ============================================
    config = load_config()
    general_settings = get_general_settings(config)
    export_days = general_settings["export_days"]  # 何日分を書き出すか

    conn = get_connection()

    # ============================================
    # ステップ2: 直近N日分の記事を取得
    # ============================================
    articles = get_recent_articles(conn, days=export_days)
    conn.close()

    # ============================================
    # ステップ3: カテゴリ情報も含めた出力データを作る
    # ============================================
    # ダッシュボードがカテゴリのタブを表示するために、
    # カテゴリID → 表示名 の対応表も一緒に書き出す
    categories_info = {}
    for category_id, category_data in get_categories(config):
        categories_info[category_id] = {
            "display_name": category_data.get("display_name", category_id),
            "description": category_data.get("description", ""),
        }

    # 出力するデータ全体の構造
    output_data = {
        "generated_at": datetime.now().isoformat(),  # このJSONを作った日時
        "total_articles": len(articles),             # 記事の総数
        "categories": categories_info,               # カテゴリ情報
        "articles": articles,                        # 記事データ本体
    }

    # ============================================
    # ステップ4: JSONファイルに書き出す
    # ============================================
    # 出力先フォルダがなければ作成
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ensure_ascii=False → 日本語をそのまま出力（読みやすくするため）
    # indent=2 → 見やすいように2スペースで整形
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"書き出し完了: {OUTPUT_PATH}")
    print(f"  記事数: {len(articles)}件（直近{export_days}日分）")


# このファイルが直接実行された場合のみ実行
if __name__ == "__main__":
    export_articles()
