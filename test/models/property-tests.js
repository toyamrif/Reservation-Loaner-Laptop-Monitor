/**
 * データモデルのプロパティベーステスト
 * fast-checkを使用してモデルの正確性プロパティを検証
 */

const fc = require('fast-check');
const { Reservation, EquipmentItem, Inventory } = require('../../src/models');
const { query, transaction } = require('../../src/database/connection');

describe('データモデル プロパティテスト', () => {
  beforeAll(async () => {
    // テスト用データベースの初期化
    await setupTestDatabase();
  });

  afterAll(async () => {
    // テスト後のクリーンアップ
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // 各テスト前にデータをクリア
    await clearTestData();
  });

  /**
   * プロパティ3: 予約・キャンセル往復の一貫性
   * 検証対象: 要件 3.1, 3.2
   * 
   * 任意の予約作成とキャンセルの組み合わせにおいて、
   * 在庫数が元の状態に戻ることを検証
   */
  describe('プロパティ3: 予約・キャンセル往復の一貫性', () => {
    test('予約作成→キャンセルで在庫が元に戻る', async () => {
      await fc.assert(
        fc.asyncProperty(
          // テストデータ生成
          fc.record({
            site: fc.constantFrom('HND10', 'HND17', 'HND21'),
            equipmentType: fc.constantFrom('amazon_pc', 'non_amazon_pc', 'monitor'),
            initialStock: fc.integer({ min: 5, max: 20 }),
            reservationQuantity: fc.integer({ min: 1, max: 5 }),
            userAlias: fc.string({ minLength: 3, maxLength: 10 }).map(s => `user_${s}`),
            startDate: fc.date({ min: new Date('2024-12-25'), max: new Date('2025-01-31') }),
            duration: fc.integer({ min: 1, max: 7 })
          }),
          async (data) => {
            // 初期在庫設定
            await setupInventory(data.site, data.equipmentType, data.initialStock);
            const initialInventory = await Inventory.getAvailableQuantity(
              data.site, 
              data.equipmentType, 
              data.startDate, 
              new Date(data.startDate.getTime() + data.duration * 24 * 60 * 60 * 1000)
            );

            // 予約作成
            const reservation = await Reservation.createWithEquipment(
              {
                user_alias: data.userAlias,
                pickup_site: data.site,
                start_date: data.startDate.toISOString().split('T')[0],
                end_date: new Date(data.startDate.getTime() + data.duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              },
              [{ equipment_type: data.equipmentType, quantity: data.reservationQuantity }]
            );

            if (reservation && data.reservationQuantity <= initialInventory) {
              // 予約成功の場合、在庫が減っているはず
              const afterReservationInventory = await Inventory.getAvailableQuantity(
                data.site, 
                data.equipmentType, 
                data.startDate, 
                new Date(data.startDate.getTime() + data.duration * 24 * 60 * 60 * 1000)
              );

              // 予約をキャンセル
              await Reservation.cancel(reservation.id);

              // キャンセル後の在庫確認
              const afterCancelInventory = await Inventory.getAvailableQuantity(
                data.site, 
                data.equipmentType, 
                data.startDate, 
                new Date(data.startDate.getTime() + data.duration * 24 * 60 * 60 * 1000)
              );

              // 在庫が元に戻っているかチェック
              return afterCancelInventory === initialInventory;
            } else {
              // 予約失敗の場合、在庫は変わらないはず
              const unchangedInventory = await Inventory.getAvailableQuantity(
                data.site, 
                data.equipmentType, 
                data.startDate, 
                new Date(data.startDate.getTime() + data.duration * 24 * 60 * 60 * 1000)
              );
              return unchangedInventory === initialInventory;
            }
          }
        ),
        { numRuns: 50, timeout: 10000 }
      );
    });

    test('複数予約の同時キャンセルで在庫整合性が保たれる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            site: fc.constantFrom('HND10', 'HND17', 'HND21'),
            equipmentType: fc.constantFrom('amazon_pc', 'non_amazon_pc', 'monitor'),
            initialStock: fc.integer({ min: 10, max: 30 }),
            reservations: fc.array(
              fc.record({
                quantity: fc.integer({ min: 1, max: 3 }),
                userAlias: fc.string({ minLength: 3, maxLength: 10 }).map(s => `user_${s}`),
                startDate: fc.date({ min: new Date('2024-12-25'), max: new Date('2025-01-31') }),
                duration: fc.integer({ min: 1, max: 5 })
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          async (data) => {
            // 初期在庫設定
            await setupInventory(data.site, data.equipmentType, data.initialStock);
            const initialInventory = await Inventory.getAvailableQuantity(
              data.site, 
              data.equipmentType, 
              new Date('2024-12-25'), 
              new Date('2025-01-31')
            );

            const createdReservations = [];
            let totalReservedQuantity = 0;

            // 複数予約作成
            for (const reservationData of data.reservations) {
              const endDate = new Date(reservationData.startDate.getTime() + reservationData.duration * 24 * 60 * 60 * 1000);
              
              const reservation = await Reservation.createWithEquipment(
                {
                  user_alias: reservationData.userAlias,
                  pickup_site: data.site,
                  start_date: reservationData.startDate.toISOString().split('T')[0],
                  end_date: endDate.toISOString().split('T')[0]
                },
                [{ equipment_type: data.equipmentType, quantity: reservationData.quantity }]
              );

              if (reservation) {
                createdReservations.push(reservation);
                totalReservedQuantity += reservationData.quantity;
              }
            }

            // 全予約をキャンセル
            for (const reservation of createdReservations) {
              await Reservation.cancel(reservation.id);
            }

            // 最終在庫確認
            const finalInventory = await Inventory.getAvailableQuantity(
              data.site, 
              data.equipmentType, 
              new Date('2024-12-25'), 
              new Date('2025-01-31')
            );

            // 在庫が初期状態に戻っているかチェック
            return finalInventory === initialInventory;
          }
        ),
        { numRuns: 30, timeout: 15000 }
      );
    });
  });

  /**
   * 個別機器管理のプロパティテスト
   * 機器割り当てと返却の整合性を検証
   */
  describe('個別機器管理の整合性', () => {
    test('機器割り当て→返却で機器ステータスが正しく更新される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            site: fc.constantFrom('HND10', 'HND17', 'HND21'),
            equipmentType: fc.constantFrom('amazon_pc', 'non_amazon_pc', 'monitor'),
            userAlias: fc.string({ minLength: 3, maxLength: 10 }).map(s => `user_${s}`)
          }),
          async (data) => {
            // 利用可能な機器を取得
            const availableEquipment = await EquipmentItem.findAvailable(
              data.site, 
              data.equipmentType, 
              1
            );

            if (availableEquipment.length === 0) {
              // 利用可能な機器がない場合はテストをスキップ
              return true;
            }

            const equipment = availableEquipment[0];
            const initialStatus = equipment.status;

            // 予約作成（簡易版）
            const reservation = await Reservation.create({
              user_alias: data.userAlias,
              pickup_site: data.site,
              start_date: '2024-12-25',
              end_date: '2024-12-27',
              status: 'confirmed'
            });

            // 機器割り当て
            const assignedEquipment = await EquipmentItem.assignToReservation(
              equipment.id,
              reservation.id,
              data.userAlias
            );

            // 割り当て後のステータス確認
            const afterAssignStatus = assignedEquipment.status;
            const afterAssignUser = assignedEquipment.current_user_alias;

            // 機器返却
            const returnedEquipment = await EquipmentItem.returnFromReservation(equipment.id);

            // 返却後のステータス確認
            const afterReturnStatus = returnedEquipment.status;
            const afterReturnUser = returnedEquipment.current_user_alias;

            // 検証
            return (
              initialStatus === 'available' &&
              afterAssignStatus === 'in_use' &&
              afterAssignUser === data.userAlias &&
              afterReturnStatus === 'available' &&
              afterReturnUser === null
            );
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });
  });
});

