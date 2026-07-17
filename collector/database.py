# ========================================
# database.py — SQLiteデータベース操作モジュール
# ========================================
# SQLiteは軽量なデータベースで、ファイル1つ（news.db）にデータを保存する。
# サーバー不要で、Pythonに標準搭載されているため追加インストール不要。
#
# このモジュールの役割:
#   1. データベースとテーブルの作成（初回起動時）
#   2. 記事の保存・取得・削除
#   3. 実行ログの記録
# ========================================

import os       # ファイルパス操作用
import sqlite3  # SQLiteデータベース操作用（Python標準ライブラリ）
from datetime import datetime, timedelta  # 日付操作用


# データベースファイルのパスを決める
# このファイルの2つ上の階層（news-curator/）の data/ フォルダに保存する
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
DB_PATH = os.path.join(DB_DIR, "news.db")


def get_connection():
    """
    データベースへの接続を取得する関数。
    data/ フォルダがなければ自動で作成する。

    戻り値:
        sqlite3.Connection — データベース接続オブジェクト
    """
    # data/ フォルダが存在しなければ作成する
    os.makedirs(DB_DIR, exist_ok=True)

    # データベースファイルに接続（ファイルがなければ自動で作られる）
    conn = sqlite3.connect(DB_PATH)

    # 検索結果を辞書形式で取得できるようにする設定
    # これにより row["title"] のようにカラム名でアクセスできる
    conn.row_factory = sqlite3.Row

    return conn


def initialize_database():
    """
    データベースのテーブルを作成する関数（初回起動時に実行）。
    既にテーブルが存在する場合は何もしない（IF NOT EXISTS）。
    """
    conn = get_connection()

    # --- 記事テーブル ---
    # 収集した全てのニュース記事を保存するテーブル
    conn.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自動採番されるID
            title TEXT NOT NULL,                    -- 記事のタイトル
            url TEXT NOT NULL UNIQUE,               -- 記事のURL（同じURLは2回保存しない）
            source TEXT NOT NULL,                   -- 配信元の名前（例: "ITmedia"）
            category TEXT NOT NULL,                 -- カテゴリID（例: "telecom"）
            published_at TEXT,                      -- 記事の公開日時
            fetched_at TEXT NOT NULL,               -- この記事を取得した日時
            description TEXT,                       -- RSSに記載された記事の概要文
            relevance_score INTEGER DEFAULT 0,      -- Geminiが付けた関連度スコア（1〜5）
            summary TEXT,                           -- Geminiが生成した3行要約
            keywords TEXT,                          -- カンマ区切りのキーワード
            is_filtered_out INTEGER DEFAULT 0,      -- フィルタで除外されたか（0=残す, 1=除外）
            filter_reason TEXT                      -- 除外された理由（デバッグ用）
        )
    """)

    # --- 実行ログテーブル ---
    # 毎回の収集実行の結果を記録するテーブル
    conn.execute("""
        CREATE TABLE IF NOT EXISTS run_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自動採番されるID
            run_at TEXT NOT NULL,                   -- 実行日時
            total_fetched INTEGER DEFAULT 0,        -- RSSから取得した記事の総数
            prefiltered_out INTEGER DEFAULT 0,      -- ルールベースで除外した記事数
            api_scored INTEGER DEFAULT 0,           -- Gemini APIで判定した記事数
            api_passed INTEGER DEFAULT 0,           -- スコア3以上で保存した記事数
            errors TEXT                             -- エラー情報（JSON形式）
        )
    """)

    # --- インデックス（検索を高速化するための索引）---
    # よく検索に使うカラムにインデックスを作成する
    conn.execute("CREATE INDEX IF NOT EXISTS idx_category ON articles(category)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_score ON articles(relevance_score)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_published ON articles(published_at)")

    # 変更をデータベースに確定する
    conn.commit()
    conn.close()

    print(f"[DB] データベースを初期化しました: {DB_PATH}")


def article_exists(conn, url):
    """
    指定したURLの記事が既にデータベースに存在するかチェックする関数。
    同じ記事を2回保存しないために使う。

    引数:
        conn: データベース接続
        url: チェックしたい記事のURL

    戻り値:
        True（存在する） or False（存在しない）
    """
    cursor = conn.execute("SELECT 1 FROM articles WHERE url = ?", (url,))
    return cursor.fetchone() is not None


def save_article(conn, article_data):
    """
    1件の記事をデータベースに保存する関数。
    既に同じURLの記事がある場合はスキップする。

    引数:
        conn: データベース接続
        article_data: 記事情報の辞書。以下のキーを含む:
            {
                "title": "記事タイトル",
                "url": "https://...",
                "source": "ITmedia",
                "category": "telecom",
                "published_at": "2024-01-01T12:00:00",
                "description": "記事の概要...",
                "relevance_score": 4,
                "summary": "3行要約...",
                "keywords": "AI,クラウド",
                "is_filtered_out": 0,
                "filter_reason": None
            }
    """
    # 同じURLが既にあればスキップ（重複防止）
    if article_exists(conn, article_data["url"]):
        return False  # 保存しなかった

    # INSERT OR IGNORE: URLのUNIQUE制約に引っかかった場合も無視して続行
    conn.execute("""
        INSERT OR IGNORE INTO articles
            (title, url, source, category, published_at, fetched_at,
             description, relevance_score, summary, keywords,
             is_filtered_out, filter_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        article_data["title"],
        article_data["url"],
        article_data["source"],
        article_data["category"],
        article_data.get("published_at"),
        datetime.now().isoformat(),  # 現在時刻を取得日時として記録
        article_data.get("description"),
        article_data.get("relevance_score", 0),
        article_data.get("summary"),
        article_data.get("keywords"),
        article_data.get("is_filtered_out", 0),
        article_data.get("filter_reason"),
    ))

    return True  # 保存できた


