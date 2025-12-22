/**
 * データベース接続管理
 * PostgreSQL接続プールの設定と管理
 */

const { Pool } = require('pg');
require('dotenv').config();

// 接続プール設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/inventory_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // 最大接続数
  idleTimeoutMillis: 30000, // アイドルタイムアウト
  connectionTimeoutMillis: 2000, // 接続タイムアウト
});

// 接続エラーハンドリング
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// データベース接続テスト
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connected successfully:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err);
    return false;
  }
}

// クエリ実行ヘルパー
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Query error', { text, error: err.message });
    throw err;
  }
}

// トランザクション実行ヘルパー
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 接続プールを閉じる
async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closePool
};