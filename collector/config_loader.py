# ========================================
# config_loader.py — 設定ファイル読み込みモジュール
# ========================================
# config.yaml を読み込んで、Pythonの辞書（dict）として返す。
# 他のモジュールはこの関数を使って設定値を取得する。
# ========================================

import os       # ファイルパスを扱うための標準ライブラリ
import json     # keywords.json を読み込むための標準ライブラリ
import yaml     # YAML形式のファイルを読み込むライブラリ


def load_config():
    """
    config.yaml を読み込んで辞書として返す関数。

    さらに、keywords.json（Webサイトの設定画面から編集されるファイル）が
    存在する場合は、そこに書かれたキーワードで config.yaml の
    キーワードを上書きする。
    → サイト上でキーワードを変更できる仕組みの中核部分。

    戻り値の例:
    {
        "categories": {
            "telecom": {
                "display_name": "通信・キャリア",
                "feeds": [...],
                "keywords": [...],
                ...
            },
            ...
        },
        "gemini": { "max_calls_per_run": 500, ... },
        "general": { "articles_retention_days": 14, ... }
    }
    """

    # このファイル（config_loader.py）と同じフォルダにある config.yaml のパスを作る
    # __file__ は「今実行しているファイル自身のパス」を意味する
    config_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(config_dir, "config.yaml")

    # config.yaml を開いて中身を読み込む
    # encoding="utf-8" は日本語が含まれるファイルを正しく読むために必要
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)  # YAMLをPythonの辞書に変換

    # --- keywords.json による設定の上書き・カテゴリ追加 ---
    # Webサイトの設定画面で編集された内容があれば、それを優先する
    keywords_path = os.path.join(config_dir, "keywords.json")
    if os.path.exists(keywords_path):
        with open(keywords_path, "r", encoding="utf-8") as f:
            custom = json.load(f)

        categories = config.get("categories", {})

        # サイトで追加された新カテゴリを一時的に入れておく辞書
        # （最後に既存カテゴリより「先」に並べる。理由: 同じ記事は先に
        #   処理したカテゴリに入るため、後ろだと新カテゴリに記事が入りにくい）
        new_categories = {}

        for category_id, entry in custom.items():
            # "_説明" のような特殊キー（_で始まる）は読み飛ばす
            if category_id.startswith("_"):
                continue

            # --- キーワードの組み立て ---
            # 新形式: {"companies": [企業名...], "words": [単語...]}
            #   → 2つのリストを合体させて検索キーワードにする
            # 旧形式: ["キーワード", ...] のただのリスト（互換性のため残す）
            if isinstance(entry, dict):
                keywords = entry.get("companies", []) + entry.get("words", [])
            elif isinstance(entry, list):
                keywords = entry
            else:
                continue  # 想定外の形式は無視する

            if len(keywords) == 0:
                continue  # キーワードが空なら何もしない

            if category_id in categories:
                # --- 既存カテゴリ: キーワードだけ上書きする ---
                categories[category_id]["keywords"] = keywords
            elif isinstance(entry, dict):
                # --- 新しいカテゴリ: サイトで追加されたカテゴリを作る ---
                language = entry.get("language", "ja")

                # フィードは指定不要。同じ言語（国内/海外）の既存カテゴリで
                # 使っている全フィードを自動的に流用する（重複は除く）
                feeds = []
                seen_urls = set()
                for existing in categories.values():
                    if existing.get("language", "ja") != language:
                        continue
                    for feed in existing.get("feeds", []):
                        if feed["url"] not in seen_urls:
                            seen_urls.add(feed["url"])
                            feeds.append(feed)

                display_name = entry.get("display_name", category_id)
                new_categories[category_id] = {
                    "display_name": display_name,
                    "description": f"{display_name}に関するニュース（サイトから追加）",
                    "language": language,
                    "feeds": feeds,
                    "keywords": keywords,
                    "gemini_prompt": f"{display_name}に関するニュース",
                }

        # 新カテゴリを既存カテゴリの前に並べた辞書に置き換える
        if new_categories:
            config["categories"] = {**new_categories, **categories}
            print(f"[設定] サイトから追加されたカテゴリ: {len(new_categories)}件")

        print("[設定] keywords.json の設定を適用しました")

    return config


def get_categories(config):
    """
    設定ファイルからカテゴリ一覧を取得する関数。

    引数:
        config: load_config() で読み込んだ設定辞書

    戻り値:
        カテゴリIDとカテゴリ情報のペアのリスト
        例: [("telecom", {"display_name": "通信・キャリア", ...}), ...]
    """
    return list(config.get("categories", {}).items())


def get_gemini_settings(config):
    """
    Gemini API関連の設定を取得する関数。

    戻り値の例:
    {
        "max_calls_per_run": 500,
        "min_relevance_score": 3,
        "sleep_between_calls": 4.0
    }
    """
    # config に "gemini" キーがなければ、デフォルト値を返す
    return config.get("gemini", {
        "enabled": True,
        "max_calls_per_run": 500,
        "min_relevance_score": 3,
        "sleep_between_calls": 4.0,
    })


def get_general_settings(config):
    """
    一般設定を取得する関数。

    戻り値の例:
    {
        "articles_retention_days": 14,
        "export_days": 7
    }
    """
    return config.get("general", {
        "articles_retention_days": 14,
        "export_days": 7,
    })
