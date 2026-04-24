/**
 * 前日リマインダーLambda関数
 * 翌日開始の予約を取得し、サイト担当者にSlackリマインダーを送信
 * 「設置完了」ボタン付き
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const https = require('https');

const secretsManagerClient = new SecretsManagerClient({ region: 'ap-northeast-1' });

// Debug: log DB connection config (remove after debugging)
console.log('DB Config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'UNDEFINED',
  ssl: process.env.DB_SSL
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function getSlackBotToken() {
  const command = new GetSecretValueCommand({ SecretId: 'slack/loaner-bot-token' });
  const secretData = await secretsManagerClient.send(command);
  return JSON.parse(secretData.SecretString).bot_token;
}

async function sendSlackMessage(botToken, message) {
  const postData = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'slack.com',
      port: 443,
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${botToken}`
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            resolve(response);
          } else {
            console.error('Slack API error:', response.error);
            reject(new Error(`Slack API error: ${response.error}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getTomorrowReservations() {
  // 次の営業日を計算（金曜→月曜、それ以外→翌日）
  // PostgreSQLのEXTRACT(DOW)は0=日,1=月,...,5=金,6=土
  const result = await pool.query(`
    SELECT r.id, r.user_alias, r.pickup_site, r.start_date, r.end_date, r.status, r.booking_code,
           json_agg(json_build_object(
             'equipment_type', re.equipment_type,
             'quantity', re.quantity
           )) as equipment
    FROM reservations r
    LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
    WHERE r.start_date = CASE 
        WHEN EXTRACT(DOW FROM CURRENT_DATE) = 5 THEN CURRENT_DATE + INTERVAL '3 days'
        ELSE CURRENT_DATE + INTERVAL '1 day'
      END
      AND r.status NOT IN ('cancelled', 'returned', 'setup_complete')
    GROUP BY r.id
    ORDER BY r.pickup_site, r.user_alias
  `);
  return result.rows;
}

async function getSiteManagers(site) {
  const result = await pool.query(
    `SELECT * FROM site_managers WHERE site = $1 AND is_active = true`,
    [site]
  );
  return result.rows;
}

function buildReminderMessage(site, reservations) {
  const equipmentTypeLabel = (type) => {
    const labels = { 'amazon_pc': 'Amazon PC', 'non_amazon_pc': 'Non-Amazon PC', 'monitor': 'モニター' };
    return labels[type] || type;
  };

  const reservationBlocks = reservations.map(r => {
    const equipList = r.equipment
      .map(eq => `• ${equipmentTypeLabel(eq.equipment_type)}: ${eq.quantity}台`)
      .join('\n');
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*予約ID:* ${r.id}\n*利用者:* ${r.user_alias}\n*期間:* ${r.start_date.toISOString().split('T')[0]} ～ ${r.end_date.toISOString().split('T')[0]}\n*機器:*\n${equipList}`
      }
    };
  });

  // 各予約に設置完了ボタンを追加
  const actionBlocks = reservations.map(r => ({
    type: 'actions',
    elements: [{
      type: 'button',
      text: { type: 'plain_text', text: `✅ 設置完了: ${r.user_alias}`, emoji: true },
      value: r.id,
      action_id: `setup_complete_${r.id}`,
      style: 'primary'
    }]
  }));

  // sectionとactionを交互に配置
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 明日の予約リマインダー - ${site}`, emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${site}* で明日 *${reservations.length}件* の予約があります。機器の準備をお願いします。` }
    },
    { type: 'divider' }
  ];

  for (let i = 0; i < reservations.length; i++) {
    blocks.push(reservationBlocks[i]);
    blocks.push(actionBlocks[i]);
    if (i < reservations.length - 1) blocks.push({ type: 'divider' });
  }

  return blocks;
}

exports.handler = async (event) => {
  console.log('Reminder Lambda triggered:', JSON.stringify(event));

  try {
    const reservations = await getTomorrowReservations();
    console.log(`Found ${reservations.length} reservations for tomorrow`);

    if (reservations.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No reservations for tomorrow' }) };
    }

    const botToken = await getSlackBotToken();

    // サイトごとにグループ化
    const bySite = {};
    for (const r of reservations) {
      if (!bySite[r.pickup_site]) bySite[r.pickup_site] = [];
      bySite[r.pickup_site].push(r);
    }

    const results = [];

    for (const [site, siteReservations] of Object.entries(bySite)) {
      const blocks = buildReminderMessage(site, siteReservations);
      const managers = await getSiteManagers(site);

      // 担当者メンション作成
      const mentions = managers.length > 0
        ? managers.map(m => m.slack_user_id ? `<@${m.slack_user_id}>` : m.user_alias).join(' ')
        : '担当者未設定';

      const message = {
        channel: 'it-loaner-reminder',
        text: `📋 明日の予約リマインダー - ${site} (${siteReservations.length}件) ${mentions}`,
        blocks: [
          ...blocks,
          { type: 'divider' },
          { type: 'section', text: { type: 'mrkdwn', text: `*担当者:* ${mentions}` } }
        ]
      };

      const result = await sendSlackMessage(botToken, message);
      results.push({ site, count: siteReservations.length, success: true, ts: result.ts });
      console.log(`Reminder sent for ${site}: ${siteReservations.length} reservations`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Reminders sent', results })
    };
  } catch (error) {
    console.error('Error in reminder Lambda:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
