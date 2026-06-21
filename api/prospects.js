const { getConnection } = require('./_db');
const { verifyAdmin }   = require('./_adminAuth');

const VALID_STATUS = ['nuevo', 'contactado', 'convertido', 'descartado'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let conn;
  try {
    conn = await getConnection();

    // ── POST público: guardar prospecto ──────────────────────────
    if (req.method === 'POST') {
      const { name, phone, service } = req.body || {};
      if (!name || !phone)
        return res.status(400).json({ success: false, message: 'Nombre y teléfono son obligatorios' });

      await conn.execute(
        'INSERT INTO prospects (name, phone, service) VALUES (?, ?, ?)',
        [name.trim(), phone.trim(), service || null]
      );
      return res.json({ success: true, message: 'Solicitud recibida' });
    }

    // Las siguientes rutas requieren autenticación de admin
    if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

    // ── GET: listar prospectos ───────────────────────────────────
    if (req.method === 'GET') {
      const { status } = req.query;
      const where  = ['1=1'];
      const params = [];
      if (status && VALID_STATUS.includes(status)) {
        where.push('status = ?'); params.push(status);
      }
      const [rows] = await conn.execute(
        `SELECT * FROM prospects WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 500`,
        params
      );
      return res.json({ prospects: rows });
    }

    // ── PATCH: cambiar estado ────────────────────────────────────
    if (req.method === 'PATCH') {
      const { id, status } = req.body || {};
      if (!id || !VALID_STATUS.includes(status))
        return res.status(400).json({ error: 'Datos inválidos' });
      await conn.execute('UPDATE prospects SET status = ? WHERE id = ?', [status, id]);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error del servidor: ' + err.message });
  } finally {
    if (conn) await conn.end();
  }
};
