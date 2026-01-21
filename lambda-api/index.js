/**
 * 在庫管理システム API Lambda関数
 * REST APIエンドポイントを提供
 */

const { Pool } = require('pg');

// データベース接続プール
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Lambda ハンドラー
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // OPTIONSリクエスト（CORS preflight）
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const path = event.path;
    const method = event.httpMethod;

    // ルーティング
    if (path === '/equipment' && method === 'GET') {
      return await getEquipment(event);
    } else if (path === '/equipment' && method === 'POST') {
      return await createEquipment(event);
    } else if (path.startsWith('/equipment/') && method === 'PUT') {
      return await updateEquipment(event);
    } else if (path === '/inventory' && method === 'GET') {
      return await getInventory(event);
    } else if (path === '/reservations' && method === 'GET') {
      return await getReservations(event);
    } else if (path === '/reservations' && method === 'POST') {
      return await createReservation(event);
    } else {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Not Found' })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * 機器一覧取得
 */
async function getEquipment(event) {
  const { site, status } = event.queryStringParameters || {};
  
  let query = 'SELECT * FROM equipment_items WHERE 1=1';
  const params = [];
  
  if (site) {
    params.push(site);
    query += ` AND site = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  
  query += ' ORDER BY equipment_code ASC';
  
  const result = await pool.query(query, params);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows)
  };
}

/**
 * 機器作成
 */
async function createEquipment(event) {
  const body = JSON.parse(event.body);
  const { equipment_code, equipment_type, site, model, serial_number } = body;
  
  const query = `
    INSERT INTO equipment_items (equipment_code, equipment_type, site, model, serial_number, status)
    VALUES ($1, $2, $3, $4, $5, 'available')
    RETURNING *
  `;
  
  const result = await pool.query(query, [equipment_code, equipment_type, site, model, serial_number]);
  
  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify(result.rows[0])
  };
}

/**
 * 機器更新
 */
async function updateEquipment(event) {
  const equipmentCode = event.path.split('/').pop();
  const body = JSON.parse(event.body);
  const { model, serial_number, status, current_user_alias } = body;
  
  const updates = [];
  const params = [];
  let paramIndex = 1;
  
  if (model !== undefined) {
    params.push(model);
    updates.push(`model = $${paramIndex++}`);
  }
  
  if (serial_number !== undefined) {
    params.push(serial_number);
    updates.push(`serial_number = $${paramIndex++}`);
  }
  
  if (status !== undefined) {
    params.push(status);
    updates.push(`status = $${paramIndex++}`);
  }
  
  if (current_user_alias !== undefined) {
    params.push(current_user_alias);
    updates.push(`current_user_alias = $${paramIndex++}`);
  }
  
  params.push(equipmentCode);
  
  const query = `
    UPDATE equipment_items 
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE equipment_code = $${paramIndex}
    RETURNING *
  `;
  
  const result = await pool.query(query, params);
  
  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Equipment not found' })
    };
  }
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows[0])
  };
}

/**
 * 在庫一覧取得
 */
async function getInventory(event) {
  const { site } = event.queryStringParameters || {};
  
  let query = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];
  
  if (site) {
    params.push(site);
    query += ` AND site = $${params.length}`;
  }
  
  query += ' ORDER BY site, equipment_type';
  
  const result = await pool.query(query, params);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows)
  };
}

/**
 * 予約一覧取得
 */
async function getReservations(event) {
  const { site, status } = event.queryStringParameters || {};
  
  let query = `
    SELECT r.*, 
           json_agg(
             json_build_object(
               'equipment_type', re.equipment_type,
               'quantity', re.quantity
             )
           ) as equipment
    FROM reservations r
    LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
    WHERE 1=1
  `;
  const params = [];
  
  if (site) {
    params.push(site);
    query += ` AND r.pickup_site = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND r.status = $${params.length}`;
  }
  
  query += ' GROUP BY r.id ORDER BY r.start_date DESC';
  
  const result = await pool.query(query, params);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows)
  };
}

/**
 * 予約作成
 */
async function createReservation(event) {
  const body = JSON.parse(event.body);
  const { user_alias, pickup_site, start_date, end_date, equipment } = body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 予約作成
    const reservationResult = await client.query(
      `INSERT INTO reservations (user_alias, pickup_site, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [user_alias, pickup_site, start_date, end_date]
    );
    
    const reservation = reservationResult.rows[0];
    
    // 機器情報追加
    for (const eq of equipment) {
      await client.query(
        `INSERT INTO reservation_equipment (reservation_id, equipment_type, quantity)
         VALUES ($1, $2, $3)`,
        [reservation.id, eq.equipment_type, eq.quantity]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(reservation)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
