/**
 * Lambda A（VPC内）- Step Functions用
 * RDSクエリを実行してデータを返す。
 * 
 * 3つのモード:
 * 1. type="pickup" (デフォルト) — 明日受け取り予定の予約を取得
 * 2. type="return_today" — 今日が返却日の予約を取得（ユーザーへのメール用）
 * 3. type="overdue" — 返却期限超過の予約を取得（IT向けSlack通知用）
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
 * 今日の日付を取得（JST基準）
 */
function getTodayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 明日の日付を取得（JST基準）
 * 金曜実行 → 月曜の予約を取得
 */
function getTargetDate() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = jst.getUTCDay();

  let daysToAdd = 1;
  if (dayOfWeek === 5) {
    daysToAdd = 3; // 金曜 → 月曜
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
      r.id, r.booking_code, r.user_alias, r.pickup_site,
      r.start_date, r.end_date, r.status,
      json_agg(json_build_object('equipment_type', re.equipment_type, 'quantity', re.quantity)) as equipment
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
 * 今日が返却日の予約を取得（まだ返却されていないもの）
 */
async function getTodayReturnReservations() {
  const today = getTodayJST();
  console.log('Today return date:', today);

  const query = `
    SELECT 
      r.id, r.booking_code, r.user_alias, r.pickup_site,
      r.start_date, r.end_date, r.status,
      json_agg(json_build_object('equipment_type', re.equipment_type, 'quantity', re.quantity)) as equipment
    FROM reservations r
    LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
    WHERE r.end_date::date = $1::date
      AND r.status IN ('pending', 'confirmed', 'setup_complete')
    GROUP BY r.id
    ORDER BY r.pickup_site, r.user_alias
  `;

  const result = await pool.query(query, [today]);
  return { reservations: result.rows, targetDate: today };
}

/**
 * 返却期限超過の予約を取得
 */
async function getOverdueReservations() {
  const today = getTodayJST();
  console.log('Checking overdue before:', today);

  const query = `
    SELECT 
      r.id, r.booking_code, r.user_alias, r.pickup_site,
      r.start_date, r.end_date, r.status,
      ($1::date - r.end_date::date) as days_overdue,
      json_agg(json_build_object('equipment_type', re.equipment_type, 'quantity', re.quantity)) as equipment
    FROM reservations r
    LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
    WHERE r.end_date::date < $1::date
      AND r.status IN ('pending', 'confirmed', 'setup_complete')
    GROUP BY r.id
    ORDER BY r.end_date ASC, r.pickup_site
  `;

  const result = await pool.query(query, [today]);
  return { reservations: result.rows, targetDate: today };
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
 */
exports.handler = async (event) => {
  console.log('Lambda A triggered:', JSON.stringify(event));

  const type = event.type || 'pickup';

  try {
    let data;

    if (type === 'return_today') {
      const { reservations, targetDate } = await getTodayReturnReservations();
      console.log(`Found ${reservations.length} return-today reservations`);
      data = { type, count: reservations.length, targetDate, reservations };

    } else if (type === 'overdue') {
      const { reservations, targetDate } = await getOverdueReservations();
      console.log(`Found ${reservations.length} overdue reservations`);
      data = { type, count: reservations.length, targetDate, reservations };

    } else {
      // Default: pickup reminder
      const { reservations, targetDate } = await getTomorrowReservations();
      console.log(`Found ${reservations.length} pickup reservations for ${targetDate}`);
      data = { type: 'pickup', count: reservations.length, targetDate, reservations };
    }

    return data;
  } catch (error) {
    console.error('Error in Lambda A:', error);
    throw error;
  }
};
