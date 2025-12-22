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
}

module.exports = new Reservation();