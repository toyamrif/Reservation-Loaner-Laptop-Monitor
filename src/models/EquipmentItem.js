/**
 * 個別機器モデル
 * 個別機器の管理と操作（AL1、NAL1、Monitor1など）
 */

const BaseModel = require('./BaseModel');
const { query, transaction } = require('../database/connection');

class EquipmentItem extends BaseModel {
  constructor() {
    super('equipment_items');
  }

  // 機器コードによる検索
  async findByCode(equipmentCode) {
    const result = await query(
      `SELECT * FROM equipment_items WHERE equipment_code = $1`,
      [equipmentCode]
    );
    return result.rows[0] || null;
  }

  // サイト別機器一覧取得
  async findBySite(site, status = null) {
    let queryText = `SELECT * FROM equipment_items WHERE site = $1`;
    const params = [site];

    if (status) {
      queryText += ` AND status = $2`;
      params.push(status);
    }

    queryText += ` ORDER BY equipment_code ASC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 機器タイプ別一覧取得
  async findByType(equipmentType, site = null, status = null) {
    let queryText = `SELECT * FROM equipment_items WHERE equipment_type = $1`;
    const params = [equipmentType];

    if (site) {
      queryText += ` AND site = $${params.length + 1}`;
      params.push(site);
    }

    if (status) {
      queryText += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ` ORDER BY equipment_code ASC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 利用可能な機器取得
  async findAvailable(site, equipmentType, quantity = 1) {
    const result = await query(
      `SELECT * FROM equipment_items 
       WHERE site = $1 
         AND equipment_type = $2 
         AND status = 'available'
       ORDER BY equipment_code ASC
       LIMIT $3`,
      [site, equipmentType, quantity]
    );
    return result.rows;
  }

  // 使用中機器一覧取得
  async findInUse(site = null) {
    let queryText = `
      SELECT ei.*, 
             r.user_alias,
             r.start_date,
             r.end_date,
             CASE 
               WHEN r.end_date < CURRENT_DATE THEN 'overdue'
               ELSE 'in_use'
             END as usage_status
      FROM equipment_items ei
      LEFT JOIN reservations r ON ei.current_reservation_id = r.id
      WHERE ei.status = 'in_use'
    `;
    const params = [];

    if (site) {
      queryText += ` AND ei.site = $1`;
      params.push(site);
    }

    queryText += ` ORDER BY ei.equipment_code ASC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 機器割り当て
  async assignToReservation(equipmentId, reservationId, userAlias) {
    return await transaction(async (client) => {
      // 機器ステータス更新
      const equipmentResult = await client.query(
        `UPDATE equipment_items 
         SET status = 'in_use', 
             current_user_alias = $2,
             current_reservation_id = $3,
             updated_at = NOW()
         WHERE id = $1 AND status = 'available'
         RETURNING *`,
        [equipmentId, userAlias, reservationId]
      );

      if (equipmentResult.rows.length === 0) {
        throw new Error('Equipment is not available for assignment');
      }

      // 使用履歴記録
      await client.query(
        `INSERT INTO equipment_usage_history 
         (equipment_id, reservation_id, user_alias, start_date, status)
         VALUES ($1, $2, $3, NOW(), 'active')`,
        [equipmentId, reservationId, userAlias]
      );

      return equipmentResult.rows[0];
    });
  }

  // 機器返却
  async returnFromReservation(equipmentId) {
    return await transaction(async (client) => {
      // 機器ステータス更新
      const equipmentResult = await client.query(
        `UPDATE equipment_items 
         SET status = 'available', 
             current_user_alias = NULL,
             current_reservation_id = NULL,
             updated_at = NOW()
         WHERE id = $1 AND status = 'in_use'
         RETURNING *`,
        [equipmentId]
      );

      if (equipmentResult.rows.length === 0) {
        throw new Error('Equipment is not currently in use');
      }

      // 使用履歴更新
      await client.query(
        `UPDATE equipment_usage_history 
         SET end_date = NOW(), status = 'returned'
         WHERE equipment_id = $1 AND status = 'active'`,
        [equipmentId]
      );

      return equipmentResult.rows[0];
    });
  }

  // 機器の使用履歴取得
  async getUsageHistory(equipmentId) {
    const result = await query(
      `SELECT euh.*, r.pickup_site
       FROM equipment_usage_history euh
       LEFT JOIN reservations r ON euh.reservation_id = r.id
       WHERE euh.equipment_id = $1
       ORDER BY euh.start_date DESC`,
      [equipmentId]
    );
    return result.rows;
  }

  // ユーザーの使用履歴取得
  async getUserUsageHistory(userAlias) {
    const result = await query(
      `SELECT euh.*, ei.equipment_code, ei.equipment_type, ei.site
       FROM equipment_usage_history euh
       JOIN equipment_items ei ON euh.equipment_id = ei.id
       WHERE euh.user_alias = $1
       ORDER BY euh.start_date DESC`,
      [userAlias]
    );
    return result.rows;
  }

  // 次の機器コード生成
  async generateNextCode(equipmentType, site) {
    let prefix;
    switch (equipmentType) {
      case 'amazon_pc':
        prefix = 'AL';
        break;
      case 'non_amazon_pc':
        prefix = 'NAL';
        break;
      case 'monitor':
        prefix = 'Monitor';
        break;
      default:
        throw new Error('Invalid equipment type');
    }

    if (equipmentType === 'monitor') {
      // Monitorの場合は数字のみ
      const result = await query(
        `SELECT equipment_code FROM equipment_items 
         WHERE equipment_type = $1 
         ORDER BY CAST(SUBSTRING(equipment_code FROM 8) AS INTEGER) DESC 
         LIMIT 1`,
        [equipmentType]
      );

      if (result.rows.length === 0) {
        return 'Monitor1';
      }

      const lastCode = result.rows[0].equipment_code;
      const lastNumber = parseInt(lastCode.substring(7));
      return `Monitor${lastNumber + 1}`;
    } else {
      // AL、NALの場合
      const result = await query(
        `SELECT equipment_code FROM equipment_items 
         WHERE equipment_type = $1 
         ORDER BY CAST(SUBSTRING(equipment_code FROM ${prefix.length + 1}) AS INTEGER) DESC 
         LIMIT 1`,
        [equipmentType]
      );

      if (result.rows.length === 0) {
        return `${prefix}1`;
      }

      const lastCode = result.rows[0].equipment_code;
      const lastNumber = parseInt(lastCode.substring(prefix.length));
      return `${prefix}${lastNumber + 1}`;
    }
  }

  // メンテナンス状態設定
  async setMaintenanceStatus(equipmentId, isMaintenanceMode) {
    const status = isMaintenanceMode ? 'maintenance' : 'available';
    const result = await query(
      `UPDATE equipment_items 
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [equipmentId, status]
    );
    return result.rows[0];
  }
}

module.exports = new EquipmentItem();