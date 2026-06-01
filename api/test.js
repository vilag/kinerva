const mysql = require('mysql2/promise');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const result = { node: process.version, steps: [] };

  const vars = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
  const missing = vars.filter(v => !process.env[v]);
  if (missing.length) {
    result.steps.push({ env_vars: 'FAIL — faltan: ' + missing.join(', ') });
    return res.status(500).json(result);
  }
  result.steps.push({ env_vars: 'OK — ' + process.env.DB_HOST + '/' + process.env.DB_NAME });

  let conn;
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl:      { rejectUnauthorized: false },
    });
    result.steps.push({ conexion_db: 'OK' });

    await conn.execute('SELECT 1 FROM appointments LIMIT 1');
    result.steps.push({ tabla_appointments: 'OK' });

    const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM appointments');
    result.steps.push({ citas_registradas: cnt });
    result.status = 'TODO OK';
    res.json(result);

  } catch (err) {
    result.steps.push({ error: err.message });
    if (err.message.includes("doesn't exist"))
      result.steps.push({ accion: 'Ejecuta setup.sql en phpMyAdmin de Hostinger' });
    res.status(500).json(result);
  } finally {
    if (conn) await conn.end();
  }
};
