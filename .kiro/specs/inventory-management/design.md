# 在庫管理システム設計書

## 概要

既存のLoaner Laptop予約システムに在庫管理機能を統合し、リアルタイムな在庫管理、自動通知システム、認証機能、設置完了管理、返却管理を含む包括的なシステムを構築する。本システムは、ユーザーフレンドリーな予約体験と効率的な管理機能を提供する。

## アーキテクチャ

### システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   フロントエンド   │    │   バックエンドAPI   │    │    データベース    │
│                 │    │                 │    │                 │
│ - 予約フォーム    │◄──►│ - 在庫管理API    │◄──►│ - 予約データ      │
│ - 管理画面       │    │ - 通知API       │    │ - 在庫データ      │
│ - 認証画面       │    │ - 認証API       │    │ - ユーザーデータ   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   外部サービス    │
                    │                 │
                    │ - Midway認証     │
                    │ - メール送信      │
                    │ - Slack API     │
                    └─────────────────┘
```

### 技術スタック

**フロントエンド:**
- HTML5, CSS3, JavaScript (ES6+)
- 既存のindex.htmlを拡張
- レスポンシブデザイン対応

**バックエンド:**
- Node.js + Express.js
- RESTful API設計
- JWT認証 (Midway認証の代替案含む)

**データベース:**
- PostgreSQL (推奨) または MySQL
- Redis (セッション管理・キャッシュ)

**外部サービス:**
- Slack Web API
- SMTP/SendGrid (メール送信)
- Midway認証API (利用可能な場合)

## コンポーネントと インターフェース

### 1. 認証コンポーネント

```javascript
// 認証インターフェース
interface AuthService {
  authenticateWithMidway(): Promise<AuthResult>
  validateAlias(alias: string): Promise<ValidationResult>
  getSessionInfo(): SessionInfo
}

// 代替認証実装
interface FallbackAuthService {
  validateAliasFormat(alias: string): boolean
  checkAliasInDirectory(alias: string): Promise<boolean>
  createTemporarySession(alias: string): Session
}
```

### 2. 在庫管理コンポーネント

```javascript
interface InventoryService {
  getAvailableInventory(site: string, startDate: Date, endDate: Date): Promise<Inventory>
  reserveEquipment(reservation: ReservationRequest): Promise<ReservationResult>
  releaseEquipment(reservationId: string): Promise<void>
  updateInventory(site: string, equipment: Equipment[]): Promise<void>
}
```

### 3. 通知コンポーネント

```javascript
interface NotificationService {
  sendEmail(to: string, template: string, data: any): Promise<void>
  sendSlackMessage(userId: string, message: string): Promise<void>
  sendSlackToChannel(channel: string, message: string): Promise<void>
  scheduleReminder(reservationId: string, date: Date): Promise<void>
}
```

### 4. 予約管理コンポーネント

```javascript
interface ReservationService {
  createReservation(request: ReservationRequest): Promise<Reservation>
  updateReservationStatus(id: string, status: ReservationStatus): Promise<void>
  getReservationsByDate(date: Date): Promise<Reservation[]>
  cancelReservation(id: string): Promise<void>
}
```

## データモデル

### 1. 予約 (Reservations)

```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY,
  user_alias VARCHAR(100) NOT NULL,
  pickup_site VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'pending', 'confirmed', 'setup_complete', 'returned', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. 予約機器 (Reservation_Equipment)

