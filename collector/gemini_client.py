# ========================================
# gemini_client.py — Gemini Flash API呼び出しモジュール
# ========================================
# Google の Gemini Flash モデルを使って、以下の2つを行う:
#   1. 記事の関連度スコアリング（この記事は本当に興味あるテーマか？を1〜5で判定）
#   2. 記事の3行要約生成
#
# コスト管理のポイント:
#   - 無料枠: 15回/分、1500回/日
#   - API呼出の間に4秒待つ → 15回/分の制限を守る
#   - 1回の実行で最大500回まで → 使いすぎ防止のハードキャップ
#   - エラー時は指数バックオフ（4秒→8秒→16秒と待ち時間を倍にしてリトライ）
# ========================================

import os      # 環境変数の読み込み用
import json    # JSON文字列の解析用
import time    # 待機処理用

import google.generativeai as genai  # Gemini API公式SDK


# 使用するモデル名（Flash は高速・低価格・無料枠が大きい）
MODEL_NAME = "gemini-2.0-flash"


class GeminiClient:
    """
    Gemini APIを呼び出すためのクラス。
    レート制限（呼出回数の管理）とエラー処理を内蔵している。
    """

    def __init__(self, max_calls=500, sleep_seconds=4.0):
        """
        初期化処理。APIキーの設定と呼出回数カウンターの準備をする。

        引数:
            max_calls: 1回の実行で許可する最大API呼出回数
            sleep_seconds: API呼出の間に待つ秒数
        """
        # 環境変数からAPIキーを取得する
        # （.envファイル or GitHub Secrets に設定されている）
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY が設定されていません。"
                ".env ファイルにAPIキーを記載してください。"
            )

        # APIキーの形式チェック
        # Geminiのキーは半角英数字で「AIza」から始まる。
        # プレースホルダー（説明文）のままになっていないかを確認する
        if not api_key.isascii() or not api_key.startswith("AIza"):
            raise ValueError(
                "GEMINI_API_KEY が正しい形式ではありません。"
                "（キーは AIza から始まる半角英数字です）"
                ".env ファイルに実際のAPIキーを貼り付けてください。"
            )

        # APIキーをSDKに設定
        genai.configure(api_key=api_key)

        # モデルのインスタンスを作成
        self.model = genai.GenerativeModel(MODEL_NAME)

        # 呼出回数の管理用
        self.call_count = 0             # これまでの呼出回数
        self.max_calls = max_calls      # 上限回数
        self.sleep_seconds = sleep_seconds  # 呼出間隔

    def _call_api(self, prompt):
        """
        Gemini APIを1回呼び出す内部関数。
        レート制限とリトライ処理を担当する。

        引数:
            prompt: Geminiに送る指示文

        戻り値:
            Geminiの応答テキスト。上限到達 or 失敗時は None。
        """
        # --- 上限チェック ---
        # 呼出回数が上限に達していたら、それ以上APIを呼ばない（コスト保護）
        if self.call_count >= self.max_calls:
            print(f"[Gemini] API呼出上限（{self.max_calls}回）に達したため停止します")
            return None

        # --- リトライループ（最大3回試す）---
        wait_time = self.sleep_seconds  # 初回の待ち時間
        for attempt in range(3):
            try:
                # API呼出を実行
                response = self.model.generate_content(prompt)
                self.call_count += 1

                # 次の呼出まで待機（15回/分の制限を守るため）
                time.sleep(self.sleep_seconds)

                return response.text

            except Exception as e:
                # エラーが起きた場合（レート制限超過など）
                print(f"[Gemini] エラー発生（{attempt + 1}回目）: {e}")

                if attempt < 2:  # まだリトライできる場合
                    # 指数バックオフ: 待ち時間を2倍にしてリトライ
                    wait_time *= 2
                    print(f"[Gemini] {wait_time}秒待ってリトライします...")
                    time.sleep(wait_time)

        # 3回試しても失敗した場合
        print("[Gemini] リトライ上限に達したため、この記事はスキップします")
        return None

    def _parse_json_response(self, text):
        """
        Geminiの応答からJSON部分を取り出して解析する内部関数。

        Geminiは時々 ```json ... ``` のようなマークダウン記法で
        返してくるため、その装飾を取り除いてから解析する。

        引数:
            text: Geminiの応答テキスト

        戻り値:
            解析結果の辞書。解析失敗時は None。
        """
        if not text:
            return None

        try:
            # マークダウンのコードブロック記号を取り除く
            cleaned = text.strip()
            if cleaned.startswith("```"):
                # ```json と ``` を削除する
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]  # 先頭の "json" を削除

            # JSON文字列をPythonの辞書に変換
            return json.loads(cleaned.strip())

        except (json.JSONDecodeError, IndexError):
            print(f"[Gemini] 応答のJSON解析に失敗しました: {text[:100]}")
            return None

    def score_relevance(self, article, category_prompt):
        """
        記事の関連度を1〜5でスコアリングする関数。

        引数:
            article: 記事情報の辞書（title, description を使う）
            category_prompt: カテゴリの説明文（config.yamlのgemini_prompt）

        戻り値:
            スコア（1〜5の整数）。判定失敗時は 0。
        """
        # Geminiへの指示文（プロンプト）を組み立てる
        prompt = f"""あなたはニュースフィルタリングアシスタントです。
以下の記事が「{category_prompt}」に該当するか判定してください。
記事は日本語・英語のどちらの場合もあります。

記事タイトル: {article['title']}
記事概要: {article.get('description') or '（概要なし）'}

以下のJSON形式のみで回答してください（説明文は不要）:
{{"score": 1から5の整数}}

スコア基準:
1 = 完全に無関係
2 = やや関係あるが重要でない
3 = 関連あり
4 = 重要な関連ニュース
5 = 必読レベルの重要ニュース"""

        # API呼出 → JSON解析
        response_text = self._call_api(prompt)
        result = self._parse_json_response(response_text)

        if result and "score" in result:
            score = int(result["score"])
            # スコアが1〜5の範囲に収まっているか確認
            return max(1, min(5, score))

        return 0  # 判定失敗

    def summarize(self, article):
        """
        記事の3行要約とキーワードを生成する関数。
        スコア3以上の記事だけに使う（API節約のため）。

        引数:
            article: 記事情報の辞書

        戻り値:
            (要約文, キーワードのカンマ区切り文字列) のタプル。
            失敗時は (None, None)。
        """
        prompt = f"""以下のニュース記事を要約してください。
記事が英語の場合は、必ず日本語に翻訳した上で要約してください。

タイトル: {article['title']}
概要: {article.get('description') or '（概要なし）'}

以下のJSON形式のみで回答してください:
{{"summary": "日本語3行以内の要約（各行30文字以内、ビジネスパーソン向けに要点を簡潔に）", "keywords": ["日本語キーワード1", "日本語キーワード2", "日本語キーワード3"]}}"""

        response_text = self._call_api(prompt)
        result = self._parse_json_response(response_text)

        if result and "summary" in result:
            summary = result["summary"]
            # キーワードのリストをカンマ区切りの文字列に変換
            # 例: ["AI", "クラウド"] → "AI,クラウド"
            keywords = ",".join(result.get("keywords", []))
            return summary, keywords

        return None, None
