# ========================================
# prefilter.py — ルールベース事前フィルタ
# ========================================
# Gemini APIを呼ぶ前に、明らかに不要な記事を無料で除外する。
# ここで記事の60〜70%を減らすことで、API利用料を節約できる。
#
# フィルタは3段階:
#   ステージ1: NGワードチェック（求人・広告・低品質記事を除外）
#   ステージ2: キーワードマッチ（カテゴリに関係ある記事だけ残す）
#   ステージ3: 重複排除（同じ記事・似た記事を除外）
# ========================================

from difflib import SequenceMatcher  # 文字列の類似度を計算する標準ライブラリ

from ng_words import ALL_NG_WORDS  # NGワードリストを読み込む


def contains_ng_word(text):
    """
    テキストにNGワードが含まれているかチェックする関数。

    引数:
        text: チェック対象の文字列（タイトル＋概要文）

    戻り値:
        NGワードが見つかった場合はそのワード、なければ None
    """
    for ng_word in ALL_NG_WORDS:
        if ng_word in text:
            return ng_word  # 見つかったNGワードを返す
    return None  # NGワードなし


def matches_keywords(text, keywords):
    """
    テキストにカテゴリのキーワードが1つでも含まれているかチェックする関数。

    引数:
        text: チェック対象の文字列（タイトル＋概要文）
        keywords: カテゴリに設定されたキーワードのリスト

    戻り値:
        マッチしたキーワード、なければ None
    """
    for keyword in keywords:
        # 大文字小文字を区別せずにチェックする
        # （例: "aws" と "AWS" を同じものとして扱う）
        if keyword.lower() in text.lower():
            return keyword
    return None


def is_similar_title(title1, title2, threshold=0.85):
    """
    2つのタイトルが似ているかどうかを判定する関数。
    同じニュースを複数のサイトが報じた場合の重複を検出する。

    引数:
        title1, title2: 比較する2つのタイトル
        threshold: 類似度のしきい値（0.85 = 85%以上似ていたら重複とみなす）

    戻り値:
        True（似ている＝重複） or False（別の記事）
    """
    # SequenceMatcher は2つの文字列の類似度を 0.0〜1.0 で返す
    similarity = SequenceMatcher(None, title1, title2).ratio()
    return similarity >= threshold


def prefilter_articles(articles, categories_dict):
    """
    全記事にルールベースフィルタをかけるメイン関数。

    引数:
        articles: fetcher.py で取得した記事のリスト
        categories_dict: カテゴリ設定の辞書
                        {"telecom": {"keywords": [...], ...}, ...}

    戻り値:
        (通過した記事のリスト, 除外された記事のリスト) のタプル
    """
    passed = []    # フィルタを通過した記事
    rejected = []  # 除外された記事

    # 重複チェック用: これまでに通過した記事のタイトルとURLを記録
    seen_urls = set()      # 既に見たURL
    seen_titles = []       # 既に見たタイトル

    for article in articles:
        # タイトルと概要文を結合してチェック対象のテキストを作る
        text = article["title"] + " " + (article.get("description") or "")

        # ============================================
        # ステージ1: NGワードチェック
        # 求人・広告・低品質記事を除外する
        # ============================================
        ng_word = contains_ng_word(text)
        if ng_word:
            article["is_filtered_out"] = 1
            article["filter_reason"] = f"NGワード: {ng_word}"
            rejected.append(article)
            continue  # この記事の処理を終えて次の記事へ

        # ============================================
        # ステージ2: キーワードマッチ
        # カテゴリのキーワードに1つもマッチしない記事を除外する
        # ============================================
        category_id = article["category"]
        keywords = categories_dict.get(category_id, {}).get("keywords", [])

        matched = matches_keywords(text, keywords)
        if not matched:
            article["is_filtered_out"] = 1
            article["filter_reason"] = "キーワード不一致"
            rejected.append(article)
            continue

        # ============================================
        # ステージ3: 重複排除
        # 同じURL、または似たタイトルの記事を除外する
        # ============================================
        # URL完全一致チェック
        if article["url"] in seen_urls:
            article["is_filtered_out"] = 1
            article["filter_reason"] = "URL重複"
            rejected.append(article)
            continue

        # タイトル類似チェック（既に通過した記事と85%以上似ていたら除外）
        is_duplicate = False
        for seen_title in seen_titles:
            if is_similar_title(article["title"], seen_title):
                is_duplicate = True
                break

        if is_duplicate:
            article["is_filtered_out"] = 1
            article["filter_reason"] = "タイトル類似（重複）"
            rejected.append(article)
            continue

        # ============================================
        # 全ステージ通過！
        # ============================================
        seen_urls.add(article["url"])
        seen_titles.append(article["title"])
        passed.append(article)

    # フィルタ結果のサマリーを表示
    total = len(articles)
    if total > 0:
        reject_rate = len(rejected) / total * 100
        print(f"\n[フィルタ結果] {total}件中 {len(rejected)}件を除外（除外率: {reject_rate:.0f}%）")
        print(f"[フィルタ結果] {len(passed)}件がGemini判定に進みます")

    return passed, rejected