// テストヘルパー関数
async function setupTestDatabase() {
  // テスト用データベースの初期化
  // 実際の実装では、テスト専用のデータベースを使用
}

async function cleanupTestDatabase() {
  // テスト後のクリーンアップ
}

async function clearTestData() {
  // 各テスト前のデータクリア
  await query('DELETE FROM equipment_usage_history');
  await query('DELETE FROM reservation_equipment');
  await query('DELETE FROM reservations');
  await query('DELETE FROM equipment_items');
  await query('DELETE FROM inventory');
}

async function setupInventory(site, equipmentType, quantity) {
  // テスト用在庫データの設定
  await query(
    `INSERT INTO inventory (site, equipment_type, total_quantity, available_quantity)
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (site, equipment_type) 
     DO UPDATE SET 
       total_quantity = $3, 
       available_quantity = $3`,
    [site, equipmentType, quantity]
  );

  // 個別機器データも作成
  for (let i = 1; i <= quantity; i++) {
    const equipmentCode = await generateTestEquipmentCode(equipmentType, i);
    await query(
      `INSERT INTO equipment_items 
       (equipment_code, equipment_type, site, status, model, serial_number)
       VALUES ($1, $2, $3, 'available', 'Test Model', $4)
       ON CONFLICT (equipment_code) DO NOTHING`,
      [equipmentCode, equipmentType, site, `TEST${i.toString().padStart(3, '0')}`]
    );
  }
}

function generateTestEquipmentCode(equipmentType, index) {
  switch (equipmentType) {
    case 'amazon_pc':
      return `AL${index}`;
    case 'non_amazon_pc':
      return `NAL${index}`;
    case 'monitor':
      return `Monitor${index}`;
    default:
      return `TEST${index}`;
  }
}