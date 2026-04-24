/**
 * リマインダーLambda（VPC外）
 * inventory-api のエンドポイントを呼んでSlack通知を送信
 */

const https = require('https');

const API_URL = 'https://qqu1ilmtn9.execute-api.ap-northeast-1.amazonaws.com/prod/slack/send-reminder';

exports.handler = async (event) => {
  console.log('Reminder Lambda triggered:', JSON.stringify(event));
  
  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        });
      });
      req.on('error', reject);
      req.write('{}');
      req.end();
    });
    
    console.log('API response:', JSON.stringify(result));
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
