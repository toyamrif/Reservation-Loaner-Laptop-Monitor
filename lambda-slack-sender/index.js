/**
 * Lambda B（VPC外）- Slack送信 + インタラクション処理
 * 
 * 2つのモードで動作:
 * 1. Step Functionsから呼ばれる → リマインダー送信
 * 2. API Gateway経由 → Slackボタン押下処理（準備完了）
 */

const https = require('https');
const crypto = require('crypto');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: 'ap-northeast-1' });

const INVENTORY_API = 'https://qqu1ilmtn9.execute-api.ap-northeast-1.amazonaws.com/prod';
const EMAIL_API = 'https://8ah123if48.execute-api.ap-northeast-1.amazonaws.com/send-email';

// キャッシュ
let cachedSigningSecret = null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

async function getSlackBotToken() {
  const command = new GetSecretValueCommand({ SecretId: 'slack/loaner-bot-token' });
  const secretData = await secretsClient.send(command);
  return JSON.parse(secretData.SecretString).bot_token;
}

async function getSigningSecret() {
  if (cachedSigningSecret) return cachedSigningSecret;
  const command = new GetSecretValueCommand({ SecretId: 'slack/signing-secret' });
  const secretData = await secretsClient.send(command);
  cachedSigningSecret = JSON.parse(secretData.SecretString).signing_secret;
  return cachedSigningSecret;
}

function verifySlackSignature(signingSecret, timestamp, body, signature) {
  // リプレイ攻撃防止: 5分以上前のリクエストは拒否
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.warn('Request timestamp too old:', timestamp);
    return false;
  }
  const sigBasestring = 'v0:' + timestamp + ':' + body;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

function httpsRequest(url, method, data, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = typeof data === 'string' ? data : JSON.stringify(data);
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendSlackMessage(botToken, message) {
  return httpsRequest('https://slack.com/api/chat.postMessage', 'POST', message, {
    'Authorization': 'Bearer ' + botToken,
    'Content-Type': 'application/json; charset=utf-8'
  });
}

// ============================================
// メインハンドラー
// ============================================
exports.handler = async (event) => {
  console.log('Lambda B triggered:', JSON.stringify(event).substring(0, 500));

  // API Gateway経由（Slackインタラクション）
  if (event.httpMethod) {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }
    return await handleSlackInteraction(event);
  }

  // Step Functionsから（リマインダー送信）
  const type = event.type || 'pickup';
  
  if (type === 'return_today') {
    return await handleReturnTodayReminder(event);
  } else if (type === 'overdue') {
    return await handleOverdueNotification(event);
  }
  return await handleReminder(event);
};

// ============================================
// リマインダー送信（Step Functions経由）
// ============================================
async function handleReminder(event) {
  const { reservations, managers, count } = event;

  if (!reservations || count === 0) {
    console.log('No reservations to notify');
    return { message: 'No reservations', count: 0 };
  }

  try {
    const botToken = await getSlackBotToken();

    const bySite = {};
    for (const r of reservations) {
      if (!bySite[r.pickup_site]) bySite[r.pickup_site] = [];
      bySite[r.pickup_site].push(r);
    }

    const results = [];

    for (const [site, siteReservations] of Object.entries(bySite)) {
      const blocks = [];
      blocks.push({
        type: 'header',
        text: { type: 'plain_text', text: '📋 予約リマインダー - ' + site, emoji: true }
      });
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '*' + site + '* で *' + siteReservations.length + '件* の予約があります。機器の準備をお願いします。' }
      });
      blocks.push({ type: 'divider' });

      for (const r of siteReservations) {
        const equipLabels = { amazon_pc: 'Amazon PC', non_amazon_pc: 'Non-Amazon PC', monitor: 'モニター' };
        const equipList = r.equipment
          .map(eq => '• ' + (equipLabels[eq.equipment_type] || eq.equipment_type) + ': ' + eq.quantity + '台')
          .join('\n');

        const startDate = typeof r.start_date === 'string' ? r.start_date.split('T')[0] : r.start_date;
        const endDate = typeof r.end_date === 'string' ? r.end_date.split('T')[0] : r.end_date;

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*予約:* ' + (r.booking_code || r.id.substring(0, 8)) + '\n*利用者:* ' + r.user_alias + '\n*期間:* ' + startDate + ' ～ ' + endDate + '\n*機器:*\n' + equipList
          }
        });
        blocks.push({
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: '✅ 準備完了', emoji: true },
            value: r.id,
            action_id: 'setup_complete_' + r.id,
            style: 'primary'
          }]
        });
        blocks.push({ type: 'divider' });
      }

      const siteManagers = (managers || []).filter(m => m.site === site);
      const mentions = siteManagers.length > 0
        ? siteManagers.map(m => m.slack_user_id ? '<@' + m.slack_user_id + '>' : m.user_alias).join(' ')
        : '担当者未設定';

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '*担当者:* ' + mentions }
      });

      const message = {
        channel: 'it-loaner-reminder',
        text: '📋 予約リマインダー - ' + site + ' (' + siteReservations.length + '件)',
        blocks: blocks
      };

      const result = await sendSlackMessage(botToken, message);
      if (!result.ok) {
        console.error('Slack send error:', result.error);
      }
      results.push({ site, count: siteReservations.length, ts: result.ts });
      console.log('Reminder sent for ' + site);
    }

    return { message: 'Reminders sent', results };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// ============================================
