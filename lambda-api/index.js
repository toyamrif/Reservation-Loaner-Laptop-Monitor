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

  // EventBridgeからの定期実行（クリーンアップ）
  if (event.source === 'aws.events' || event.detail_type === 'Scheduled Event' || event['detail-type'] === 'Scheduled Event') {
    return await cleanupOldReservations(event);
  }

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
    } else if (path.match(/^\/reservations\/[^\/]+$/) && method === 'GET') {
      return await getReservationById(event);
    } else if (path.match(/^\/reservations\/[^\/]+$/) && method === 'PUT') {
      return await updateReservation(event);
    } else if (path.match(/^\/reservations\/[^\/]+\/cancel$/) && method === 'POST') {
      return await cancelReservation(event);
    } else if (path.match(/^\/reservations\/[^\/]+\/return$/) && method === 'POST') {
      return await returnReservation(event);
    } else if (path === '/reservations/search' && method === 'GET') {
      return await searchReservations(event);
    } else if (path === '/reservations/cleanup' && method === 'POST') {
      return await cleanupOldReservations(event);
    } else if (path === '/slack/interactions' && method === 'POST') {
      return await handleSlackInteraction(event);
    } else if (path.match(/^\/equipment\/[^\/]+\/history$/) && method === 'GET') {
      return await getEquipmentHistory(event);
    } else if (path.match(/^\/users\/[^\/]+\/history$/) && method === 'GET') {
      return await getUserHistory(event);
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
    
    // equipment_codeのユニーク制約を整理（既に正しい状態ならスキップ）
    try {
      await client.query('ALTER TABLE equipment_items DROP CONSTRAINT IF EXISTS equipment_items_equipment_code_key');
    } catch(e) { /* ignore */ }
    // 制約が既に存在する場合はそのまま使う
    const constraintCheck = await client.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'equipment_items_site_code_unique'`
    );
    if (constraintCheck.rows.length === 0) {
      await client.query('ALTER TABLE equipment_items ADD CONSTRAINT equipment_items_site_code_unique UNIQUE (site, equipment_code)');
    }
    
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
    
    // 在庫確認
    for (const eq of equipment) {
      const equipmentType = eq.type || eq.equipment_type;
      const inventoryCheck = await client.query(
        `SELECT available_quantity FROM inventory 
         WHERE site = $1 AND equipment_type = $2`,
        [pickup_site, equipmentType]
      );
      
      if (inventoryCheck.rows.length === 0) {
        throw new Error(`Equipment type ${equipmentType} not found at site ${pickup_site}`);
      }
      
      // 期間内の予約済み数量を計算
      const reservedCheck = await client.query(
        `SELECT COALESCE(SUM(re.quantity), 0) as reserved_quantity
         FROM reservations r
         JOIN reservation_equipment re ON r.id = re.reservation_id
         WHERE r.pickup_site = $1 
           AND re.equipment_type = $2
           AND r.status NOT IN ('cancelled')
           AND (r.start_date <= $4 AND r.end_date >= $3)`,
        [pickup_site, equipmentType, start_date, end_date]
      );
      
      const totalQuantity = inventoryCheck.rows[0].available_quantity;
      const reservedQuantity = parseInt(reservedCheck.rows[0].reserved_quantity);
      const availableQuantity = totalQuantity - reservedQuantity;
      
      if (availableQuantity < eq.quantity) {
        throw new Error(`Insufficient inventory for ${equipmentType}. Available: ${availableQuantity}, Requested: ${eq.quantity}`);
      }
    }
    
    // 予約番号を生成（R-00000形式）
    const randomNum = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const bookingCode = 'R-' + randomNum;
    
    // booking_codeカラムが存在しない場合は追加
    await client.query('ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_code VARCHAR(10)');
    
    // 予約作成
    const reservationResult = await client.query(
      `INSERT INTO reservations (user_alias, pickup_site, start_date, end_date, status, booking_code)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [user_alias, pickup_site, start_date, end_date, bookingCode]
    );
    
    const reservation = reservationResult.rows[0];
    
    // 機器情報追加と自動割り当て
    const allocatedEquipment = [];
    
    for (const eq of equipment) {
      const equipmentType = eq.type || eq.equipment_type;
      await client.query(
        `INSERT INTO reservation_equipment (reservation_id, equipment_type, quantity)
         VALUES ($1, $2, $3)`,
        [reservation.id, equipmentType, eq.quantity]
      );
      
      // 利用可能な機器を検索して割り当て
      const availableItems = await client.query(
        `SELECT id, equipment_code 
         FROM equipment_items 
         WHERE site = $1 
           AND equipment_type = $2 
           AND status = 'available'
         ORDER BY equipment_code ASC
         LIMIT $3`,
        [pickup_site, equipmentType, eq.quantity]
      );
      
      // 機器を予約に割り当て
      for (const item of availableItems.rows) {
        // 機器ステータスを「使用中」に更新
        await client.query(
          `UPDATE equipment_items 
           SET status = 'in_use', 
               current_user_alias = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [user_alias, item.id]
        );
        
        // 使用履歴を記録
        await client.query(
          `INSERT INTO equipment_usage_history 
           (equipment_id, reservation_id, user_alias, start_date, status)
           VALUES ($1, $2, $3, $4, 'active')`,
          [item.id, reservation.id, user_alias, start_date]
        );
        
        allocatedEquipment.push({
          type: equipmentType,
          equipment_code: item.equipment_code
        });
      }
      
      // 在庫テーブルの available_quantity を減算
      await client.query(
        `UPDATE inventory 
         SET available_quantity = available_quantity - $1,
             updated_at = NOW()
         WHERE site = $2 AND equipment_type = $3`,
        [eq.quantity, pickup_site, equipmentType]
      );
    }
    
    await client.query('COMMIT');
    
    // 完全な予約情報を返す（割り当てられた機器情報を含む）
    const fullReservation = await client.query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'equipment_type', re.equipment_type,
                  'quantity', re.quantity
                )
              ) as equipment
       FROM reservations r
       LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [reservation.id]
    );
    
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        ...fullReservation.rows[0],
        allocated_equipment: allocatedEquipment
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
 * 予約詳細取得
 */
async function getReservationById(event) {
  const reservationId = event.path.split('/').pop();
  
  const result = await pool.query(
    `SELECT r.*, 
            json_agg(
              json_build_object(
                'equipment_type', re.equipment_type,
                'quantity', re.quantity
              )
            ) as equipment
     FROM reservations r
     LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
     WHERE r.id = $1
     GROUP BY r.id`,
    [reservationId]
  );
  
  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Reservation not found' })
    };
  }
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows[0])
  };
}

/**
 * 予約更新
 */
async function updateReservation(event) {
  const reservationId = event.path.split('/').pop();
  const body = JSON.parse(event.body);
  const { status, start_date, end_date } = body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 予約存在確認
    const checkResult = await client.query(
      'SELECT * FROM reservations WHERE id = $1',
      [reservationId]
    );
    
    if (checkResult.rows.length === 0) {
      throw new Error('Reservation not found');
    }
    
    const updates = [];
    const params = [reservationId];
    let paramIndex = 2;
    
    if (status !== undefined) {
      params.push(status);
      updates.push(`status = $${paramIndex++}`);
    }
    
    if (start_date !== undefined) {
      params.push(start_date);
      updates.push(`start_date = $${paramIndex++}`);
    }
    
    if (end_date !== undefined) {
      params.push(end_date);
      updates.push(`end_date = $${paramIndex++}`);
    }
    
    if (updates.length === 0) {
      throw new Error('No fields to update');
    }
    
    updates.push('updated_at = NOW()');
    
    await client.query(
      `UPDATE reservations SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
    
    await client.query('COMMIT');
    
    // 更新後の予約情報を返す
    const result = await pool.query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'equipment_type', re.equipment_type,
                  'quantity', re.quantity
                )
              ) as equipment
       FROM reservations r
       LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [reservationId]
    );
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.rows[0])
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 予約キャンセル
 */
