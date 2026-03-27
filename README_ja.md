<p align="center">
  🌐 &nbsp;
  <a href="README.md">English</a> &nbsp;|&nbsp;
  <a href="README_ch.md">中文</a> &nbsp;|&nbsp;
  <a href="README_es.md">Español</a> &nbsp;|&nbsp;
  <a href="README_fr.md">Français</a> &nbsp;|&nbsp;
  <strong>日本語</strong> &nbsp;|&nbsp;
  <a href="README_ko.md">한국어</a>
</p>

# AssetPilot — 個人資産管理

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  個人資産管理ウェブアプリケーション — 家計簿、株式管理、予算管理をひとつにまとめました。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.4-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## 目次

- [はじめに](#はじめに)
- [主な特徴](#主な特徴)
- [機能一覧](#機能一覧)
  - [ダッシュボード](#ダッシュボード)
  - [家計管理](#家計管理)
  - [株式記録](#株式記録)
  - [レポート](#レポート)
  - [予算管理](#予算管理)
  - [口座管理](#口座管理)
  - [設定・管理機能](#設定管理機能)
- [技術スタック](#技術スタック)
- [インストール方法](#インストール方法)
  - [方法1：Docker Hub ワンクリックデプロイ（推奨）](#方法1docker-hub-ワンクリックデプロイ推奨)
  - [方法2：Docker Compose](#方法2docker-compose)
  - [方法3：Node.js 直接実行](#方法3nodejs-直接実行)
- [環境変数](#環境変数)
- [デプロイガイド](#デプロイガイド)
  - [Synology NAS](#synology-nas)
  - [クラウド VPS](#クラウド-vps)
  - [Nginx リバースプロキシ](#nginx-リバースプロキシ)
  - [Caddy リバースプロキシ](#caddy-リバースプロキシ)
- [Google SSO 設定](#google-sso-設定)
- [使い方ガイド](#使い方ガイド)
  - [初期設定](#初期設定)
  - [取引の追加](#取引の追加)
  - [クレジットカード支払いガイド](#クレジットカード支払いガイド)
  - [株式管理](#株式管理)
  - [為替レート管理](#為替レート管理)
  - [CSV エクスポートとインポート](#csv-エクスポートとインポート)
  - [管理者操作](#管理者操作)
- [Docker 高度な管理](#docker-高度な管理)
- [セキュリティ](#セキュリティ)
- [ファイル構成](#ファイル構成)
- [API ソース](#api-ソース)
- [ライセンス](#ライセンス)

---

## はじめに

**AssetPilot** は、プライバシーを最優先に設計された個人資産管理ウェブアプリケーションです。

すべてのデータはローカル（またはセルフホストサーバー）に保存され、サードパーティのクラウドデータベースは不要です。Docker コマンド一つでデプロイでき、家庭用 NAS（Synology など）、VPS、またはローカルマシンへの導入に最適です。

**こんな方におすすめ：**

- 個人のキャッシュフロー、月次収支、予算を管理したい方
- 台湾株式市場への投資家で、保有株、損益、配当を管理したい方
- 財務データをサードパーティのプラットフォームに保存したくない、プライバシー意識の高い方

---

## 主な特徴

| 機能 | 説明 |
|------|------|
| 🏠 **セルフホスト・データ所有権** | 暗号化されたデータベースをローカルに保存。外部サーバーへの財務データのアップロードなし |
| 🐳 **Docker ワンクリックデプロイ** | 設定不要。JWT キーと暗号化キーは自動生成 |
| 📊 **TWSE との深い統合** | TWSE OpenAPI を通じたリアルタイム株価、配当自動同期、FIFO 損益計算 |
| 💱 **多通貨サポート** | 150 以上の通貨に対応。exchangerate-api.com によるライブ為替レート |
| 📱 **レスポンシブデザイン** | デスクトップ・モバイルどちらでも快適に動作 |
| 🔒 **エンタープライズグレードのセキュリティ** | ChaCha20-Poly1305 データベース暗号化、Helmet セキュリティヘッダー、レート制限、CSP |
| 👥 **マルチユーザー管理** | 複数ユーザーをサポート。管理者が登録ポリシーの制御とログイン履歴の監査が可能 |
| 🔑 **Google SSO** | OAuth Authorization Code Flow によるオプションの Google ワンクリックログイン |

---

## 機能一覧

### ダッシュボード

- 総資産概要カード（全口座残高の合計）
- 月次収入・支出サマリー
- 支出カテゴリードーナツチャート（二重リングチャート対応：内側リング＝親カテゴリー、外側リング＝サブカテゴリー）
- 資産配分ドーナツチャート（口座資産＋株式市場価値、二重リング切り替え可能）
- 最近の取引一覧

### 家計管理

**取引記録**
- メモ、カテゴリー、口座、通貨を含む収入・支出・振替の CRUD
- 将来日付の取引は「未来」ラベルが自動付与され、識別・フィルタリングが可能
- 複数選択による一括操作：一括削除、カテゴリー・口座・日付の一括変更
- 双方向自動ペアリングによる口座間振替（`linked_id`）

**予算管理**
- 月次総予算＋カテゴリー別予算
- 残余予算をリアルタイムで表示するビジュアルプログレスバー

**口座管理**
- 複数口座（現金、銀行、クレジットカードなど）
- 取引記録から残高を自動計算
- ライブ為替レート変換対応の多通貨口座

**為替レート設定**
- exchangerate-api.com と連携。150 以上の通貨をサポート
- 手動または自動同期。最終更新タイムスタンプを表示

**カテゴリー管理**
- 二階層の親子カテゴリー構造（例：食費 → 朝食・昼食・夕食）
- カテゴリーカラーのカスタマイズ

**固定収支**
- 定期的な収入・支出（家賃、給与など）の設定により、取引記録が自動生成される

### 株式記録

**保有株一覧**
- リアルタイム時価、含み損益、リターン率の計算
- TWSE から最新の現値・終値を自動取得（3 段階戦略）
- 銘柄ごとの価格ソース（リアルタイム価格・終値）とタイムスタンプ付き一括価格更新

**取引記録**
- 整数株・端株に対応した買付・売却記録
- 証券手数料の自動計算（`0.1425%`、整数株最低 NT$20）
- 売却時の有価証券取引税の自動計算（一般株 `0.3%`、ETF・ワラント `0.1%`）
- 証券コードを入力すると TWSE を自動照会し、銘柄を作成（事前の手動登録不要）
- 検索・フィルター、ページネーション、複数選択一括削除

**配当記録**
- 現金配当・株式配当の記録
- TWSE からの配当自動同期（`TWT49U` + `TWT49UDetail`）、重複防止機能付き

**実現損益**
- 売却ごとの FIFO による平均コスト、実現損益、リターン率の計算
- サマリーカード：総実現損益、全体リターン率、当年損益

**積立投資プラン（DCA）**
- 期間と1サイクルあたりの予算を設定すると、買付取引が自動生成される

### レポート

- **カテゴリーレポート**：親カテゴリードーナツチャート、二重リング切り替え可能（内側＝親、外側＝サブ）。凡例とツールチップに金額と割合を表示
- **トレンド分析**：月次収支折れ線グラフ
- **日次支出**：日次支出棒グラフ
- カスタム日付範囲フィルター

### 口座管理

- 複数口座の追加・編集・削除
- 各口座のリアルタイム残高を表示

### 設定・管理機能

**アカウント設定**
- 表示名とパスワードの編集
- 個人ログイン履歴の確認（直近 100 件）：タイムスタンプ、IP アドレス、国、ログイン方法

**データエクスポート・インポート**
- 取引記録の CSV エクスポート・インポート（カテゴリー構造を含む）
- 株式取引記録の CSV エクスポート・インポート
- 配当記録の CSV エクスポート・インポート

**管理者機能**
- 公開登録のオン・オフ切り替え。メールホワイトリストの設定
- ユーザーアカウントの追加・削除
- 全ユーザーのログイン記録の確認（失敗した試みを含む）
- ページを更新せずにログイン記録を手動同期

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Vanilla HTML / CSS / JavaScript（`history.pushState` による SPA） |
| バックエンド | Node.js + Express |
| データベース | SQLite（sql.js、インメモリ＋ファイル永続化） |
| 暗号化 | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 |
| 認証 | JWT（Bearer Token）+ bcryptjs。Google OAuth Code Flow（オプション） |
| チャート | Chart.js |
| アイコン | Font Awesome 6 |
| セキュリティ | Helmet、express-rate-limit、SRI、CORS ホワイトリスト、CSP |

---

## インストール方法

### 方法1：Docker Hub ワンクリックデプロイ（推奨）

設定は不要です。以下のコマンドを実行するだけです：

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

[http://localhost:3000](http://localhost:3000) を開いてすぐに使い始められます。

> **これだけです！** データベース、JWT キー、暗号化キー、ボリュームはすべて自動作成されます。

---

### 方法2：Docker Compose

`docker-compose.yml` ファイルを作成します：

```yaml
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - GOOGLE_CLIENT_ID=          # オプション：SSO を有効にする場合は Google OAuth Client ID を入力
      # - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
```

コンテナを起動します：

```bash
docker compose up -d
```

---

### 方法3：Node.js 直接実行

**必要条件：** Node.js >= 18

```bash
# 1. 依存関係をインストール
npm install

# 2. 環境変数を設定
cp .env.example .env
# 必要に応じて .env を編集

# 3. サーバーを起動
node server.js
```

[http://localhost:3000](http://localhost:3000) を開いてアプリを使い始めてください。

---

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `PORT` | サーバーポート | `3000` |
| `JWT_SECRET` | JWT 署名キー（本番環境では必ず変更すること） | Docker が自動生成 |
| `JWT_EXPIRES` | JWT 有効期限 | `7d` |
| `DB_ENCRYPTION_KEY` | データベース暗号化キー | Docker が自動生成 |
| `DB_PATH` | データベースファイルパス | `/app/data/database.db` |
| `ENV_PATH` | 自動生成される .env ファイルパス | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID（オプション） | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret（オプション） | — |
| `ALLOWED_ORIGINS` | CORS ホワイトリスト、カンマ区切り（空白の場合は制限なし） | — |
| `EXCHANGE_RATE_API_KEY` | exchangerate-api.com API キー（オプション） | — |
| `IPINFO_TOKEN` | IP ルックアップのクォータ拡大用 ipinfo.io トークン（オプション） | — |
| `CHANGELOG_URL` | リモート changelog.json の URL | デフォルト GitHub リポジトリ URL |

---

## デプロイガイド

### Synology NAS

**方法 A：Container Manager GUI（最も簡単）**

1. DSM → **Container Manager** → **レジストリ** → `es94111/assetpilot` を検索 → ダウンロード
2. **コンテナ** → **作成** → `es94111/assetpilot:latest` を選択
3. ポートを設定：`3000 → 3000`。ボリュームは自動作成
4. コンテナを起動

**方法 B：SSH コマンド**

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  es94111/assetpilot:latest
```

**リバースプロキシ（カスタムドメイン + HTTPS）**

DSM → **コントロールパネル** → **ログインポータル** → **詳細** → **リバースプロキシ** でルールを追加します：

| フィールド | 値 |
|-----------|-----|
| ソースプロトコル | HTTPS |
| ソースホスト名 | `your-domain.com` |
| ソースポート | 443 |
| 宛先プロトコル | HTTP |
| 宛先ホスト名 | `localhost` |
| 宛先ポート | `3000` |

カスタムヘッダーを追加：`X-Forwarded-For` → `$proxy_add_x_forwarded_for`

---

### クラウド VPS

```bash
mkdir assetpilot && cd assetpilot

cat > docker-compose.yml << 'EOF'
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
EOF

docker compose up -d
```

---

### Nginx リバースプロキシ

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Caddy リバースプロキシ

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy は HTTPS 証明書の取得と更新を自動的に行います。

---

## Google SSO 設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスし、OAuth 2.0 クライアント ID を作成します（タイプ：ウェブアプリケーション）
2. **承認済みの JavaScript オリジン**を設定します：
   - ローカル：`http://localhost:3000`
   - 本番環境：`https://your-domain.com`
3. **承認済みのリダイレクト URI** を設定します：
   - ローカル：`http://localhost:3000/`
   - 本番環境：`https://your-domain.com/`
4. `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を環境変数として設定し、再起動します
5. 設定されていない場合、Google ログインボタンは自動的に非表示となり、パスワードログインには影響しません

> ⚠️ ログイン後に `/?code=...` で止まる場合は、Google Console のリダイレクト URI がドメインと完全に一致していることを確認してください（`https://` と末尾の `/` を含む）。

---

## 使い方ガイド

### 初期設定

1. ブラウザで `http://localhost:3000` にアクセスします
2. **「今すぐ登録」** をクリックしてアカウントを作成します
3. **最初に登録したユーザーが自動的に管理者になります**
4. デフォルトのカテゴリー（食費、衣服、住居、交通費など）と口座（現金、銀行口座）が自動作成されます
5. ログイン後すぐにアプリを使い始められます

---

### 取引の追加

1. サイドバーの **「家計」** をクリックします
2. 右上の **「＋ 取引を追加」** をクリックします
3. 日付、種類（収入・支出・振替）、金額、カテゴリー、口座を入力します
4. 必要に応じてメモと通貨を追加します
5. **「保存」** をクリックします

**一括操作：** チェックボックスで複数の取引を選択し、アクションバーを使って一括削除やカテゴリー・口座・日付の一括変更が行えます。

---

### クレジットカード支払いガイド

クレジットカードで支払う際は、クレジットカードを口座として**支出**として記録してください。残高がマイナスになることも可能です（実際の負債を反映します）。

**クレジットカードの引き落とし時：**

1. **家計** → **取引を追加**
2. 種類を **振替** に設定
3. 振替元口座：**銀行口座**
4. 振替先口座：**クレジットカード口座**
5. 支払金額を入力して保存

これにより銀行残高から差し引かれ、クレジットカードのマイナス残高が相殺されます。支出として二重計上されることはありません。

---

### 株式管理

**株式ポジションの追加**

1. **株式記録** → **取引記録** → **＋ 株式取引を追加**
2. 証券コードを入力します（例：`2330`）。システムが TWSE を自動照会し、名称と現在の価格を入力します
3. 購入日、株数、取引価格を入力します
4. 証券手数料と取引税は自動計算されます（編集可能）
5. 保存後、ポートフォリオに追加されます

**株価の更新**

保有株一覧ページの **「価格を更新」** をクリックします。システムは 3 段階戦略で最新価格を取得します：
- 取引時間中 → TWSE リアルタイム価格
- 終値後 → STOCK_DAY 終値
- その他 → STOCK_DAY_ALL フォールバック

**配当の同期**

**配当記録** → **配当を同期** — 保有期間に基づいて現金配当と株式配当を自動追加します（重複防止機能付き）。

---

### 為替レート管理

1. **家計** → **口座管理** → **為替レート設定**
2. **「今すぐライブレートを取得」** をクリックして手動同期します
3. または **「為替レートの自動更新」** を有効にして、ページ訪問時に自動同期します
4. 3文字の通貨コードでカスタム通貨を追加できます

---

### CSV エクスポートとインポート

**パス：** **設定** → **データエクスポート・インポート**

| 種類 | エクスポートフィールド |
|------|---------------------|
| 取引記録 | 日付、種類、金額、通貨、カテゴリー、口座、メモ |
| 株式取引記録 | 日付、証券コード、銘柄名、種類（買付・売却）、株数、価格、手数料、税金、口座、メモ |
| 配当記録 | 日付、証券コード、銘柄名、現金配当、株式配当、メモ |

**インポートに関する注意：** 証券コードが存在しない場合、インポート時に自動作成されます。名称が正しくない場合は、CSV の名称で更新されます。

---

### 管理者操作

**パス：** **設定** → **管理者**

| 機能 | 説明 |
|------|------|
| 公開登録の切り替え | 誰でも自己登録できるかどうかを制御 |
| メールホワイトリスト | ホワイトリストのメールアドレスのみ登録を許可（1行1件） |
| アカウントの追加 | 新しいユーザーを直接作成。管理者権限の付与も可能 |
| アカウントの削除 | ユーザーとすべての関連データを永久削除 |
| ログイン監査 | 全ユーザーのログイン日時、IP、国、成功・失敗の状態を確認 |

---

## Docker 高度な管理

### イメージ情報

| 項目 | 値 |
|------|-----|
| Docker Hub | [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) |
| 対応アーキテクチャ | `linux/amd64`、`linux/arm64` |
| ベースイメージ | `node:24-alpine` |
| イメージサイズ | 約 180 MB |
| ヘルスチェック | 30 秒ごとに自動確認 |

### ボリュームとデータ永続化

コンテナ内の `/app/data` ディレクトリにすべての永続データが格納されます：

```
/app/data/
├── database.db    # 暗号化された SQLite データベース
└── .env           # 自動生成されたキー（JWT_SECRET、DB_ENCRYPTION_KEY）
```

**3 つのマウント方法：**

```bash
# 1. 匿名ボリューム（最も簡単）
docker run -d -p 3000:3000 es94111/assetpilot:latest

# 2. 名前付きボリューム（推奨、管理しやすい）
docker run -d -p 3000:3000 -v assetpilot-data:/app/data es94111/assetpilot:latest

# 3. バインドマウント（ファイルに直接アクセスする場合）
docker run -d -p 3000:3000 -v /path/to/data:/app/data es94111/assetpilot:latest
```

### バックアップと復元

```bash
# バックアップ
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# 復元
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **重要：** ボリュームを削除すると、データベースと暗号化キーが永久に失われます。削除前に必ずバックアップを取ってください。

### 一般的な管理コマンド

```bash
# コンテナの状態を確認（ヘルスチェックを含む）
docker ps

# ライブログを確認
docker logs -f assetpilot

# 停止・再起動
docker stop assetpilot
docker restart assetpilot

# 最新バージョンに更新
docker pull es94111/assetpilot:latest
docker rm -f assetpilot
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

### 独自イメージのビルド

```bash
docker build -t assetpilot .

docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  assetpilot
```

---

## セキュリティ

| メカニズム | 説明 |
|-----------|------|
| **データベース暗号化** | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 キー導出 |
| **パスワードハッシュ化** | bcryptjs によるハッシュ保存 — パスワードは平文で保存されない |
| **XSS 防護** | すべてのユーザー入力は DOM に挿入される前に `escHtml()` でエスケープ |
| **セキュリティヘッダー** | Helmet（HSTS、X-Content-Type-Options、Referrer-Policy） |
| **CSP 保護** | インラインスクリプトをブロック。スクリプトとリソースのソースを制限 |
| **レート制限** | ログイン・登録 API を IP ごとに 15 分あたり 20 リクエストに制限 |
| **CORS 制御** | `ALLOWED_ORIGINS` で許可するオリジンドメインを制限 |
| **OAuth ステート検証** | Google ログインは CSRF・リプレイ攻撃防止のためワンタイムステートトークンを使用 |
| **SRI 検証** | 外部 CDN スクリプト（Font Awesome、Chart.js）に integrity 属性を付与 |
| **属性インジェクション防護** | 口座アイコンフィールドをホワイトリストで検証（`fa-*` のみ許可） |
| **ログイン監査** | ログイン日時、IP、国、方法を記録。管理者は失敗した試みを確認可能 |
| **ヘルスチェック** | Docker HEALTHCHECK が 30 秒ごとにサービス状態を自動検出 |

---

## ファイル構成

```
├── server.js              # Express バックエンド（API + データベース）
├── app.js                 # フロントエンド SPA ロジック（IIFE モジュール）
├── index.html             # シングルページ HTML（全ページ + モーダル）
├── style.css              # グローバルスタイル
├── logo.svg               # ウェブサイトロゴ（ログインページ）
├── favicon.svg            # Favicon + サイドバーロゴ
├── changelog.json         # バージョン更新記録
├── Dockerfile             # Docker ビルド設定
├── docker-compose.yml     # Docker Compose 設定
├── .env.example           # 環境変数テンプレート
├── .gitignore             # Git 無視リスト
├── SRS.md                 # ソフトウェア要件仕様書
├── .github/workflows/
│   └── docker-publish.yml # CI/CD 自動ビルド・プッシュ
└── data/                  # データディレクトリ（Docker Volume マウント）
    ├── database.db        # 暗号化された SQLite データベース（自動生成）
    └── .env               # キーファイル（自動生成）
```

---

## API ソース

| サービス | 用途 | リンク |
|---------|------|--------|
| **TWSE OpenAPI** | 台湾株式リアルタイム価格と配当データ | [openapi.twse.com.tw](https://openapi.twse.com.tw/) |
| **exchangerate-api.com** | グローバルライブ為替レート（基準通貨：TWD） | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| **Google Identity Services** | Google SSO ログイン | [developers.google.com/identity](https://developers.google.com/identity) |
| **IPinfo Lite** | IP 国名ルックアップ | [ipinfo.io/lite](https://ipinfo.io/lite) |

IP アドレスデータは IPinfo が提供しています。

---

## ライセンス

[MIT License](LICENSE)

---
