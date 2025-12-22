/**
 * Jest テストセットアップ
 * 全テストで共通の設定と初期化処理
 */

const dotenv = require('dotenv');

// テスト環境用の環境変数を読み込み
dotenv.config({ path: '.env.test' });

// デフォルトのテスト用データベースURL
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/inventory_management_test';
}

// テストタイムアウトの設定
jest.setTimeout(30000);

// グローバルなテスト前後の処理
beforeAll(async () => {
  // テスト開始前の初期化処理
  console.log('テスト環境初期化中...');
});

afterAll(async () => {
  // テスト終了後のクリーンアップ処理
  console.log('テスト環境クリーンアップ中...');
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});