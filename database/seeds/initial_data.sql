-- 在庫管理システム 初期データ投入
-- 作成日: 2024-12-22
-- 更新日: 2025-01-23

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
-- Amazon PC (AL1-AL20)
('AL1', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-001', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL2', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-002', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL3', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-003', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL4', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-004', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL5', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-005', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL6', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-006', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL7', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-007', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL8', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-008', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL9', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-009', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL10', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-010', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL11', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-011', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL12', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-012', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL13', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-013', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL14', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-014', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL15', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-015', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL16', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-016', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL17', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-017', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL18', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-018', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL19', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-019', 'ThinkPad X1 Carbon', '2024-01-15'),
('AL20', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-020', 'ThinkPad X1 Carbon', '2024-01-15'),

-- Non-Amazon PC (NAL1-NAL20)
('NAL1', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-001', 'Dell Latitude 7420', '2024-01-20'),
('NAL2', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-002', 'Dell Latitude 7420', '2024-01-20'),
('NAL3', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-003', 'Dell Latitude 7420', '2024-01-20'),
('NAL4', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-004', 'Dell Latitude 7420', '2024-01-20'),
('NAL5', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-005', 'Dell Latitude 7420', '2024-01-20'),
('NAL6', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-006', 'Dell Latitude 7420', '2024-01-20'),
('NAL7', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-007', 'Dell Latitude 7420', '2024-01-20'),
('NAL8', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-008', 'Dell Latitude 7420', '2024-01-20'),
('NAL9', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-009', 'Dell Latitude 7420', '2024-01-20'),
('NAL10', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-010', 'Dell Latitude 7420', '2024-01-20'),
('NAL11', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-011', 'HP EliteBook 840', '2024-01-20'),
('NAL12', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-012', 'HP EliteBook 840', '2024-01-20'),
('NAL13', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-013', 'HP EliteBook 840', '2024-01-20'),
('NAL14', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-014', 'HP EliteBook 840', '2024-01-20'),
('NAL15', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-015', 'HP EliteBook 840', '2024-01-20'),
('NAL16', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-016', 'HP EliteBook 840', '2024-01-20'),
('NAL17', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-017', 'HP EliteBook 840', '2024-01-20'),
('NAL18', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-018', 'HP EliteBook 840', '2024-01-20'),
('NAL19', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-019', 'HP EliteBook 840', '2024-01-20'),
('NAL20', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-020', 'HP EliteBook 840', '2024-01-20'),

-- Monitor (Monitor1-Monitor10)
('Monitor1', 'monitor', 'HND10', 'available', 'MON-HND10-001', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor2', 'monitor', 'HND10', 'available', 'MON-HND10-002', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor3', 'monitor', 'HND10', 'available', 'MON-HND10-003', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor4', 'monitor', 'HND10', 'available', 'MON-HND10-004', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor5', 'monitor', 'HND10', 'available', 'MON-HND10-005', 'Dell U2720Q 27inch', '2024-01-10'),
('Monitor6', 'monitor', 'HND10', 'available', 'MON-HND10-006', 'LG 27UP850 27inch', '2024-01-10'),
('Monitor7', 'monitor', 'HND10', 'available', 'MON-HND10-007', 'LG 27UP850 27inch', '2024-01-10'),
('Monitor8', 'monitor', 'HND10', 'available', 'MON-HND10-008', 'LG 27UP850 27inch', '2024-01-10'),
('Monitor9', 'monitor', 'HND10', 'available', 'MON-HND10-009', 'LG 27UP850 27inch', '2024-01-10'),
('Monitor10', 'monitor', 'HND10', 'available', 'MON-HND10-010', 'LG 27UP850 27inch', '2024-01-10');


-- HND17サイトの機器
INSERT INTO equipment_items (equipment_code, equipment_type, site, status, serial_number, model, purchase_date) VALUES
-- Amazon PC (AL1-AL20)
('AL1', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-001', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL2', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-002', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL3', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-003', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL4', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-004', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL5', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-005', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL6', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-006', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL7', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-007', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL8', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-008', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL9', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-009', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL10', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-010', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL11', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-011', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL12', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-012', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL13', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-013', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL14', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-014', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL15', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-015', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL16', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-016', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL17', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-017', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL18', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-018', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL19', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-019', 'ThinkPad X1 Carbon', '2024-01-18'),
('AL20', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-020', 'ThinkPad X1 Carbon', '2024-01-18'),

-- Non-Amazon PC (NAL1-NAL20)
('NAL1', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-001', 'Dell Latitude 7420', '2024-01-22'),
('NAL2', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-002', 'Dell Latitude 7420', '2024-01-22'),
('NAL3', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-003', 'Dell Latitude 7420', '2024-01-22'),
('NAL4', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-004', 'Dell Latitude 7420', '2024-01-22'),
('NAL5', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-005', 'Dell Latitude 7420', '2024-01-22'),
('NAL6', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-006', 'Dell Latitude 7420', '2024-01-22'),
('NAL7', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-007', 'Dell Latitude 7420', '2024-01-22'),
('NAL8', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-008', 'Dell Latitude 7420', '2024-01-22'),
('NAL9', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-009', 'Dell Latitude 7420', '2024-01-22'),
('NAL10', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-010', 'Dell Latitude 7420', '2024-01-22'),
('NAL11', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-011', 'HP EliteBook 840', '2024-01-22'),
('NAL12', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-012', 'HP EliteBook 840', '2024-01-22'),
('NAL13', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-013', 'HP EliteBook 840', '2024-01-22'),
('NAL14', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-014', 'HP EliteBook 840', '2024-01-22'),
('NAL15', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-015', 'HP EliteBook 840', '2024-01-22'),
('NAL16', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-016', 'HP EliteBook 840', '2024-01-22'),
('NAL17', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-017', 'HP EliteBook 840', '2024-01-22'),
('NAL18', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-018', 'HP EliteBook 840', '2024-01-22'),
('NAL19', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-019', 'HP EliteBook 840', '2024-01-22'),
('NAL20', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-020', 'HP EliteBook 840', '2024-01-22'),

-- Monitor (Monitor1-Monitor10)
('Monitor1', 'monitor', 'HND17', 'available', 'MON-HND17-001', 'Dell U2720Q 27inch', '2024-01-12'),
('Monitor2', 'monitor', 'HND17', 'available', 'MON-HND17-002', 'Dell U2720Q 27inch', '2024-01-12'),
('Monitor3', 'monitor', 'HND17', 'available', 'MON-HND17-003', 'Dell U2720Q 27inch', '2024-01-12'),
('Monitor4', 'monitor', 'HND17', 'available', 'MON-HND17-004', 'Dell U2720Q 27inch', '2024-01-12'),
('Monitor5', 'monitor', 'HND17', 'available', 'MON-HND17-005', 'Dell U2720Q 27inch', '2024-01-12'),
('Monitor6', 'monitor', 'HND17', 'available', 'MON-HND17-006', 'LG 27UP850 27inch', '2024-01-12'),
('Monitor7', 'monitor', 'HND17', 'available', 'MON-HND17-007', 'LG 27UP850 27inch', '2024-01-12'),
('Monitor8', 'monitor', 'HND17', 'available', 'MON-HND17-008', 'LG 27UP850 27inch', '2024-01-12'),
('Monitor9', 'monitor', 'HND17', 'available', 'MON-HND17-009', 'LG 27UP850 27inch', '2024-01-12'),
('Monitor10', 'monitor', 'HND17', 'available', 'MON-HND17-010', 'LG 27UP850 27inch', '2024-01-12');

-- HND21サイトの機器
INSERT INTO equipment_items (equipment_code, equipment_type, site, status, serial_number, model, purchase_date) VALUES
-- Amazon PC (AL1-AL20)
('AL1', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-001', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL2', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-002', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL3', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-003', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL4', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-004', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL5', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-005', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL6', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-006', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL7', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-007', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL8', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-008', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL9', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-009', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL10', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-010', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL11', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-011', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL12', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-012', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL13', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-013', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL14', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-014', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL15', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-015', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL16', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-016', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL17', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-017', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL18', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-018', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL19', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-019', 'ThinkPad X1 Carbon', '2024-01-16'),
('AL20', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-020', 'ThinkPad X1 Carbon', '2024-01-16'),

-- Non-Amazon PC (NAL1-NAL20)
('NAL1', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-001', 'Dell Latitude 7420', '2024-01-24'),
('NAL2', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-002', 'Dell Latitude 7420', '2024-01-24'),
('NAL3', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-003', 'Dell Latitude 7420', '2024-01-24'),
('NAL4', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-004', 'Dell Latitude 7420', '2024-01-24'),
('NAL5', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-005', 'Dell Latitude 7420', '2024-01-24'),
('NAL6', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-006', 'Dell Latitude 7420', '2024-01-24'),
('NAL7', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-007', 'Dell Latitude 7420', '2024-01-24'),
('NAL8', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-008', 'Dell Latitude 7420', '2024-01-24'),
('NAL9', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-009', 'Dell Latitude 7420', '2024-01-24'),
('NAL10', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-010', 'Dell Latitude 7420', '2024-01-24'),
('NAL11', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-011', 'HP EliteBook 840', '2024-01-24'),
('NAL12', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-012', 'HP EliteBook 840', '2024-01-24'),
('NAL13', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-013', 'HP EliteBook 840', '2024-01-24'),
('NAL14', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-014', 'HP EliteBook 840', '2024-01-24'),
('NAL15', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-015', 'HP EliteBook 840', '2024-01-24'),
('NAL16', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-016', 'HP EliteBook 840', '2024-01-24'),
('NAL17', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-017', 'HP EliteBook 840', '2024-01-24'),
('NAL18', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-018', 'HP EliteBook 840', '2024-01-24'),
('NAL19', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-019', 'HP EliteBook 840', '2024-01-24'),
('NAL20', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-020', 'HP EliteBook 840', '2024-01-24'),

-- Monitor (Monitor1-Monitor10)
('Monitor1', 'monitor', 'HND21', 'available', 'MON-HND21-001', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor2', 'monitor', 'HND21', 'available', 'MON-HND21-002', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor3', 'monitor', 'HND21', 'available', 'MON-HND21-003', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor4', 'monitor', 'HND21', 'available', 'MON-HND21-004', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor5', 'monitor', 'HND21', 'available', 'MON-HND21-005', 'Dell U2720Q 27inch', '2024-01-14'),
('Monitor6', 'monitor', 'HND21', 'available', 'MON-HND21-006', 'LG 27UP850 27inch', '2024-01-14'),
('Monitor7', 'monitor', 'HND21', 'available', 'MON-HND21-007', 'LG 27UP850 27inch', '2024-01-14'),
('Monitor8', 'monitor', 'HND21', 'available', 'MON-HND21-008', 'LG 27UP850 27inch', '2024-01-14'),
('Monitor9', 'monitor', 'HND21', 'available', 'MON-HND21-009', 'LG 27UP850 27inch', '2024-01-14'),
('Monitor10', 'monitor', 'HND21', 'available', 'MON-HND21-010', 'LG 27UP850 27inch', '2024-01-14');

-- 3. サンプルサイト担当者データ
INSERT INTO site_managers (site, user_alias, slack_user_id, email, is_active) VALUES
('HND10', 'itadmin1', 'U01234567', 'itadmin1@company.com', true),
('HND10', 'itadmin2', 'U01234568', 'itadmin2@company.com', true),
('HND17', 'itadmin3', 'U01234569', 'itadmin3@company.com', true),
('HND21', 'itadmin4', 'U01234570', 'itadmin4@company.com', true),
('HND21', 'itadmin5', 'U01234571', 'itadmin5@company.com', true);