async function cancelReservation(event) {
  const reservationId = event.path.split('/')[2]; // /reservations/:id/cancel
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 予約情報取得
    const reservationResult = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND status != 'cancelled'`,
      [reservationId]
    );
    
    if (reservationResult.rows.length === 0) {
      throw new Error('Reservation not found or already cancelled');
    }
    
    // 予約ステータスを「キャンセル」に更新
    await client.query(
      `UPDATE reservations 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [reservationId]
    );
    
    // 機器割り当てがある場合は解除
    await client.query(
      `UPDATE equipment_items 
       SET status = 'available', 
           current_user_alias = NULL,
           updated_at = NOW()
       WHERE id IN (
         SELECT equipment_id 
         FROM equipment_usage_history 
         WHERE reservation_id = $1 AND end_date IS NULL
       )`,
      [reservationId]
    );
    
    // 使用履歴を終了
    await client.query(
      `UPDATE equipment_usage_history 
       SET end_date = NOW()
       WHERE reservation_id = $1 AND end_date IS NULL`,
      [reservationId]
    );
    
    // 在庫テーブルの available_quantity を復旧
    const reservationEquipment = await client.query(
      `SELECT equipment_type, quantity FROM reservation_equipment WHERE reservation_id = $1`,
      [reservationId]
    );
    for (const eq of reservationEquipment.rows) {
      await client.query(
        `UPDATE inventory 
         SET available_quantity = LEAST(available_quantity + $1, total_quantity),
             updated_at = NOW()
         WHERE site = $2 AND equipment_type = $3`,
        [eq.quantity, reservationResult.rows[0].pickup_site, eq.equipment_type]
      );
    }
    
    await client.query('COMMIT');
    
    // キャンセル後の予約情報を返す
    const result = await pool.query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'equipment_type', re.equipment_type,
                  'quantity', re.quantity
                )
              ) as equipment
       FROM reservations r
       LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [reservationId]
    );
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Reservation cancelled successfully',
        reservation: result.rows[0]
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
 * 機器別使用履歴取得（過去1年間）
 */
