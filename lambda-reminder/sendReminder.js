/**
 * Lambda A（VPC内）- Step Functions用
 * RDSから「明日受け取り予定の予約」を取得してデータを返すだけ。
 * Slack送信はLambda B（VPC外）が担当。
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

/**
 * 明日の日付を取得（JST基準）
 * 金曜実行 → 月曜の予約を取得
 */
function getTargetDate() {
  const now = new Date();
  // JSTに変換 (UTC+9)
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = jst.getUTCDay(); // 0=日, 1=月, ..., 5=金, 6=土

  let daysToAdd = 1; // 通常は翌日
  if (dayOfWeek === 5) {
    // 金曜日 → 月曜日（3日後）
    daysToAdd = 3;
  }

  const target = new Date(jst);
  target.setUTCDate(target.getUTCDate() + daysToAdd);

  const year = target.getUTCFullYear();
  const month = String(target.getUTCMonth() + 1).padStart(2, '0');
  const day = String(target.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 明日受け取り予定の予約を取得
 */
async function getTomorrowReservations() {
  const targetDate = getTargetDate();
  console.log('Target pickup date:', targetDate);

  const query = `
    SELECT 
      r.id,
      r.booking_code,
      r.user_alias,
      r.pickup_site,
      r.start_date,
      r.end_date,
      r.status,
      json_agg(
        json_build_object(
          'equipment_type', re.equipment_type,
          'quantity', re.quantity
        )
      ) as equipment
    FROM reservations r
    LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
    WHERE r.start_date::date = $1::date
      AND r.status IN ('pending', 'confirmed')
    GROUP BY r.id
    ORDER BY r.pickup_site, r.user_alias
  `;

  const result = await pool.query(query, [targetDate]);
  return { reservations: result.rows, targetDate };
}

/**
 * サイト担当者を取得
 */
async function getSiteManagers() {
  const query = `
    SELECT site, user_alias, slack_user_id, email
    FROM site_managers
    WHERE is_active = true
    ORDER BY site, user_alias
  `;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Lambda ハンドラー
 * Step Functionsから呼ばれ、予約データを返す
 */
exports.handler = async (event) => {
  console.log('Lambda A (DB Query) triggered:', JSON.stringify(event));

  try {
    const { reservations, targetDate } = await getTomorrowReservations();
    const managers = await getSiteManagers();

    console.log(`Found ${reservations.length} reservations for ${targetDate}`);

    // Step Functionsの次のステート（Lambda B）に渡すデータ
    return {
      count: reservations.length,
      targetDate,
      reservations,
      managers
    };
  } catch (error) {
    console.error('Error in Lambda A:', error);
    throw error; // Step Functionsがエラーをキャッチ
  }
};
