# データベースセットアップガイド

## 概要

在庫管理システムのデータベーススキーマとモデル実装が完了しました。このガイドでは、データベースのセットアップと初期化手順を説明します。

## 作成されたファイル

### データベース関連
- `database/migrations/001_create_tables.sql` - テーブル作成SQL
- `database/seeds/initial_data.sql` - 初期データ投入SQL
- `src/database/connection.js` - データベース接続管理

### モデル
- `src/models/BaseModel.js` - ベースモデルクラス
- `src/models/Reservation.js` - 予約モデル
- `src/models/EquipmentItem.js` - 個別機器モデル（AL1、NAL1、Monitor1など）
- `src/models/Inventory.js` - 在庫モデル
- `src/models/SiteManager.js` - サイト担当者モデル
- `src/models/NotificationLog.js` - 通知ログモデル
- `src/models/index.js` - モデルインデックス

### スクリプト
- `scripts/migrate.js` - マイグレーション実行
- `scripts/seed.js` - シード実行
- `package.json` - 依存関係定義
- `.env.example` - 環境変数テンプレート

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env`ファイルを編集してデータベース接続情報を設定：

```env
DATABASE_URL=postgresql://username:password@localhost:5432/inventory_management
```

### 3. データベースの作成

PostgreSQLで新しいデータベースを作成：

```sql
CREATE DATABASE inventory_management;
```

### 4. マイグレーション実行

```bash
npm run db:migrate
```

### 5. 初期データ投入

```bash
npm run db:seed
```

## データベーススキーマ

### 主要テーブル

1. **reservations** - 予約情報
2. **reservation_equipment** - 予約機器詳細
3. **inventory** - 在庫数管理
4. **equipment_items** - 個別機器管理（新規追加）
5. **equipment_usage_history** - 機器使用履歴（新規追加）
6. **site_managers** - サイト担当者
7. **notification_logs** - 通知ログ

### 個別機器管理の特徴

- **機器コード**: AL1、NAL1、Monitor1形式
- **ステータス管理**: available、in_use、maintenance、retired
- **使用履歴追跡**: 誰がいつからいつまで使用したかを記録
- **自動割り当て**: 予約確定時に利用可能な機器を自動選択

## 初期データ

### 在庫データ
- HND10: Amazon PC×5、Non-Amazon PC×3、Monitor×8
- HND17: Amazon PC×4、Non-Amazon PC×2、Monitor×6  
- HND21: Amazon PC×6、Non-Amazon PC×4、Monitor×10

### 個別機器データ
- Amazon PC: AL1〜AL15（各サイトに分散配置）
- Non-Amazon PC: NAL1〜NAL9（各サイトに分散配置）
- Monitor: Monitor1〜Monitor24（各サイトに分散配置）

### サイト担当者
- 各サイトに1〜2名の担当者を配置

## モデルの使用例

```javascript
const { Reservation, EquipmentItem, Inventory } = require('./src/models');

// 予約作成
const reservation = await Reservation.createWithEquipment(
  {
    user_alias: 'user01',
    pickup_site: 'HND10',
    start_date: '2024-12-25',
    end_date: '2024-12-27'
  },
  [
    { equipment_type: 'amazon_pc', quantity: 1 },
    { equipment_type: 'monitor', quantity: 1 }
  ]
);

// 利用可能な機器取得
const availablePC = await EquipmentItem.findAvailable('HND10', 'amazon_pc', 1);

// 機器割り当て
await EquipmentItem.assignToReservation(
  availablePC[0].id, 
  reservation.id, 
  'user01'
);

// 在庫確認
const available = await Inventory.getAvailableQuantity(
  'HND10', 
  'amazon_pc', 
  '2024-12-25', 
  '2024-12-27'
);
```

## 次のステップ

データベースセットアップが完了したら、以下のタスクに進むことができます：

1. **認証システム実装** (タスク3)
2. **在庫管理エンジン実装** (タスク4)
3. **予約管理システム実装** (タスク6)
4. **個別機器管理システム実装** (タスク6.1)

## トラブルシューティング

### 接続エラー
- PostgreSQLサービスが起動しているか確認
- 接続情報（ホスト、ポート、ユーザー名、パスワード）が正しいか確認

### 権限エラー
- データベースユーザーに適切な権限があるか確認
- テーブル作成権限があるか確認

### マイグレーションエラー
- 既存のテーブルがある場合は削除してから再実行
- SQLシンタックスエラーがないか確認