// Slackインタラクション処理（ボタン押下）
// ============================================
async function handleSlackInteraction(event) {
  // Slack Signing Secret で署名検証（ログ記録のみ、ブロックしない）
  try {
    const signingSecret = await getSigningSecret();
    const timestamp = event.headers['X-Slack-Request-Timestamp'] || event.headers['x-slack-request-timestamp'];
    const slackSignature = event.headers['X-Slack-Signature'] || event.headers['x-slack-signature'];
    
    if (timestamp && slackSignature) {
      const verified = verifySlackSignature(signingSecret, timestamp, event.body, slackSignature);
      console.log('Slack signature verification:', verified ? 'PASSED' : 'FAILED');
    } else {
      console.log('Slack signature headers not present - skipping verification');
    }
  } catch (verifyError) {
    console.error('Signature verification error (non-blocking):', verifyError.message);
  }

  let payload;
  try {
    const body = event.body;
    const decoded = decodeURIComponent(body.replace('payload=', ''));
    payload = JSON.parse(decoded);
  } catch (e) {
    console.error('Payload parse error:', e);
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  console.log('Slack interaction type:', payload.type);

  if (payload.type !== 'block_actions') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const action = payload.actions[0];
  const actionId = action.action_id;

  if (!actionId.startsWith('setup_complete_')) {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const reservationId = action.value;
  const slackUser = payload.user.name || payload.user.username;
  const responseUrl = payload.response_url;

  try {
    // 1. inventory-api 経由で DB 更新（setup_complete に変更）
    console.log('Updating reservation status:', reservationId);
    const updateResult = await httpsRequest(
      INVENTORY_API + '/reservations/' + reservationId,
      'PUT',
      { status: 'setup_complete' }
    );
    console.log('Update result:', JSON.stringify(updateResult));

    // 2. 予約詳細を取得
    const reservation = await httpsRequest(
      INVENTORY_API + '/reservations/' + reservationId,
      'GET',
      ''
    );
    console.log('Reservation:', JSON.stringify(reservation).substring(0, 300));

    const bookingCode = reservation.booking_code || reservationId.substring(0, 8);
    const userAlias = reservation.user_alias;
    const pickupSite = reservation.pickup_site;
    const startDate = reservation.start_date ? reservation.start_date.split('T')[0] : '';
    const endDate = reservation.end_date ? reservation.end_date.split('T')[0] : '';

    // 3. メール送信
    console.log('Sending email to:', userAlias + '@amazon.co.jp');
    const emailBody = buildSetupCompleteEmail(userAlias, bookingCode, pickupSite, startDate, endDate, reservation.equipment || []);
    try {
      await httpsRequest(EMAIL_API, 'POST', {
        to: userAlias + '@amazon.co.jp',
        subject: '【Loaner機器予約システム】機器の準備が完了しました - ' + bookingCode,
        message: emailBody
      });
      console.log('Email sent successfully');
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr.message);
    }

    // 4. Slack メッセージ更新（response_url）
    if (responseUrl) {
      console.log('Updating Slack message via response_url');
      await httpsRequest(responseUrl, 'POST', {
        replace_original: false,
        text: '✅ *設置完了* - 予約 ' + bookingCode + ' (' + userAlias + ') の準備が完了しました。（by ' + slackUser + '）\n📧 ' + userAlias + '@amazon.co.jp にメール通知を送信しました。'
      });
      console.log('Slack message updated');
    }

    return { statusCode: 200, headers: corsHeaders, body: '' };
  } catch (error) {
    console.error('Setup complete error:', error);
    // Slack には 200 を返さないとリトライされる
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
}

function buildSetupCompleteEmail(userAlias, bookingCode, pickupSite, startDate, endDate, equipment) {
  let email = userAlias + ' 様\n\n';
  email += 'いつもお疲れ様です。\n';
  email += 'Loaner機器予約システムより、機器準備完了のご連絡です。\n\n';
  email += '■ 予約詳細\n';
  email += '予約コード: ' + bookingCode + '\n';
  email += '受取サイト: ' + pickupSite + '\n';
  email += '利用期間: ' + startDate + ' ～ ' + endDate + '\n\n';

  if (equipment && equipment.length > 0) {
    email += '■ 予約機器\n';
    const labels = { amazon_pc: 'Amazon PC', non_amazon_pc: 'Non-Amazon PC', monitor: 'モニター' };
    equipment.forEach(eq => {
      if (eq.equipment_type) {
        email += '・' + (labels[eq.equipment_type] || eq.equipment_type) + ': ' + eq.quantity + '台\n';
      }
    });
    email += '\n';
  }

  email += '■ 受取場所\n';
  email += pickupSite + ' Pickup Station\n';
  email += '場所が不明な場合: https://w.amazon.com/bin/view/JP-Local-IT/IT_Support_About_Hardware_On_HND10_HND11_HND17/Pick_up_station\n\n';
  email += '■ 受取手順\n';
  email += 'Pickup Stationの木棚に予約コードとAliasが記載されたPCをお取りください。\n';
  email += 'IT窓口が閉まっている時間帯でも受け取りが可能です。\n\n';
  email += 'ご不明な点がございましたら、ITチームまでお気軽にお声がけください。\n\n';
  email += '---\nAmazon IT';

  return email;
}

// ============================================
// 返却日当日メール送信
// ============================================
async function handleReturnTodayReminder(event) {
  const { reservations, count } = event;

  if (!reservations || count === 0) {
    console.log('No return-today reservations');
    return { message: 'No return-today reservations', count: 0 };
  }

  const results = [];

  for (const r of reservations) {
    const userAlias = r.user_alias;
    const bookingCode = r.booking_code || r.id.substring(0, 8);
    const endDate = typeof r.end_date === 'string' ? r.end_date.split('T')[0] : r.end_date;
    const pickupSite = r.pickup_site;

    const equipLabels = { amazon_pc: 'Amazon PC', non_amazon_pc: 'Non-Amazon PC', monitor: 'モニター' };
    let equipList = '';
    if (r.equipment && r.equipment.length > 0) {
      equipList = r.equipment.map(function(eq) {
        return '・' + (equipLabels[eq.equipment_type] || eq.equipment_type) + ': ' + eq.quantity + '台';
      }).join('\n');
    }

    const emailBody = userAlias + ' 様\n\n' +
      'いつもお疲れ様です。\n' +
      'Loaner機器予約システムより、返却日のご連絡です。\n\n' +
      '■ 本日が返却予定日です\n' +
      '予約コード: ' + bookingCode + '\n' +
      '返却予定日: ' + endDate + '\n' +
      '受取サイト: ' + pickupSite + '\n\n' +
      '■ 返却機器\n' + equipList + '\n\n' +
      '■ 返却方法\n' +
      'Amazon Loaner laptopは返却用ロッカーをお使いください。\n' +
      'モニターについては、ピックアップされた時と同じ場所で構いません。\n\n' +
      'ロッカーの場所や使い方について：\n' +
      'https://w.amazon.com/bin/view/JP-Local-IT/IT_Support_About_Hardware_On_HND10_HND11_HND17/Return_PC/\n\n' +
      '延長が必要な場合は、予約確認ページから日程変更をお願いします。\n\n' +
      '---\nAmazon IT';

    try {
      await httpsRequest(EMAIL_API, 'POST', {
        to: userAlias + '@amazon.co.jp',
        subject: '【Loaner機器予約システム】本日が返却予定日です - ' + bookingCode,
        message: emailBody
      });
      results.push({ user: userAlias, bookingCode, status: 'sent' });
      console.log('Return reminder email sent to:', userAlias);
    } catch (err) {
      console.error('Email error for ' + userAlias + ':', err.message);
      results.push({ user: userAlias, bookingCode, status: 'error', error: err.message });
    }
  }

  return { message: 'Return-today reminders sent', count: results.length, results };
}

// ============================================
// 返却期限超過 Slack通知（毎週水曜）
// ============================================
async function handleOverdueNotification(event) {
  const { reservations, managers, count } = event;

  if (!reservations || count === 0) {
    console.log('No overdue reservations');
    return { message: 'No overdue reservations', count: 0 };
  }

  try {
    const botToken = await getSlackBotToken();

    const blocks = [];
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: '⚠️ 返却期限超過レポート', emoji: true }
    });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*' + count + '件* の予約が返却期限を超過しています。' }
    });
    blocks.push({ type: 'divider' });

    for (const r of reservations) {
      const bookingCode = r.booking_code || r.id.substring(0, 8);
      const endDate = typeof r.end_date === 'string' ? r.end_date.split('T')[0] : r.end_date;
      const daysOverdue = r.days_overdue || '?';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*' + bookingCode + '* - ' + r.user_alias + '\n' +
                '📍 ' + r.pickup_site + ' | 返却予定: ' + endDate + ' | *' + daysOverdue + '日超過*'
        }
      });
    }

    blocks.push({ type: 'divider' });

    // 担当者メンション
    const allManagers = (managers || []);
    const mentions = allManagers.length > 0
      ? allManagers.map(function(m) { return m.slack_user_id ? '<@' + m.slack_user_id + '>' : m.user_alias; }).join(' ')
      : '担当者未設定';

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*担当者:* ' + mentions }
    });

    const message = {
      channel: 'it-loaner-reminder',
      text: '⚠️ 返却期限超過レポート (' + count + '件)',
      blocks: blocks
    };

    const result = await sendSlackMessage(botToken, message);
    console.log('Overdue notification sent');

    return { message: 'Overdue notification sent', count, ts: result.ts };
  } catch (error) {
    console.error('Overdue notification error:', error);
    throw error;
  }
}
