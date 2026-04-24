/**
 * Lambda B（VPC外）- Slack APIにリマインダーを送信
 * Step Functionsから呼ばれる。Lambda Aの結果を受け取る。
 */

const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: 'ap-northeast-1' });

async function getSlackBotToken() {
  const command = new GetSecretValueCommand({ SecretId: 'slack/loaner-bot-token' });
  const secretData = await secretsClient.send(command);
  return JSON.parse(secretData.SecretString).bot_token;
}

async function sendSlackMessage(botToken, message) {
  const postData = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'slack.com',
      port: 443,
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + botToken
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const response = JSON.parse(data);
        if (response.ok) resolve(response);
        else reject(new Error('Slack error: ' + response.error));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('Lambda B triggered:', JSON.stringify(event));
  
  const { reservations, managers, count } = event;
  
  if (!reservations || count === 0) {
    console.log('No reservations to notify');
    return { message: 'No reservations', count: 0 };
  }
  
  try {
    const botToken = await getSlackBotToken();
    
    // サイトごとにグループ化
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
      
      // 担当者メンション
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
      results.push({ site, count: siteReservations.length, ts: result.ts });
      console.log('Reminder sent for ' + site);
    }
    
    return { message: 'Reminders sent', results };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
