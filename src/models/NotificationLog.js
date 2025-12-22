/**
 * 通知ログモデル
 * 通知履歴の管理と操作
 */

const BaseModel = require('./BaseModel');
const { query } = require('../database/connection');

class NotificationLog extends BaseModel {
  constructor() {
    super('notification_logs');
  }

  // 予約別通知ログ取得
  async findByReservation(reservationId) {
    const result = await query(
      `SELECT * FROM notification_logs 
       WHERE reservation_id = $1 
       ORDER BY created_at DESC`,
      [reservationId]
    );
    return result.rows;
  }

  // 通知タイプ別ログ取得
  async findByType(notificationType, status = null) {
    let queryText = `SELECT * FROM notification_logs WHERE notification_type = $1`;
    const params = [notificationType];

    if (status) {
      queryText += ` AND status = $2`;
      params.push(status);
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 失敗した通知取得
  async findFailedNotifications(limit = 100) {
    const result = await query(
      `SELECT * FROM notification_logs 
       WHERE status = 'failed' 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  // 通知ログ作成
  async createLog(reservationId, notificationType, recipient, message, status = 'pending') {
    const result = await query(
      `INSERT INTO notification_logs 
       (reservation_id, notification_type, recipient, message, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reservationId, notificationType, recipient, message, status]
    );
    return result.rows[0];
  }

  // 通知ステータス更新
  async updateStatus(id, status, sentAt = null) {
    const result = await query(
      `UPDATE notification_logs 
       SET status = $2, sent_at = $3 
       WHERE id = $1 
       RETURNING *`,
      [id, status, sentAt || new Date()]
    );
    return result.rows[0];
  }

  // 通知統計取得
  async getNotificationStats(startDate = null, endDate = null) {
    let queryText = `
      SELECT 
        notification_type,
        status,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM notification_logs
    `;
    const params = [];

    if (startDate && endDate) {
      queryText += ` WHERE created_at >= $1 AND created_at <= $2`;
      params.push(startDate, endDate);
    }

    queryText += ` GROUP BY notification_type, status, DATE(created_at)`;
    queryText += ` ORDER BY date DESC, notification_type, status`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // 再送が必要な通知取得
  async findNotificationsForRetry(maxRetries = 3) {
    const result = await query(
      `SELECT nl.*, 
              (SELECT COUNT(*) FROM notification_logs nl2 
               WHERE nl2.reservation_id = nl.reservation_id 
                 AND nl2.notification_type = nl.notification_type 
                 AND nl2.recipient = nl.recipient 
                 AND nl2.status = 'failed') as retry_count
       FROM notification_logs nl
       WHERE nl.status = 'failed'
         AND (SELECT COUNT(*) FROM notification_logs nl2 
              WHERE nl2.reservation_id = nl.reservation_id 
                AND nl2.notification_type = nl.notification_type 
                AND nl2.recipient = nl.recipient 
                AND nl2.status = 'failed') < $1
       ORDER BY nl.created_at ASC`,
      [maxRetries]
    );
    return result.rows;
  }

  // 古い通知ログのクリーンアップ
  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await query(
      `DELETE FROM notification_logs 
       WHERE created_at < $1 
       RETURNING COUNT(*)`,
      [cutoffDate]
    );
    return result.rowCount;
  }
}

module.exports = new NotificationLog();