```sql
CREATE TABLE reservation_equipment (
  id UUID PRIMARY KEY,
  reservation_id UUID REFERENCES reservations(id),
  equipment_type VARCHAR(50) NOT NULL, -- 'non_amazon_pc', 'amazon_pc', 'monitor'
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. 在庫 (Inventory)

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  site VARCHAR(20) NOT NULL,
  equipment_type VARCHAR(50) NOT NULL,
  total_quantity INTEGER NOT NULL,
  available_quantity INTEGER NOT NULL,
  maintenance_quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. サイト担当者 (Site_Managers)

```sql
CREATE TABLE site_managers (
  id UUID PRIMARY KEY,
  site VARCHAR(20) NOT NULL,
  user_alias VARCHAR(100) NOT NULL,
  slack_user_id VARCHAR(100),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. 通知ログ (Notification_Logs)

```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY,
  reservation_id UUID REFERENCES reservations(id),
  notification_type VARCHAR(50) NOT NULL, -- 'email', 'slack'
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'sent', 'failed', 'pending'
  message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や動作のことです。これらは人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。*

### プロパティ1: 在庫整合性保証
*任意の* 在庫操作において、利用可能在庫数は総在庫数を超えてはならず、予約による減算と返却による加算が正しく反映される
**検証対象: 要件3.1, 3.3, 16.3**

### プロパティ2: 予約と在庫の同期
*任意の* 予約確定操作において、在庫数の減算と予約レコードの作成がアトミックに実行され、データの整合性が保たれる
**検証対象: 要件3.1**

### プロパティ3: 通知配信の確実性
*任意の* 通知要求において、メール送信失敗時は最大3回まで再送され、Slack送信失敗時は代替手段が実行される
**検証対象: 要件6.3, 7.5**

### プロパティ4: 代替案提案の妥当性
*任意の* 在庫不足状況において、システムが提案する代替案は実際に利用可能な在庫を持つサイトまたは期間である
**検証対象: 要件1.2, 1.3**

### プロパティ5: 認証情報の自動設定
*任意の* Midway認証成功時において、認証済みAliasが自動的に入力欄に設定され、手動変更が防止される
**検証対象: 要件10.2, 10.3**

### プロパティ6: 設置完了による状態遷移
*任意の* 設置完了報告において、予約ステータスが正しく更新され、予約者への通知が即座に送信される
**検証対象: 要件13.2**

### プロパティ7: 返却による在庫復旧
*任意の* 返却報告において、該当機器の在庫数が即座に復旧され、新規予約が受付可能になる
**検証対象: 要件16.3, 16.4**

### プロパティ8: 遅延通知の継続性
*任意の* 返却遅延状況において、返却されるまで毎日催促通知が送信され続ける
**検証対象: 要件17.3**

### プロパティ9: 同時アクセス時の排他制御
*任意の* 同時予約要求において、在庫の整合性が保たれ、先着順で処理される
**検証対象: 要件3.3**

### プロパティ10: リマインダーの適時送信
*任意の* 予約において、予約開始日の前日に該当サイト担当者にリマインダーが送信される
**検証対象: 要件8.1**

## エラーハンドリング

### 1. 認証エラー

```javascript
// Midway認証失敗時の代替処理
try {
  const authResult = await midwayAuth.authenticate();
  return authResult;
} catch (error) {
  logger.warn('Midway authentication failed, falling back to manual validation');
  return fallbackAuth.validateAlias(userInput.alias);
}
```

### 2. 在庫不足エラー

```javascript
// 在庫不足時の代替案提案
if (availableInventory < requestedQuantity) {
  const alternatives = await inventoryService.findAlternatives({
    originalSite: request.site,
    startDate: request.startDate,
    endDate: request.endDate,
    equipment: request.equipment
  });
  
  return {
    success: false,
    error: 'INSUFFICIENT_INVENTORY',
    alternatives: alternatives
  };
}
```

### 3. 通知エラー

```javascript
// 通知送信失敗時の再試行とフォールバック
async function sendNotificationWithRetry(notification) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (notification.type === 'email') {
        await emailService.send(notification);
      } else if (notification.type === 'slack') {
        await slackService.send(notification);
      }
      return { success: true };
    } catch (error) {
      if (attempt === 3) {
        await notifyAdministrators(notification, error);
        return { success: false, error };
      }
      await delay(attempt * 1000); // 指数バックオフ
    }
  }
}
```

## テスト戦略

### 単体テスト
- 各コンポーネントの個別機能テスト
- モックを使用した外部サービス依存の分離
- エラーケースとエッジケースの検証

### プロパティベーステスト
- fast-check (JavaScript)を使用したプロパティベーステスト
- 各正確性プロパティを100回以上の反復でテスト
- ランダムな入力データでの動作検証

**プロパティテスト例:**
```javascript
// プロパティ1: 在庫整合性保証のテスト
fc.assert(fc.property(
  fc.record({
    site: fc.constantFrom('HND10', 'HND17', 'HND21'),
    equipmentType: fc.constantFrom('non_amazon_pc', 'amazon_pc', 'monitor'),
    initialStock: fc.integer(0, 100),
    reservationQuantity: fc.integer(1, 20)
  }),
  async (data) => {
    const inventory = await setupInventory(data.site, data.equipmentType, data.initialStock);
    const reservation = await createReservation(data.site, data.equipmentType, data.reservationQuantity);
    
    if (reservation.success) {
      const updatedInventory = await getInventory(data.site, data.equipmentType);
      return updatedInventory.available === data.initialStock - data.reservationQuantity;
    } else {
      const unchangedInventory = await getInventory(data.site, data.equipmentType);
      return unchangedInventory.available === data.initialStock;
    }
  }
));
```

### 統合テスト
- API エンドポイントのテスト
- データベース操作の検証
- 外部サービス連携のテスト

### エンドツーエンドテスト
- ユーザーシナリオベースのテスト
- ブラウザ自動化テスト (Playwright/Cypress)
- 実際のワークフローの検証