def save_run_log(conn, log_data):
    """
    収集実行のログを保存する関数。
    毎回の実行結果（何件取得・何件除外・何件保存）を記録する。

    引数:
        conn: データベース接続
        log_data: ログ情報の辞書
    """
    conn.execute("""
        INSERT INTO run_logs (run_at, total_fetched, prefiltered_out,
                              api_scored, api_passed, errors)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().isoformat(),
        log_data.get("total_fetched", 0),
        log_data.get("prefiltered_out", 0),
        log_data.get("api_scored", 0),
        log_data.get("api_passed", 0),
        log_data.get("errors"),
    ))


def get_recent_articles(conn, days=7):
    """
    直近N日間の記事を取得する関数（ダッシュボード用JSON書き出しに使う）。

    引数:
        conn: データベース接続
        days: 何日分の記事を取得するか（デフォルト: 7日）

    戻り値:
        記事データのリスト（辞書形式）
    """
    # N日前の日付を計算
    since = (datetime.now() - timedelta(days=days)).isoformat()

    cursor = conn.execute("""
        SELECT * FROM articles
        WHERE is_filtered_out = 0          -- フィルタ除外されていない記事だけ
          AND relevance_score >= 3          -- スコア3以上の記事だけ
          AND fetched_at >= ?              -- 指定日以降に取得した記事だけ
        -- 新しい記事から順に並べる。
        -- COALESCE = 公開日時がない記事は取得日時で代用する
        -- （日時のない記事が一番下に埋もれてしまうのを防ぐ）
        ORDER BY COALESCE(published_at, fetched_at) DESC
    """, (since,))

    # sqlite3.Row を普通の辞書に変換して返す
    return [dict(row) for row in cursor.fetchall()]


def delete_old_articles(conn, retention_days=14):
    """
    古い記事を削除する関数。
    データベースが無限に大きくならないよう、定期的に古いデータを消す。

    引数:
        conn: データベース接続
        retention_days: 何日より古い記事を削除するか（デフォルト: 14日）
    """
    cutoff = (datetime.now() - timedelta(days=retention_days)).isoformat()

    cursor = conn.execute(
        "DELETE FROM articles WHERE fetched_at < ?", (cutoff,)
    )
    deleted_count = cursor.rowcount

    if deleted_count > 0:
        print(f"[DB] {deleted_count}件の古い記事を削除しました")
