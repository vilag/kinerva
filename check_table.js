require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });
  const [rows] = await conn.execute("SHOW TABLES LIKE 'expediente_config'");
  console.log('expediente_config exists:', rows.length > 0);
  if (rows.length > 0) {
    const [cols] = await conn.execute('DESCRIBE expediente_config');
    cols.forEach(c => console.log(' -', c.Field, c.Type));
    const [cnt] = await conn.execute('SELECT COUNT(*) AS cnt FROM expediente_config');
    console.log('rows:', cnt[0].cnt);
  } else {
    console.log('TABLE MISSING — run setup_expediente.sql in phpMyAdmin');
  }
  await conn.end();
})().catch(e => console.error('ERROR:', e.message));