async function getEquipmentHistory(event) {
  const equipmentCode = decodeURIComponent(event.path.split('/')[2]);
  
  try {
    // 機器の存在確認
    const equipmentCheck = await pool.query(
      'SELECT id, equipment_code, equipment_type, site FROM equipment_items WHERE equipment_code = $1',
      [equipmentCode]
    );
    
    if (equipmentCheck.rows.length === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Equipment not found' })
      };
    }
    
    const equipment = equipmentCheck.rows[0];
    
    // 過去1年間の使用履歴を取得
    const historyResult = await pool.query(
      `SELECT 
        h.id,
        h.user_alias,
        h.start_date,
        h.end_date,
        h.status,
        r.id as reservation_id,
        r.pickup_site,
        r.status as reservation_status
       FROM equipment_usage_history h
       JOIN reservations r ON h.reservation_id = r.id
       WHERE h.equipment_id = $1
         AND h.start_date >= NOW() - INTERVAL '1 year'
       ORDER BY h.start_date DESC`,
      [equipment.id]
    );
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        equipment: {
          code: equipment.equipment_code,
          type: equipment.equipment_type,
          site: equipment.site
        },
        history: historyResult.rows,
        period: 'past_1_year'
      })
    };
  } catch (error) {
    console.error('Error fetching equipment history:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * 使用者別履歴取得（過去1年間）
 */
async function getUserHistory(event) {
  const userAlias = decodeURIComponent(event.path.split('/')[2]);
  
  try {
    // 過去1年間の使用履歴を取得
    const historyResult = await pool.query(
      `SELECT 
        h.id,
        h.start_date,
        h.end_date,
        h.status,
        e.equipment_code,
        e.equipment_type,
        e.site,
        r.id as reservation_id,
        r.pickup_site,
        r.status as reservation_status
       FROM equipment_usage_history h
       JOIN equipment_items e ON h.equipment_id = e.id
       JOIN reservations r ON h.reservation_id = r.id
       WHERE h.user_alias = $1
         AND h.start_date >= NOW() - INTERVAL '1 year'
       ORDER BY h.start_date DESC`,
      [userAlias]
    );
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        user_alias: userAlias,
        history: historyResult.rows,
        period: 'past_1_year'
      })
    };
  } catch (error) {
    console.error('Error fetching user history:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}


/**
 * 予約検索（Alias または 予約コードで検索）
 */
async function searchReservations(event) {
  const { q } = event.queryStringParameters || {};
  
  if (!q || q.trim() === '') {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Search query is required' })
    };
  }
  
  const searchTerm = q.trim();
  
  const result = await pool.query(
    `SELECT r.*, 
            r.booking_code,
            json_agg(
              json_build_object(
                'equipment_type', re.equipment_type,
                'quantity', re.quantity
              )
            ) as equipment
     FROM reservations r
     LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
     WHERE r.user_alias ILIKE $1 
        OR r.booking_code ILIKE $1
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    ['%' + searchTerm + '%']
  );
  
  // 各予約に割り当てられた機器情報を追加
  const reservations = [];
  for (const reservation of result.rows) {
    const equipmentResult = await pool.query(
      `SELECT ei.equipment_code, ei.equipment_type
       FROM equipment_usage_history euh
       JOIN equipment_items ei ON euh.equipment_id = ei.id
       WHERE euh.reservation_id = $1`,
      [reservation.id]
    );
    
    reservations.push({
      ...reservation,
      allocated_equipment: equipmentResult.rows
    });
  }
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(reservations)
  };
}


/**
 * 30日以上前のキャンセル・返却済み予約を自動削除
 */
async function cleanupOldReservations(event) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 30日以上前にキャンセルまたは返却された予約を取得
    const oldReservations = await client.query(
      `SELECT id FROM reservations 
       WHERE status IN ('cancelled', 'returned') 
         AND updated_at < NOW() - INTERVAL '30 days'`
    );
    
    const deletedIds = oldReservations.rows.map(r => r.id);
    
    if (deletedIds.length > 0) {
      // 関連データを削除
      await client.query(
        `DELETE FROM equipment_usage_history WHERE reservation_id = ANY($1)`,
        [deletedIds]
      );
      await client.query(
        `DELETE FROM reservation_equipment WHERE reservation_id = ANY($1)`,
        [deletedIds]
      );
      await client.query(
        `DELETE FROM reservations WHERE id = ANY($1)`,
        [deletedIds]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Cleanup completed',
        deleted_count: deletedIds.length
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
 * 予約返却処理
 */
async function returnReservation(event) {
  const reservationId = event.path.split('/')[2];
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 予約情報取得
    const reservationResult = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND status NOT IN ('cancelled', 'returned')`,
      [reservationId]
    );
    
    if (reservationResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Reservation not found, already cancelled, or already returned' })
      };
    }
    
    const reservation = reservationResult.rows[0];
    
    // 予約ステータスを「返却済み」に更新
    await client.query(
      `UPDATE reservations 
       SET status = 'returned', updated_at = NOW()
       WHERE id = $1`,
      [reservationId]
    );
    
    // 機器割り当てを解除
    await client.query(
      `UPDATE equipment_items 
       SET status = 'available', 
           current_user_alias = NULL,
           updated_at = NOW()
       WHERE id IN (
         SELECT equipment_id 
         FROM equipment_usage_history 
         WHERE reservation_id = $1 AND end_date IS NULL
       )`,
      [reservationId]
    );
    
    // 使用履歴を終了
    await client.query(
      `UPDATE equipment_usage_history 
       SET end_date = NOW()
       WHERE reservation_id = $1 AND end_date IS NULL`,
      [reservationId]
    );
    
    // 在庫テーブルの available_quantity を復旧
    const reservationEquipment = await client.query(
      `SELECT equipment_type, quantity FROM reservation_equipment WHERE reservation_id = $1`,
      [reservationId]
    );
    for (const eq of reservationEquipment.rows) {
      await client.query(
        `UPDATE inventory 
         SET available_quantity = LEAST(available_quantity + $1, total_quantity),
             updated_at = NOW()
         WHERE site = $2 AND equipment_type = $3`,
        [eq.quantity, reservation.pickup_site, eq.equipment_type]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        id: reservationId,
        status: 'returned',
        message: 'Return completed successfully'
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
 * Slack Interactivity ハンドラー（ボタン押下処理）
 */
async function handleSlackInteraction(event) {
  // Slackはpayloadをform-urlencodedで送る
  let payload;
  try {
    const body = event.body;
    const decoded = decodeURIComponent(body.replace('payload=', ''));
    payload = JSON.parse(decoded);
  } catch (e) {
    console.error('Payload parse error:', e);
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  console.log('Slack interaction:', JSON.stringify(payload, null, 2));
  
  if (payload.type !== 'block_actions') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  const action = payload.actions[0];
  const actionId = action.action_id;
  
  // 設置完了ボタン
  if (actionId.startsWith('setup_complete_')) {
    const reservationId = action.value;
    const slackUser = payload.user.name || payload.user.username;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 予約情報取得
      const reservationResult = await client.query(
        `SELECT * FROM reservations WHERE id = $1`,
        [reservationId]
      );
      
      if (reservationResult.rows.length === 0) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ text: '予約が見つかりません' }) };
      }
      
      const reservation = reservationResult.rows[0];
      
      // ステータスを setup_complete に更新
      await client.query(
        `UPDATE reservations SET status = 'setup_complete', updated_at = NOW() WHERE id = $1`,
        [reservationId]
      );
      
      await client.query('COMMIT');
      
      // 割り当て機器を取得
      const equipmentResult = await client.query(
        `SELECT ei.equipment_code, ei.equipment_type
         FROM equipment_usage_history euh
         JOIN equipment_items ei ON euh.equipment_id = ei.id
         WHERE euh.reservation_id = $1`,
        [reservationId]
      );
      
      const allocatedEquipment = equipmentResult.rows;
      
      // ユーザーに準備完了メールを送信
      const emailContent = buildSetupCompleteEmail(reservation, allocatedEquipment);
      try {
        await sendSetupCompleteEmail(
          reservation.user_alias + '@amazon.co.jp',
          '【Loaner機器予約システム】機器の準備が完了しました - ' + (reservation.booking_code || reservationId.substring(0,8)),
          emailContent
        );
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
      
      // Slackメッセージを更新（ボタンを「完了済み」に変更）
      const responseUrl = payload.response_url;
      if (responseUrl) {
        const https = require('https');
        const updateData = JSON.stringify({
          replace_original: false,
          text: `✅ *設置完了* - 予約 ${reservation.booking_code || reservationId.substring(0,8)} (${reservation.user_alias}) の準備が完了しました。（by ${slackUser}）\n📧 ${reservation.user_alias}@amazon.co.jp にメール通知を送信しました。`
        });
        
        await new Promise((resolve, reject) => {
          const url = new URL(responseUrl);
          const req = https.request({
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
          });
          req.on('error', reject);
          req.write(updateData);
          req.end();
        });
      }
      
      return { statusCode: 200, headers: corsHeaders, body: '' };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Setup complete error:', error);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ text: 'エラーが発生しました: ' + error.message }) };
    } finally {
      client.release();
    }
  }
  
  return { statusCode: 200, headers: corsHeaders, body: '' };
}

