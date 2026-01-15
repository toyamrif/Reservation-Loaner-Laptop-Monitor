/**
 * テスト用データベースセットアップスクリプト
 * PostgreSQLにテスト用データベースを作成し、マイグレーションを実行
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupTestDatabase() {
  console.log('🔧 テスト用データベースのセットアップを開始します...\n');

  // デフォルトのpostgresデータベースに接続
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.PGPASSWORD || 'postgres', // 環境変数またはデフォルト
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('✅ PostgreSQLに接続しました');

    // 既存のテストデータベースを削除（存在する場合）
    console.log('\n📦 既存のテストデータベースを確認中...');
    await client.query('DROP DATABASE IF EXISTS inventory_management_test');
    console.log('✅ 既存のデータベースをクリーンアップしました');

    // 新しいテストデータベースを作成
    console.log('\n📦 新しいテストデータベースを作成中...');
    await client.query('CREATE DATABASE inventory_management_test');
    console.log('✅ テストデータベース "inventory_management_test" を作成しました');

    await client.end();

    // テストデータベースに接続してマイグレーションを実行
    const testClient = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: 'inventory_management_test'
    });

    await testClient.connect();
    console.log('\n✅ テストデータベースに接続しました');

    // マイグレーションSQLを読み込んで実行
    console.log('\n📝 マイグレーションを実行中...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrations/001_create_tables.sql'),
      'utf8'
    );

    await testClient.query(migrationSQL);
    console.log('✅ マイグレーションが完了しました');

    await testClient.end();

    console.log('\n🎉 テスト用データベースのセットアップが完了しました！');
    console.log('\n次のコマンドでテストを実行できます:');
    console.log('  npm test\n');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error('\n💡 ヒント:');
    console.error('  - PostgreSQLが起動しているか確認してください');
    console.error('  - パスワードが正しいか確認してください');
    console.error('  - 環境変数 PGPASSWORD を設定するか、スクリプト内のデフォルトパスワードを変更してください');
    console.error('\n例: $env:PGPASSWORD="your_password"; node scripts/setup-test-db.js\n');
    process.exit(1);
  }
}

setupTestDatabase();
