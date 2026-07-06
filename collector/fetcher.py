# ========================================
# fetcher.py — RSSフィード取得モジュール
# ========================================
# config.yaml に登録された各RSSフィードから記事を取得する。
#
# RSSフィードとは:
#   ニュースサイトが「最新記事の一覧」を機械が読みやすい形式で
#   公開しているもの。これを読み取ることで、サイトを開かなくても
#   最新記事のタイトル・URL・概要を取得できる。
#
# ポイント:
#   1つのフィードが壊れていても、他のフィードの取得は続行する
#   （エラーで全体が止まらないようにする）
# ========================================

import feedparser  # RSSフィードを解析するライブラリ
from datetime import datetime  # 日付操作用


def fetch_feed(feed_url, feed_name, category_id):
    """
    1つのRSSフィードから記事一覧を取得する関数。

    引数:
        feed_url: RSSフィードのURL（例: "https://rss.itmedia.co.jp/rss/2.0/mobile.xml"）
        feed_name: 配信元の表示名（例: "ITmedia Mobile"）
        category_id: この記事が属するカテゴリID（例: "telecom"）

    戻り値:
        記事情報の辞書のリスト。取得失敗時は空リスト。
        [
            {
                "title": "記事タイトル",
                "url": "https://...",
                "source": "ITmedia Mobile",
                "category": "telecom",
                "published_at": "2024-01-01T12:00:00",
                "description": "記事の概要文..."
            },
            ...
        ]
    """
    articles = []  # 取得した記事を入れるリスト

    try:
        # RSSフィードをダウンロードして解析する
        feed = feedparser.parse(feed_url)

        # bozo=1 はフィードの形式に問題があったことを示すフラグ
        # entries（記事一覧）が空の場合はエラーとみなす
        if feed.bozo and not feed.entries:
            print(f"[取得エラー] {feed_name}: フィードの解析に失敗しました")
            return []

        # フィード内の各記事（entry）を処理する
        for entry in feed.entries:
            # --- 公開日時の取得 ---
            # RSSによって日付の形式が違うため、feedparserが
            # 解析してくれた published_parsed を使う
            published_at = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                # time.struct_time 形式を datetime に変換し、ISO形式の文字列にする
                published_at = datetime(*entry.published_parsed[:6]).isoformat()
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                # published がない場合は updated（更新日時）で代用
                published_at = datetime(*entry.updated_parsed[:6]).isoformat()

            # --- 概要文の取得 ---
            # summary か description のどちらかに概要が入っている
            description = ""
            if hasattr(entry, "summary"):
                description = entry.summary
            elif hasattr(entry, "description"):
                description = entry.description

            # HTMLタグが含まれる場合があるので、長すぎる場合は切り詰める
            # （Gemini APIに送るトークン数を節約するため）
            if len(description) > 500:
                description = description[:500]

            # --- 記事情報を辞書にまとめてリストに追加 ---
            articles.append({
                "title": entry.get("title", "（タイトルなし）"),
                "url": entry.get("link", ""),
                "source": feed_name,
                "category": category_id,
                "published_at": published_at,
                "description": description,
            })

        print(f"[取得成功] {feed_name}: {len(articles)}件の記事を取得")

    except Exception as e:
        # 通信エラーなど、予期しないエラーが起きても全体を止めない
        print(f"[取得エラー] {feed_name}: {e}")

    return articles


def fetch_all_feeds(categories):
    """
    全カテゴリの全フィードから記事を取得する関数。

    引数:
        categories: config_loader.get_categories() の戻り値
                    [("telecom", {...}), ("ai_cloud", {...}), ...]

    戻り値:
        全記事のリスト（カテゴリ情報付き）
    """
    all_articles = []  # 全記事を入れるリスト

    # カテゴリごとにループ
    for category_id, category_info in categories:
        display_name = category_info.get("display_name", category_id)
        print(f"\n--- カテゴリ「{display_name}」の記事を取得中 ---")

        # そのカテゴリに登録された各フィードから記事を取得
        for feed in category_info.get("feeds", []):
            articles = fetch_feed(
                feed_url=feed["url"],
                feed_name=feed["name"],
                category_id=category_id,
            )
            # 取得した記事を全体リストに追加
            all_articles.extend(articles)

    print(f"\n[取得完了] 合計 {len(all_articles)}件の記事を取得しました")
    return all_articles
