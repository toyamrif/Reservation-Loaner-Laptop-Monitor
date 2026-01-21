# AWS RDS & Lambda API セットアップガイド

## 概要

このガイドでは、AWS RDS PostgreSQLデータベースとLambda API関数のセットアップ手順を説明します。

## 前提条件

- AWSアカウント
- AWS CLIがインストールされている（オプション）
- PostgreSQLクライアント（psql）がインストールされている

## ステップ1: RDS PostgreSQLデータベースの作成

### 1.1 RDSコンソールにアクセス

1. AWS Management Consoleにログイン
2. RDSサービスに移動
3. 「データベースの作成」をクリック

### 1.2 データベース設定

**エンジンオプション:**
- エンジンタイプ: PostgreSQL
- バージョン: PostgreSQL 15.x（最新の安定版）

**テンプレート:**
- 無料利用枠（開発・テスト用）または本番稼働用

**設定:**
- DBインスタンス識別子: `inventory-management-db`
- マスターユーザー名: `postgres`
- マスターパスワード: 強力なパスワードを設定（メモしておく）

**インスタンス設定:**
- DBインスタンスクラス: db.t3.micro（無料利用枠）または db.t3.small
- ストレージ: 20 GB（汎用SSD）

**接続:**
- VPC: デフォルトVPC
- パブリックアクセス: はい（開発用）/ いいえ（本番用）
- VPCセキュリティグループ: 新規作成
- アベイラビリティゾーン: 指定なし

**データベース認証:**
- パスワード認証

**追加設定:**
- 初期データベース名: `inventory_management`
- バックアップ保持期間: 7日
- 暗号化: 有効化

### 1.3 セキュリティグループの設定

1. RDSインスタンスのセキュリティグループを選択
2. インバウンドルールを編集
3. PostgreSQL（ポート5432）を追加:
   - タイプ: PostgreSQL
   - ポート: 5432
   - ソース: Lambda関数のセキュリティグループ（後で設定）

## ステップ2: データベースの初期化

### 2.1 RDSエンドポイントの確認

RDSコンソールでデータベースのエンドポイントをコピー:
```
inventory-management-db.xxxxxxxxxx.ap-northeast-1.rds.amazonaws.com
```

### 2.2 ローカルから接続してマイグレーション実行

```bash
# 環境変数を設定
export DB_HOST=inventory-management-db.xxxxxxxxxx.ap-northeast-1.rds.amazonaws.com
export DB_PORT=5432
export DB_NAME=inventory_management
export DB_USER=postgres
export DB_PASSWORD=your-password

# マイグレーション実行
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/migrations/001_create_tables.sql

# 初期データ投入
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/seeds/initial_data.sql
```

## ステップ3: Lambda関数の作成

### 3.1 Lambda関数のパッケージング

```bash
cd lambda-api
npm install
zip -r function.zip index.js node_modules/
```

### 3.2 Lambda関数の作成

1. AWS Lambda コンソールに移動
2. 「関数の作成」をクリック
3. 設定:
   - 関数名: `inventory-api`
   - ランタイム: Node.js 18.x
   - アーキテクチャ: x86_64
   - 実行ロール: 新しいロールを作成（基本的なLambda権限）

### 3.3 関数コードのアップロード

1. 「コード」タブで「アップロード元」→「.zipファイル」を選択
2. `function.zip`をアップロード

### 3.4 環境変数の設定

「設定」→「環境変数」で以下を追加:

```
DB_HOST=inventory-management-db.xxxxxxxxxx.ap-northeast-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=inventory_management
DB_USER=postgres
DB_PASSWORD=your-password
DB_SSL=true
```

### 3.5 VPC設定

1. 「設定」→「VPC」
2. RDSと同じVPCを選択
3. サブネットを選択（プライベートサブネット推奨）
4. セキュリティグループを選択（RDSへのアクセスを許可）

### 3.6 タイムアウトとメモリの設定

- タイムアウト: 30秒
- メモリ: 512 MB

## ステップ4: API Gatewayの設定

### 4.1 REST APIの作成

1. API Gateway コンソールに移動
2. 「APIを作成」→「REST API」を選択
3. API名: `inventory-api`
4. エンドポイントタイプ: リージョン

### 4.2 リソースとメソッドの作成

**リソース構造:**
```
/
├── /equipment
│   ├── GET
│   ├── POST
│   └── /{code}
│       └── PUT
├── /inventory
│   └── GET
└── /reservations
    ├── GET
    └── POST
```

各メソッドで:
1. 統合タイプ: Lambda関数
2. Lambda関数: `inventory-api`
3. Lambda プロキシ統合を使用: チェック

### 4.3 CORSの有効化

各リソースで「CORSを有効にする」を実行

### 4.4 APIのデプロイ

1. 「アクション」→「APIのデプロイ」
2. ステージ名: `prod`
3. デプロイ

### 4.5 APIエンドポイントの確認

デプロイ後、以下のようなURLが生成されます:
```
https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod
```

## ステップ5: フロントエンドの更新

### 5.1 API URLの設定

`admin.html`と`index.html`に以下を追加:

```javascript
const API_BASE_URL = 'https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod';
```

### 5.2 LocalStorageからAPI呼び出しに変更

機器データの取得:
```javascript
// 旧: LocalStorageから取得
const equipmentList = JSON.parse(localStorage.getItem('equipmentList')) || [];

// 新: APIから取得
async function loadEquipment() {
  const response = await fetch(`${API_BASE_URL}/equipment`);
  const equipmentList = await response.json();
  return equipmentList;
}
```

## ステップ6: テスト

### 6.1 APIエンドポイントのテスト

```bash
# 機器一覧取得
curl https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/equipment

# 在庫一覧取得
curl https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/inventory

# 予約一覧取得
curl https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/reservations
```

### 6.2 フロントエンドのテスト

1. Amplifyで再デプロイ
2. ブラウザで動作確認
3. 開発者ツールでネットワークタブを確認

## トラブルシューティング

### Lambda関数がRDSに接続できない

- VPC設定を確認
- セキュリティグループのインバウンドルールを確認
- RDSのパブリックアクセス設定を確認

### CORSエラー

- API GatewayでCORSを有効化
- Lambda関数のレスポンスヘッダーを確認

### タイムアウトエラー

- Lambda関数のタイムアウト設定を延長
- データベースクエリを最適化

## セキュリティのベストプラクティス

1. **本番環境では:**
   - RDSのパブリックアクセスを無効化
   - Lambda関数をプライベートサブネットに配置
   - Secrets Managerでデータベース認証情報を管理

2. **認証・認可:**
   - API GatewayでCognito認証を追加
   - IAM権限を最小限に設定

3. **監視:**
   - CloudWatch Logsでログを確認
   - CloudWatch Alarmsでエラーを監視

## コスト見積もり

**無料利用枠（12ヶ月）:**
- RDS: db.t3.micro 750時間/月
- Lambda: 100万リクエスト/月、40万GB秒/月
- API Gateway: 100万リクエスト/月

**無料利用枠後（概算）:**
- RDS db.t3.micro: ~$15/月
- Lambda: ~$0.20/月（1万リクエスト）
- API Gateway: ~$3.50/月（1万リクエスト）

合計: ~$20/月
