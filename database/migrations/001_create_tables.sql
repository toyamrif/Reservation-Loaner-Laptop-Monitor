-- 在庫管理システム データベーススキーマ
-- 作成日: 2024-12-22

-- UUIDエクステンションを有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 予約テーブル
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_alias VARCHAR(100) NOT NULL,
  pickup_site VARCHAR(20) NOT NULL CHECK (pickup_site IN ('HND10', 'HND17', 'HND21')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'setup_complete', 'returned', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 制約
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 2. 予約機器テーブル
CREATE TABLE reservation_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('amazon_pc', 'non_amazon_pc', 'monitor')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 在庫テーブル
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site VARCHAR(20) NOT NULL CHECK (site IN ('HND10', 'HND17', 'HND21')),
  equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('amazon_pc', 'non_amazon_pc', 'monitor')),
  total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
  available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
  maintenance_quantity INTEGER DEFAULT 0 CHECK (maintenance_quantity >= 0),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 制約
  CONSTRAINT valid_inventory_quantities CHECK (available_quantity + maintenance_quantity <= total_quantity),
  UNIQUE(site, equipment_type)
);

-- 4. 個別機器テーブル（新規追加）
CREATE TABLE equipment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_code VARCHAR(20) UNIQUE NOT NULL, -- AL1, NAL1, Monitor1 など
  equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('amazon_pc', 'non_amazon_pc', 'monitor')),
  site VARCHAR(20) NOT NULL CHECK (site IN ('HND10', 'HND17', 'HND21')),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  current_user_alias VARCHAR(100), -- 現在の使用者
  current_reservation_id UUID REFERENCES reservations(id),
  serial_number VARCHAR(100),
  model VARCHAR(100),
  purchase_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. 機器使用履歴テーブル（新規追加）
CREATE TABLE equipment_usage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_alias VARCHAR(100) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. サイト担当者テーブル
CREATE TABLE site_managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site VARCHAR(20) NOT NULL CHECK (site IN ('HND10', 'HND17', 'HND21')),
  user_alias VARCHAR(100) NOT NULL,
  slack_user_id VARCHAR(100),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. 通知ログテーブル
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email', 'slack')),
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_reservations_user_alias ON reservations(user_alias);
CREATE INDEX idx_reservations_pickup_site ON reservations(pickup_site);
CREATE INDEX idx_reservations_start_date ON reservations(start_date);
CREATE INDEX idx_reservations_status ON reservations(status);

CREATE INDEX idx_reservation_equipment_reservation_id ON reservation_equipment(reservation_id);
CREATE INDEX idx_reservation_equipment_type ON reservation_equipment(equipment_type);

CREATE INDEX idx_inventory_site_equipment ON inventory(site, equipment_type);

CREATE INDEX idx_equipment_items_code ON equipment_items(equipment_code);
CREATE INDEX idx_equipment_items_site ON equipment_items(site);
CREATE INDEX idx_equipment_items_status ON equipment_items(status);
CREATE INDEX idx_equipment_items_current_user ON equipment_items(current_user_alias);

CREATE INDEX idx_equipment_usage_equipment_id ON equipment_usage_history(equipment_id);
CREATE INDEX idx_equipment_usage_reservation_id ON equipment_usage_history(reservation_id);
CREATE INDEX idx_equipment_usage_user_alias ON equipment_usage_history(user_alias);
CREATE INDEX idx_equipment_usage_start_date ON equipment_usage_history(start_date);

CREATE INDEX idx_site_managers_site ON site_managers(site);
CREATE INDEX idx_site_managers_active ON site_managers(is_active);

CREATE INDEX idx_notification_logs_reservation_id ON notification_logs(reservation_id);
CREATE INDEX idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);

-- トリガー関数: updated_atを自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー作成
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_items_updated_at BEFORE UPDATE ON equipment_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();