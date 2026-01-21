-- 在庫管理システム 初期データ投入
-- 作成日: 2024-12-22

-- 1. 初期在庫データ
INSERT INTO inventory (site, equipment_type, total_quantity, available_quantity, maintenance_quantity) VALUES
-- HND10サイト
('HND10', 'amazon_pc', 20, 20, 0),
('HND10', 'non_amazon_pc', 20, 20, 0),
('HND10', 'monitor', 10, 10, 0),

-- HND17サイト
('HND17', 'amazon_pc', 20, 20, 0),
('HND17', 'non_amazon_pc', 20, 20, 0),
('HND17', 'monitor', 10, 10, 0),

-- HND21サイト
('HND21', 'amazon_pc', 20, 20, 0),
('HND21', 'non_amazon_pc', 20, 20, 0),
('HND21', 'monitor', 10, 10, 0);

-- 2. 個別機器データ
-- HND10サイトの機器
INSERT INTO equipment_items (equipment_code, equipment_type, site, status, serial_number, model, purchase_date) VALUES
-- Amazon PC
('AL1', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-001', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL2', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-002', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL3', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-003', 'ThinkPad X1 Carbon', '2024-02-01'),
('AL4', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-004', 'ThinkPad X1 Carbon', '2024-02-01'),
('AL5', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-005', 'ThinkPad X1 Carbon', '2024-02-15'),

-- Non-Amazon PC
('NAL1', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-001', 'Dell Latitude 7420', '2024-01-20'),
('NAL2', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-002', 'Dell Latitude 7420', '2024-01-20'),
('NAL3', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-003', 'HP EliteBook 840', '2024-02-10'),

-- Monitor
('Monitor1', 'monitor', 'HND10', 'available', 'MON-HND10-001', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor2', 'monitor', 'HND10', 'available', 'MON-HND10-002', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor3', 'monitor', 'HND10', 'available', 'MON-HND10-003', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor4', 'monitor', 'HND10', 'available', 'MON-HND10-004', 'Dell U2720Q 27inch', '2024-01-25'),
('Monitor5', 'monitor', 'HND10', 'available', 'MON-HND10-005', 'Dell U2720Q 27inch', '2024-01-25'),
('Monitor6', 'monitor', 'HND10', 'available', 'MON-HND10-006', 'LG 27UP850 27inch', '2024-02-05'),
('Monitor7', 'monitor', 'HND10', 'available', 'MON-HND10-007', 'LG 27UP850 27inch', '2024-02-05'),
('Monitor8', 'monitor', 'HND10', 'available', 'MON-HND10-008', 'LG 27UP850 27inch', '2024-02-20');

-- HND17サイトの機器
INSERT INTO equipment_items (equipment_code, equipment_type, site, status, serial_number, model, purchase_date) VALUES
-- Amazon PC
('AL6', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-001', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL7', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-002', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL8', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-003', 'ThinkPad X1 Carbon', '2024-02-03'),
('AL9', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-004', 'ThinkPad X1 Carbon', '2024-02-03'),

-- Non-Amazon PC
('NAL4', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-001', 'Dell Latitude 7420', '2024-01-22'),
('NAL5', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-002', 'HP EliteBook 840', '2024-02-12'),

-- Monitor
('Monitor9', 'monitor', 'HND17', 'available', 'MON-HND17-001', 'Dell U2720Q 27inch', '2024-01-12'),
('Monitor10', 'monitor', 'HND17', 'available', 'MON-HND17-002', 'Dell U2720Q 27inch', '2024-01-12'),
('Monitor11', 'monitor', 'HND17', 'available', 'MON-HND17-003', 'LG 27UP850 27inch', '2024-01-27'),
('Monitor12', 'monitor', 'HND17', 'available', 'MON-HND17-004', 'LG 27UP850 27inch', '2024-01-27'),
('Monitor13', 'monitor', 'HND17', 'available', 'MON-HND17-005', 'LG 27UP850 27inch', '2024-02-07'),
('Monitor14', 'monitor', 'HND17', 'available', 'MON-HND17-006', 'LG 27UP850 27inch', '2024-02-07');

-- HND21サイトの機器
INSERT INTO equipment_items (equipment_code, equipment_type, site, status, serial_number, model, purchase_date) VALUES
-- Amazon PC
('AL10', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-001', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL11', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-002', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL12', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-003', 'ThinkPad X1 Carbon', '2024-01-30'),
('AL13', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-004', 'ThinkPad X1 Carbon', '2024-01-30'),
('AL14', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-005', 'ThinkPad X1 Carbon', '2024-02-14'),
('AL15', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-006', 'ThinkPad X1 Carbon', '2024-02-14'),

-- Non-Amazon PC
('NAL6', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-001', 'Dell Latitude 7420', '2024-01-24'),
('NAL7', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-002', 'Dell Latitude 7420', '2024-01-24'),
('NAL8', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-003', 'HP EliteBook 840', '2024-02-08'),
('NAL9', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-004', 'HP EliteBook 840', '2024-02-08'),

-- Monitor
('Monitor15', 'monitor', 'HND21', 'available', 'MON-HND21-001', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor16', 'monitor', 'HND21', 'available', 'MON-HND21-002', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor17', 'monitor', 'HND21', 'available', 'MON-HND21-003', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor18', 'monitor', 'HND21', 'available', 'MON-HND21-004', 'LG 27UP850 27inch', '2024-01-28'),
('Monitor19', 'monitor', 'HND21', 'available', 'MON-HND21-005', 'LG 27UP850 27inch', '2024-01-28'),
('Monitor20', 'monitor', 'HND21', 'available', 'MON-HND21-006', 'LG 27UP850 27inch', '2024-01-28'),
('Monitor21', 'monitor', 'HND21', 'available', 'MON-HND21-007', 'LG 27UP850 27inch', '2024-02-09'),
('Monitor22', 'monitor', 'HND21', 'available', 'MON-HND21-008', 'LG 27UP850 27inch', '2024-02-09'),
('Monitor23', 'monitor', 'HND21', 'available', 'MON-HND21-009', 'LG 27UP850 27inch', '2024-02-21'),
('Monitor24', 'monitor', 'HND21', 'available', 'MON-HND21-010', 'LG 27UP850 27inch', '2024-02-21');

-- 3. サンプルサイト担当者データ
INSERT INTO site_managers (site, user_alias, slack_user_id, email, is_active) VALUES
('HND10', 'itadmin1', 'U01234567', 'itadmin1@company.com', true),
('HND10', 'itadmin2', 'U01234568', 'itadmin2@company.com', true),
('HND17', 'itadmin3', 'U01234569', 'itadmin3@company.com', true),
('HND21', 'itadmin4', 'U01234570', 'itadmin4@company.com', true),
('HND21', 'itadmin5', 'U01234571', 'itadmin5@company.com', true);