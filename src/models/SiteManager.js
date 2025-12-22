/**
 * サイト担当者モデル
 * サイト担当者の管理と操作
 */

const BaseModel = require('./BaseModel');
const { query } = require('../database/connection');

class SiteManager extends BaseModel {
  constructor() {
    super('site_managers');
  }

  // サイト別担当者取得
  async findBySite(site, activeOnly = true) {
    let queryText = `SELECT * FROM site_managers WHERE site = $1`;
    const params = [site];

    if (activeOnly) {
      queryText += ` AND is_active = true`;
    }

    queryText += ` ORDER BY created_at ASC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  // アクティブな全担当者取得
  async findAllActive() {
    const result = await query(
      `SELECT * FROM site_managers 
       WHERE is_active = true 
       ORDER BY site, created_at ASC`
    );
    return result.rows;
  }

  // Alias別担当者取得
  async findByAlias(userAlias) {
    const result = await query(
      `SELECT * FROM site_managers 
       WHERE user_alias = $1 AND is_active = true`,
      [userAlias]
    );
    return result.rows;
  }

  // 担当者の非アクティブ化
  async deactivate(id) {
    const result = await query(
      `UPDATE site_managers 
       SET is_active = false 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // 担当者の再アクティブ化
  async activate(id) {
    const result = await query(
      `UPDATE site_managers 
       SET is_active = true 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // Slack情報更新
  async updateSlackInfo(id, slackUserId) {
    const result = await query(
      `UPDATE site_managers 
       SET slack_user_id = $2 
       WHERE id = $1 
       RETURNING *`,
      [id, slackUserId]
    );
    return result.rows[0];
  }

  // サイトの担当者統計
  async getSiteManagerStats() {
    const result = await query(
      `SELECT 
         site,
         COUNT(*) as total_managers,
         COUNT(CASE WHEN is_active = true THEN 1 END) as active_managers,
         COUNT(CASE WHEN slack_user_id IS NOT NULL THEN 1 END) as managers_with_slack
       FROM site_managers 
       GROUP BY site 
       ORDER BY site`
    );
    return result.rows;
  }
}

module.exports = new SiteManager();