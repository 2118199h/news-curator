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

    # --- keywords.json によるキーワードの上書き ---
    # Webサイトの設定画面で編集されたキーワードがあれば、それを優先する
    keywords_path = os.path.join(config_dir, "keywords.json")
    if os.path.exists(keywords_path):
        with open(keywords_path, "r", encoding="utf-8") as f:
            custom_keywords = json.load(f)

        # カテゴリごとに、keywords.json に定義があれば上書きする
        for category_id, category_info in config.get("categories", {}).items():
            if category_id in custom_keywords:
                keywords = custom_keywords[category_id]
                # 中身がリスト（キーワードの配列）であることを確認してから使う
                if isinstance(keywords, list) and len(keywords) > 0:
                    category_info["keywords"] = keywords

        print("[設定] keywords.json のキーワードを適用しました")

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