function buildSetupCompleteEmail(reservation, allocatedEquipment) {
  const bookingCode = reservation.booking_code || reservation.id.substring(0,8);
  let email = reservation.user_alias + ' 様\n\n';
  email += 'いつもお疲れ様です。\n';
  email += 'Loaner機器予約システムより、機器準備完了のご連絡です。\n\n';
  email += '■ 予約詳細\n';
  email += '予約コード: ' + bookingCode + '\n';
  email += '受取サイト: ' + reservation.pickup_site + '\n';
  email += '利用期間: ' + reservation.start_date.toISOString().split('T')[0] + ' ～ ' + reservation.end_date.toISOString().split('T')[0] + '\n\n';
  
  if (allocatedEquipment.length > 0) {
    email += '■ 割り当てられた機器\n';
    allocatedEquipment.forEach(eq => {
      let displayName = eq.equipment_code;
      if (eq.equipment_code.startsWith('NAL')) displayName = 'Non-Amazon Loaner ' + eq.equipment_code.replace('NAL', '');
      else if (eq.equipment_code.startsWith('AL')) displayName = 'Amazon Loaner ' + eq.equipment_code.replace('AL', '');
      else if (eq.equipment_code.startsWith('Monitor')) displayName = 'Monitor ' + eq.equipment_code.replace('Monitor', '');
      email += '・' + displayName + '\n';
    });
    email += '\n';
  }
  
  email += '■ 受取場所\n';
  email += reservation.pickup_site + ' Pickup Station\n';
  email += '場所が不明な場合: https://w.amazon.com/bin/view/JP-Local-IT/IT_Support_About_Hardware_On_HND10_HND11_HND17/Pick_up_station\n\n';
  email += '■ 受取手順\n';
  email += 'Pickup Stationの木棚に予約コードとAliasが記載されたPCをお取りください。\n';
  email += 'IT窓口が閉まっている時間帯でも受け取りが可能です。\n\n';
  email += 'ご不明な点がございましたら、ITチームまでお気軽にお声がけください。\n\n';
  email += '---\nAmazon IT';
  
  return email;
}

async function sendSetupCompleteEmail(to, subject, message) {
  const https = require('https');
  const postData = JSON.stringify({ to, subject, message });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '8ah123if48.execute-api.ap-northeast-1.amazonaws.com',
      path: '/send-email',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}
