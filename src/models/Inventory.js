/**
 * 在庫モデル
 * 在庫数の管理と操作
 */

const BaseModel = require('./BaseModel');
const { query, transaction } = require('../database/connection');

class Inventory extends BaseModel {
  constructor() {
    super('inventory');
  }

  // サイト・機器タイプ別在庫取得
  async findBySiteAndType(site, equipmentType) {
    const result = await query(
      `SELECT * FROM inventory WHERE site = $1 AND equipment_type = $2`,
      [site, equipmentType]
    );
    return result.rows[0] || null;
  }

  // サイト別全在庫取得
  async findBySite(site) {
    const result = await query(
      `SELECT * FROM inventory WHERE site = $1 ORDER BY equipment_type`,
      [site]
    );
    return result.rows;
  }

  // 全サイトの在庫状況取得
  async getAllInventory() {
    const result = await query(
      `SELECT * FROM inventory ORDER BY site, equipment_type`
    );
    return result.rows;
  }

  // 利用可能在庫数取得
  async getAvailableQuantity(site, equipmentType, startDate, endDate) {
    // 基本在庫数取得
    const inventoryResult = await query(
      `SELECT available_quantity FROM inventory 
       WHERE site = $1 AND equipment_type = $2`,
      [site, equipmentType]
    );

    if (inventoryResult.rows.length === 0) {
      return 0;
    }

    const baseAvailable = inventoryResult.rows[0].available_quantity;

    // 期間内の予約による使用数を計算
    const reservedResult = await query(
      `SELECT COALESCE(SUM(re.quantity), 0) as reserved_quantity
       FROM reservation_equipment re
       JOIN reservations r ON re.reservation_id = r.id
       WHERE r.pickup_site = $1 
         AND re.equipment_type = $2
         AND r.status NOT IN ('cancelled', 'returned')
         AND (r.start_date <= $4 AND r.end_date >= $3)`,
      [site, equipmentType, startDate, endDate]
    );

    const reservedQuantity = parseInt(reservedResult.rows[0].reserved_quantity);
    return Math.max(0, baseAvailable - reservedQuantity);
  }

  // 在庫予約（減算）
  async reserveInventory(site, equipmentType, quantity) {
    const result = await query(
      `UPDATE inventory 
       SET available_quantity = available_quantity - $3,
           updated_at = NOW()
       WHERE site = $1 AND equipment_type = $2 
         AND available_quantity >= $3
       RETURNING *`,
      [site, equipmentType, quantity]
    );

    if (result.rows.length === 0) {
      throw new Error('Insufficient inventory available');
    }

    return result.rows[0];
  }

  // 在庫復旧（加算）
  async releaseInventory(site, equipmentType, quantity) {
    const result = await query(
      `UPDATE inventory 
       SET available_quantity = available_quantity + $3,
           updated_at = NOW()
       WHERE site = $1 AND equipment_type = $2
       RETURNING *`,
      [site, equipmentType, quantity]
    );
    return result.rows[0];
  }

  // 在庫数更新
  async updateInventory(site, equipmentType, totalQuantity, availableQuantity, maintenanceQuantity = 0) {
    const result = await query(
      `UPDATE inventory 
       SET total_quantity = $3,
           available_quantity = $4,
           maintenance_quantity = $5,
           updated_at = NOW()
       WHERE site = $1 AND equipment_type = $2
       RETURNING *`,
      [site, equipmentType, totalQuantity, availableQuantity, maintenanceQuantity]
    );

    if (result.rows.length === 0) {
      // 存在しない場合は新規作成
      return await this.create({
        site,
        equipment_type: equipmentType,
        total_quantity: totalQuantity,
        available_quantity: availableQuantity,
        maintenance_quantity: maintenanceQuantity
      });
    }

    return result.rows[0];
  }

  // 在庫不足警告取得
  async getLowStockAlerts(threshold = 2) {
    const result = await query(
      `SELECT * FROM inventory 
       WHERE available_quantity <= $1
       ORDER BY available_quantity ASC, site, equipment_type`,
      [threshold]
    );
    return result.rows;
  }

  // 在庫利用率取得
  async getInventoryUtilization(site = null, startDate = null, endDate = null) {
    let queryText = `
      SELECT 
        i.site,
        i.equipment_type,
        i.total_quantity,
        i.available_quantity,
        i.maintenance_quantity,
        COALESCE(SUM(re.quantity), 0) as reserved_quantity,
        ROUND(
          (COALESCE(SUM(re.quantity), 0)::decimal / NULLIF(i.total_quantity, 0)) * 100, 2
        ) as utilization_rate
      FROM inventory i
      LEFT JOIN reservation_equipment re ON i.equipment_type = re.equipment_type
      LEFT JOIN reservations r ON re.reservation_id = r.id AND r.pickup_site = i.site
    `;

    const params = [];
    const conditions = [];

    if (site) {
      conditions.push(`i.site = $${params.length + 1}`);
      params.push(site);
    }

    if (startDate && endDate) {
      conditions.push(`(r.start_date <= $${params.length + 2} AND r.end_date >= $${params.length + 1})`);
      params.push(startDate, endDate);
      conditions.push(`r.status NOT IN ('cancelled', 'returned')`);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ` GROUP BY i.site, i.equipment_type, i.total_quantity, i.available_quantity, i.maintenance_quantity`;
    queryText += ` ORDER BY i.site, i.equipment_type`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 代替案提案
  async findAlternatives(originalSite, equipmentType, quantity, startDate, endDate) {
    const alternatives = [];

    // 他のサイトでの利用可能性をチェック
    const sites = ['HND10', 'HND17', 'HND21'].filter(site => site !== originalSite);

    for (const site of sites) {
      const available = await this.getAvailableQuantity(site, equipmentType, startDate, endDate);
      if (available >= quantity) {
        alternatives.push({
          type: 'alternative_site',
          site: site,
          equipment_type: equipmentType,
          available_quantity: available,
          start_date: startDate,
          end_date: endDate
        });
      }
    }

    // 期間をずらした提案（前後7日間）
    const alternativeDates = [];
    for (let i = 1; i <= 7; i++) {
      // 前倒し
      const earlierStart = new Date(startDate);
      const earlierEnd = new Date(endDate);
      earlierStart.setDate(earlierStart.getDate() - i);
      earlierEnd.setDate(earlierEnd.getDate() - i);

      const earlierAvailable = await this.getAvailableQuantity(originalSite, equipmentType, earlierStart, earlierEnd);
      if (earlierAvailable >= quantity) {
        alternativeDates.push({
          type: 'alternative_date',
          site: originalSite,
          equipment_type: equipmentType,
          available_quantity: earlierAvailable,
          start_date: earlierStart,
          end_date: earlierEnd,
          days_difference: -i
        });
        break;
      }

      // 後ろ倒し
      const laterStart = new Date(startDate);
      const laterEnd = new Date(endDate);
      laterStart.setDate(laterStart.getDate() + i);
      laterEnd.setDate(laterEnd.getDate() + i);

      const laterAvailable = await this.getAvailableQuantity(originalSite, equipmentType, laterStart, laterEnd);
      if (laterAvailable >= quantity) {
        alternativeDates.push({
          type: 'alternative_date',
          site: originalSite,
          equipment_type: equipmentType,
          available_quantity: laterAvailable,
          start_date: laterStart,
          end_date: laterEnd,
          days_difference: i
        });
        break;
      }
    }

    return [...alternatives, ...alternativeDates];
  }
}

module.exports = new Inventory();