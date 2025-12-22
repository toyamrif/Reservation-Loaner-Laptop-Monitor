/**
 * データベースマイグレーションスクリプト
 * テーブル作成とインデックス設定を実行
 */

const fs = require('fs');
const path = require('path');
const { query, testConnection, closePool } = require('../src/database/connection');

async function runMigrations() {
  console.log('🚀 Starting database migration...');

  try {
    // データベース接続テスト
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // マイグレーションファイル読み込み
    const migrationPath = path.join(__dirname, '../database/migrations/001_create_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing migration SQL...');
    
    // SQLを実行（複数のステートメントを分割して実行）
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement);
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      }
    }

    console.log('🎉 Migration completed successfully!');
    
    // テーブル一覧確認
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Created tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;