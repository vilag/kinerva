const mysql = require('mysql2/promise');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { date, hour, duration, name, phone, email, service, notes } = req.body;
  const h   = parseInt(hour, 10);
  const dur = parseInt(duration, 10);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ success: false, message: 'Fecha inválida' });
  if (h < 8 || h > 17 || ![1, 2].includes(dur))
    return res.status(400).json({ success: false, message: 'Horario fuera de rango' });
  if (!name || !phone)
    return res.status(400).json({ success: false, message: 'Nombre y teléfono son obligatorios' });

  let conn;
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl:      { rejectUnauthorized: false },
    });

    const [check] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM appointments WHERE date=? AND hour<? AND (hour+duration)>?',
      [date, h + dur, h]
    );
    if (check[0].cnt > 0)
      return res.json({ success: false, message: 'Ese horario ya fue reservado. Elige otro.' });

    await conn.execute(
      'INSERT INTO appointments (date,hour,duration,name,phone,email,service,notes) VALUES(?,?,?,?,?,?,?,?)',
      [date, h, dur, name, phone, email || null, service || null, notes || null]
    );

    // Crear o actualizar registro de paciente
    await conn.execute(
      `INSERT INTO patients (name, phone, email) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name  = IF(VALUES(name) != '', VALUES(name), name),
         email = COALESCE(VALUES(email), email)`,
      [name, phone, email || null]
    );

    res.json({ success: true, message: 'Cita registrada correctamente' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error del servidor: ' + err.message });
  } finally {
    if (conn) await conn.end();
  }
};
