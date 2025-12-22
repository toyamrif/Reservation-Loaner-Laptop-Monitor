/**
 * データベースシードスクリプト
 * 初期データの投入を実行
 */

const fs = require('fs');
const path = require('path');
const { query, testConnection, closePool } = require('../src/database/connection');

async function runSeeds() {
  console.log('🌱 Starting database seeding...');

  try {
    // データベース接続テスト
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // シードファイル読み込み
    const seedPath = path.join(__dirname, '../database/seeds/initial_data.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    console.log('📋 Executing seed SQL...');
    
    // SQLを実行（複数のステートメントを分割して実行）
    const statements = seedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement);
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      }
    }

    console.log('🎉 Seeding completed successfully!');
    
    // データ確認
    const inventoryCount = await query('SELECT COUNT(*) FROM inventory');
    const equipmentCount = await query('SELECT COUNT(*) FROM equipment_items');
    const managerCount = await query('SELECT COUNT(*) FROM site_managers');
    
    console.log('\n📊 Seeded data summary:');
    console.log(`  - Inventory records: ${inventoryCount.rows[0].count}`);
    console.log(`  - Equipment items: ${equipmentCount.rows[0].count}`);
    console.log(`  - Site managers: ${managerCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  runSeeds();
}

module.exports = runSeeds;