const mysql = require('mysql2/promise');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const year  = parseInt(req.query.year,  10);
  const month = parseInt(req.query.month, 10);

  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ slots: [], error: 'Parámetros inválidos' });
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl:      { rejectUnauthorized: false },
    });

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end   = new Date(year, month, 0).toISOString().slice(0, 10);

    const [rows] = await conn.execute(
      'SELECT date, hour, duration FROM appointments WHERE date BETWEEN ? AND ? ORDER BY date, hour',
      [start, end]
    );

    const slots = rows.map(r => ({
      date:     r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      hour:     parseInt(r.hour, 10),
      duration: parseInt(r.duration, 10),
    }));

    res.json({ slots });

  } catch (err) {
    console.error(err);
    res.status(500).json({ slots: [], error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
