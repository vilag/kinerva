const { getConnection } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST')
    return res.status(405).json({ success: false, message: 'Método no permitido' });

  const { name, phone, email, service, notes, source } = req.body || {};
  if (!phone)
    return res.status(400).json({ success: false, message: 'El teléfono es obligatorio' });

  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      'INSERT INTO prospects (name, phone, email, service, notes, source) VALUES (?, ?, ?, ?, ?, ?)',
      [
        (name || 'Prospecto web').trim(),
        phone.trim(),
        email  || null,
        service || null,
        notes  || null,
        source || null,
      ]
    );
    return res.json({ success: true, message: 'Solicitud recibida' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error del servidor: ' + err.message });
  } finally {
    if (conn) await conn.end();
  }
};
