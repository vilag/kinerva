const { getConnection } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST')
    return res.status(405).json({ success: false, message: 'Método no permitido' });

  const { name, phone, service } = req.body || {};
  if (!name || !phone)
    return res.status(400).json({ success: false, message: 'Nombre y teléfono son obligatorios' });

  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      'INSERT INTO prospects (name, phone, service) VALUES (?, ?, ?)',
      [name.trim(), phone.trim(), service || null]
    );
    return res.json({ success: true, message: 'Solicitud recibida' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error del servidor: ' + err.message });
  } finally {
    if (conn) await conn.end();
  }
};
