# 📰 News Curator — 自分専用ニュース収集システム

RSSフィードからニュースを自動収集し、AIが「本当に読むべき記事」だけを選んで、
見やすいダッシュボードに表示するシステムです。

**月額コスト: 0円**（すべて無料枠内で動作します）

---

## 仕組み

```
RSSフィード（無料）
    ↓
① Python 収集スクリプト（fetcher.py）
    ↓
② ルールベースフィルタ（prefilter.py）← 求人・広告・重複を無料で除外
    ↓
③ Gemini AI 判定（gemini_client.py）← 関連度スコア＋3行要約
    ↓
④ SQLite データベースに保存（database.py）
    ↓
⑤ JSON書き出し（export_json.py）
    ↓
⑥ Next.js ダッシュボード → GitHub Pages で公開
```

GitHub Actionsが毎日 **朝7時・夜19時** に自動実行します。

---

## セットアップ手順

### 1. Gemini APIキーを取得する（無料）

1. https://aistudio.google.com/ にアクセス
2. Googleアカウントでログイン
3. 左メニューの「**Get API Key**」→「**Create API Key**」をクリック
4. 生成されたキー（`AIza...` で始まる文字列）をコピー

> 💡 無料枠は 15回/分・1500回/日。このシステムは1回の実行で
> 100回程度しか呼ばないため、無料枠内で十分動作します。

### 2. ローカル環境の準備

```bash
# ① このフォルダに移動
cd news-curator

# ② APIキーの設定ファイルを作る
#    .env.example をコピーして .env という名前にする
copy .env.example .env
#    → .env をメモ帳で開いて、APIキーを貼り付ける

# ③ Pythonパッケージをインストール
pip install -r collector/requirements.txt
```

### 3. ニュース収集を実行してみる

```bash
cd collector
python main.py          # ニュースを収集（数分かかります）
python export_json.py   # ダッシュボード用のJSONを書き出す
```

### 4. ダッシュボードを見る

```bash
cd ../dashboard
npm install    # 初回のみ
npm run dev    # 開発サーバーを起動
```

ブラウザで http://localhost:3000 を開くとダッシュボードが表示されます。

---

## GitHub で自動実行する（毎日自動でニュースが集まる）

### 1. GitHubリポジトリを作成してコードをアップロード

```bash
cd news-curator
git init
git add .
git commit -m "初回コミット"
# GitHubで「news-curator」という名前のリポジトリを作成してから:
git remote add origin https://github.com/あなたのユーザー名/news-curator.git
git push -u origin main
```

### 2. APIキーをGitHub Secretsに登録

1. GitHubのリポジトリページを開く
2. **Settings** → **Secrets and variables** → **Actions**
3. 「**New repository secret**」をクリック
4. Name: `GEMINI_API_KEY`、Secret: 取得したAPIキー を入力して保存

### 3. GitHub Pages を有効にする

1. **Settings** → **Pages**
2. Source を「**GitHub Actions**」に設定

### 4. 動作確認

1. リポジトリの **Actions** タブを開く
2. 「ニュース収集とダッシュボード更新」を選択
3. 「**Run workflow**」ボタンで手動実行
4. 完了後、`https://あなたのユーザー名.github.io/news-curator/` でダッシュボードが見られます

以降は毎日 朝7時・夜19時 に自動で更新されます。

---

## カスタマイズ方法

### 【かんたん】サイト上でキーワードを変更する

公開したサイトの「⚙️ キーワード設定」から、ブラウザ上でキーワードを編集できます。
初回のみGitHubトークンの登録が必要です（手順は設定画面に表示されます）。

サイトの「🔄 ニュースを更新」ボタンを押すと、その場で収集が実行されます。

### 省エネの仕組み（30日ルール）

30日以上サイトにアクセスがないと、定期収集は自動で止まります。
再開したい時はサイトの「🔄 ニュースを更新」ボタンを押すだけです。

### 追跡する企業・キーワードを変更する（ファイル編集の場合）

[collector/config.yaml](collector/config.yaml) を編集するだけです。
※ サイトの設定画面で保存したキーワード（collector/keywords.json）がある場合は、そちらが優先されます。

```yaml
keywords:
  - "NTTコミュニケーションズ"   # ← 追跡したい企業名を追加・削除
  - "KDDI"
```

### カテゴリを追加する

`config.yaml` の `categories:` に新しいカテゴリを追加します。
ファイル内のコメントに具体例があります。

### 不要な記事が混ざる場合

[collector/ng_words.py](collector/ng_words.py) にNGワードを追加してください。
そのワードを含む記事は自動で除外されます。

### 収集時刻を変更する

[.github/workflows/collect.yml](.github/workflows/collect.yml) の `cron:` を編集します。
時刻はUTC（日本時間マイナス9時間）で指定することに注意してください。

---

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `collector/config.yaml` | ★設定ファイル（キーワード・フィード・カテゴリ） |
| `collector/main.py` | 収集のメイン処理 |
| `collector/fetcher.py` | RSSフィード取得 |
| `collector/prefilter.py` | ルールベースフィルタ |
| `collector/ng_words.py` | NGワードリスト |
| `collector/gemini_client.py` | Gemini AI 呼び出し |
| `collector/database.py` | SQLiteデータベース操作 |
| `collector/export_json.py` | JSON書き出し |
| `dashboard/` | Next.js ダッシュボード |
| `.github/workflows/collect.yml` | 自動実行スケジュール |

---

## コスト管理の仕組み

| 対策 | 内容 |
|------|------|
| ルールベース前処理 | API呼出前に約6〜7割の記事を無料で除外 |
| 呼出間隔 4秒 | 無料枠の15回/分制限を守る |
| 1実行500回上限 | `config.yaml` の `max_calls_per_run` で変更可能 |
| 重複スキップ | 保存済み記事は再判定しない |

すべて無料枠（Gemini API・GitHub Actions・GitHub Pages）で動作するため、**月額0円**です。
