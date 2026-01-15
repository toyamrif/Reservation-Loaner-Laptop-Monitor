/**
 * 予約モデル
 * 予約データの管理と操作
 */

const BaseModel = require('./BaseModel');
const { query, transaction } = require('../database/connection');

class Reservation extends BaseModel {
  constructor() {
    super('reservations');
  }

  // ユーザーの予約一覧取得
  async findByUserAlias(userAlias) {
    const result = await query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'equipment_type', re.equipment_type,
                  'quantity', re.quantity
                )
              ) as equipment
       FROM reservations r
       LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
       WHERE r.user_alias = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [userAlias]
    );
    return result.rows;
  }

  // サイト別予約一覧取得
  async findBySite(site, startDate = null, endDate = null) {
    let queryText = `
      SELECT r.*, 
             json_agg(
               json_build_object(
                 'equipment_type', re.equipment_type,
                 'quantity', re.quantity
               )
             ) as equipment
      FROM reservations r
      LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
      WHERE r.pickup_site = $1
    `;
    const params = [site];

    if (startDate) {
      queryText += ` AND r.start_date >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      queryText += ` AND r.end_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryText += ` GROUP BY r.id ORDER BY r.start_date ASC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 期間内の予約取得
  async findByDateRange(startDate, endDate) {
    const result = await query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'equipment_type', re.equipment_type,
                  'quantity', re.quantity
                )
              ) as equipment
       FROM reservations r
       LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
       WHERE (r.start_date <= $2 AND r.end_date >= $1)
         AND r.status NOT IN ('cancelled')
       GROUP BY r.id
       ORDER BY r.start_date ASC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  // 予約作成（機器情報含む）
  async createWithEquipment(reservationData, equipmentList) {
    return await transaction(async (client) => {
      // 予約レコード作成
      const reservationResult = await client.query(
        `INSERT INTO reservations (user_alias, pickup_site, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          reservationData.user_alias,
          reservationData.pickup_site,
          reservationData.start_date,
          reservationData.end_date,
          reservationData.status || 'pending'
        ]
      );

      const reservation = reservationResult.rows[0];

      // 機器情報追加
      for (const equipment of equipmentList) {
        await client.query(
          `INSERT INTO reservation_equipment (reservation_id, equipment_type, quantity)
           VALUES ($1, $2, $3)`,
          [reservation.id, equipment.equipment_type, equipment.quantity]
        );
      }

      return reservation;
    });
  }

  // 予約ステータス更新
  async updateStatus(id, status) {
    const result = await query(
      `UPDATE reservations 
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );
    return result.rows[0];
  }

  // 返却期限切れの予約取得
  async findOverdueReservations() {
    const result = await query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'equipment_type', re.equipment_type,
                  'quantity', re.quantity
                )
              ) as equipment
       FROM reservations r
       LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
       WHERE r.end_date < CURRENT_DATE
         AND r.status IN ('confirmed', 'setup_complete')
       GROUP BY r.id
       ORDER BY r.end_date ASC`
    );
    return result.rows;
  }

  // 設置完了待ちの予約取得
  async findPendingSetup(site = null) {
    let queryText = `
      SELECT r.*, 
             json_agg(
               json_build_object(
                 'equipment_type', re.equipment_type,
                 'quantity', re.quantity
               )
             ) as equipment
      FROM reservations r
      LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
      WHERE r.status = 'confirmed'
        AND r.start_date <= CURRENT_DATE
    `;
    const params = [];

    if (site) {
      queryText += ` AND r.pickup_site = $1`;
      params.push(site);
    }

    queryText += ` GROUP BY r.id ORDER BY r.start_date ASC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 予約キャンセル（在庫復旧含む）
  async cancel(id) {
    return await transaction(async (client) => {
      // 予約情報取得
      const reservationResult = await client.query(
        `SELECT r.*, re.equipment_type, re.quantity
         FROM reservations r
         JOIN reservation_equipment re ON r.id = re.reservation_id
         WHERE r.id = $1 AND r.status != 'cancelled'`,
        [id]
      );

      if (reservationResult.rows.length === 0) {
        throw new Error('Reservation not found or already cancelled');
      }

      const reservation = reservationResult.rows[0];

      // 予約ステータスを「キャンセル」に更新
      await client.query(
        `UPDATE reservations 
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      // 在庫復旧は行わない
      // 理由: getAvailableQuantity()が予約状況を動的に計算するため、
      // キャンセルされた予約は自動的に在庫計算から除外される

      // 機器割り当てがある場合は解除
      await client.query(
        `UPDATE equipment_items 
         SET status = 'available', 
             current_user_alias = NULL,
             updated_at = NOW()
         WHERE id IN (
           SELECT equipment_id 
           FROM equipment_usage_history 
           WHERE reservation_id = $1 AND end_date IS NULL
         )`,
        [id]
      );

      // 使用履歴を終了
      await client.query(
        `UPDATE equipment_usage_history 
         SET end_date = NOW()
         WHERE reservation_id = $1 AND end_date IS NULL`,
        [id]
      );

      return { id, status: 'cancelled' };
    });
  }
}

module.exports = new Reservation();