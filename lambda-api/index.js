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
    } else if (path === '/inventory/fix' && method === 'POST') {
      return await fixInventoryQuantities(event);
    } else if (path === '/database/reset' && method === 'POST') {
      return await resetDatabase(event);
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
  
  query += ` ORDER BY 
    site ASC, 
    CASE equipment_type 
      WHEN 'amazon_pc' THEN 1 
      WHEN 'non_amazon_pc' THEN 2 
      WHEN 'monitor' THEN 3 
      ELSE 4 
    END ASC,
    SUBSTRING(equipment_code FROM '^[A-Za-z]+') ASC,
    CAST(SUBSTRING(equipment_code FROM '[0-9]+$') AS INTEGER) ASC`;
  
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
 * 在庫数量を正しい値に修正（一時的なエンドポイント）
 */
async function fixInventoryQuantities(event) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 全サイトの在庫を正しい値に更新
    await client.query(`
      UPDATE inventory 
      SET total_quantity = 20, available_quantity = 20 
      WHERE equipment_type = 'amazon_pc'
    `);
    
    await client.query(`
      UPDATE inventory 
      SET total_quantity = 20, available_quantity = 20 
      WHERE equipment_type = 'non_amazon_pc'
    `);
    
    await client.query(`
      UPDATE inventory 
      SET total_quantity = 10, available_quantity = 10 
      WHERE equipment_type = 'monitor'
    `);
    
    await client.query('COMMIT');
    
    // 更新後の在庫を取得
    const result = await client.query('SELECT * FROM inventory ORDER BY site, equipment_type');
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Inventory quantities fixed successfully',
        inventory: result.rows
      })
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * データベースを完全リセット（一時的なエンドポイント）
 */
async function resetDatabase(event) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 全データ削除（外部キー制約を考慮した順序）
    await client.query('DELETE FROM reservation_equipment');
    await client.query('DELETE FROM reservations');
    await client.query('DELETE FROM notification_logs');
    await client.query('DELETE FROM equipment_items');
    await client.query('DELETE FROM inventory');
    await client.query('DELETE FROM site_managers');
    
    // equipment_codeのユニーク制約を変更（site + equipment_codeの組み合わせでユニーク）
    await client.query('ALTER TABLE equipment_items DROP CONSTRAINT IF EXISTS equipment_items_equipment_code_key');
    await client.query('ALTER TABLE equipment_items ADD CONSTRAINT equipment_items_site_code_unique UNIQUE (site, equipment_code)');
    
    // 在庫データ投入
    await client.query(`
      INSERT INTO inventory (site, equipment_type, total_quantity, available_quantity, maintenance_quantity) VALUES
      ('HND10', 'amazon_pc', 20, 20, 0),
      ('HND10', 'non_amazon_pc', 20, 20, 0),
      ('HND10', 'monitor', 10, 10, 0),
      ('HND17', 'amazon_pc', 20, 20, 0),
      ('HND17', 'non_amazon_pc', 20, 20, 0),
      ('HND17', 'monitor', 10, 10, 0),
      ('HND21', 'amazon_pc', 20, 20, 0),
      ('HND21', 'non_amazon_pc', 20, 20, 0),
      ('HND21', 'monitor', 10, 10, 0)
    `);
    
    // 全サイトの機器データを一括投入
    const allEquipment = [];
    
    // HND10の機器
    for (let i = 1; i <= 20; i++) {
      allEquipment.push(`('AL${i}', 'amazon_pc', 'HND10', 'available', 'AMZ-HND10-${String(i).padStart(3, '0')}', 'ThinkPad X1 Carbon', '2024-01-15')`);
    }
    for (let i = 1; i <= 20; i++) {
      allEquipment.push(`('NAL${i}', 'non_amazon_pc', 'HND10', 'available', 'NAL-HND10-${String(i).padStart(3, '0')}', '${i <= 10 ? 'Dell Latitude 7420' : 'HP EliteBook 840'}', '2024-01-20')`);
    }
    for (let i = 1; i <= 10; i++) {
      allEquipment.push(`('Monitor${i}', 'monitor', 'HND10', 'available', 'MON-HND10-${String(i).padStart(3, '0')}', '${i <= 5 ? 'Dell U2720Q 27inch' : 'LG 27UP850 27inch'}', '2024-01-10')`);
    }
    
    // HND17の機器
    for (let i = 1; i <= 20; i++) {
      allEquipment.push(`('AL${i}', 'amazon_pc', 'HND17', 'available', 'AMZ-HND17-${String(i).padStart(3, '0')}', 'ThinkPad X1 Carbon', '2024-01-18')`);
    }
    for (let i = 1; i <= 20; i++) {
      allEquipment.push(`('NAL${i}', 'non_amazon_pc', 'HND17', 'available', 'NAL-HND17-${String(i).padStart(3, '0')}', '${i <= 10 ? 'Dell Latitude 7420' : 'HP EliteBook 840'}', '2024-01-22')`);
    }
    for (let i = 1; i <= 10; i++) {
      allEquipment.push(`('Monitor${i}', 'monitor', 'HND17', 'available', 'MON-HND17-${String(i).padStart(3, '0')}', '${i <= 5 ? 'Dell U2720Q 27inch' : 'LG 27UP850 27inch'}', '2024-01-12')`);
    }
    
    // HND21の機器
    for (let i = 1; i <= 20; i++) {
      allEquipment.push(`('AL${i}', 'amazon_pc', 'HND21', 'available', 'AMZ-HND21-${String(i).padStart(3, '0')}', 'ThinkPad X1 Carbon', '2024-01-16')`);
    }
    for (let i = 1; i <= 20; i++) {
      allEquipment.push(`('NAL${i}', 'non_amazon_pc', 'HND21', 'available', 'NAL-HND21-${String(i).padStart(3, '0')}', '${i <= 10 ? 'Dell Latitude 7420' : 'HP EliteBook 840'}', '2024-01-24')`);
    }
    for (let i = 1; i <= 10; i++) {
      allEquipment.push(`('Monitor${i}', 'monitor', 'HND21', 'available', 'MON-HND21-${String(i).padStart(3, '0')}', '${i <= 5 ? 'Dell U2720Q 27inch' : 'LG 27UP850 27inch'}', '2024-01-14')`);
    }
    
    await client.query(`
      INSERT INTO equipment_items (equipment_code, equipment_type, site, status, serial_number, model, purchase_date) VALUES
      ${allEquipment.join(',\n')}
    `);
    
    // サイト担当者データ投入
    await client.query(`
      INSERT INTO site_managers (site, user_alias, slack_user_id, email, is_active) VALUES
      ('HND10', 'itadmin1', 'U01234567', 'itadmin1@company.com', true),
      ('HND10', 'itadmin2', 'U01234568', 'itadmin2@company.com', true),
      ('HND17', 'itadmin3', 'U01234569', 'itadmin3@company.com', true),
      ('HND21', 'itadmin4', 'U01234570', 'itadmin4@company.com', true),
      ('HND21', 'itadmin5', 'U01234571', 'itadmin5@company.com', true)
    `);
    
    await client.query('COMMIT');
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Database reset successfully',
        summary: {
          inventory: '9 records (3 sites x 3 equipment types)',
          equipment_items: '150 records (50 per site)',
          site_managers: '5 records'
        }
      })
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
