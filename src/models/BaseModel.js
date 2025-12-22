/**
 * ベースモデルクラス
 * 全てのモデルの共通機能を提供
 */

const { query, transaction } = require('../database/connection');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  // IDによる検索
  async findById(id) {
    const result = await query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // 全件取得
  async findAll(conditions = {}, orderBy = 'created_at DESC') {
    let queryText = `SELECT * FROM ${this.tableName}`;
    const params = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      queryText += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }
    
    queryText += ` ORDER BY ${orderBy}`;
    
    const result = await query(queryText, params);
    return result.rows;
  }

  // 作成
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    
    const queryText = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await query(queryText, values);
    return result.rows[0];
  }

  // 更新
  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    
    const queryText = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [id, ...values]);
    return result.rows[0];
  }

  // 削除
  async delete(id) {
    const result = await query(
      `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // カウント
  async count(conditions = {}) {
    let queryText = `SELECT COUNT(*) FROM ${this.tableName}`;
    const params = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      queryText += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }
    
    const result = await query(queryText, params);
    return parseInt(result.rows[0].count);
  }

  // 存在確認
  async exists(conditions) {
    const count = await this.count(conditions);
    return count > 0;
  }
}

module.exports = BaseModel;