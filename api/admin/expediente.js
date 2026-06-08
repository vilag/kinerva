const { getConnection }  = require('../_db');
const { verifyAdmin }    = require('../_adminAuth');

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

  const conn = await getConnection();
  try {

    /* GET /api/admin/expediente?section=profesional */
    if (req.method === 'GET') {
      const section = req.query?.section || 'profesional';
      const [rows] = await conn.query(
        'SELECT data FROM expediente_config WHERE section = ? LIMIT 1',
        [section]
      );
      const data = rows[0] ? JSON.parse(rows[0].data) : {};
      return res.json({ success: true, data });
    }

    /* PUT /api/admin/expediente  body: { section, data } */
    if (req.method === 'PUT') {
      const { section = 'profesional', data } = req.body || {};
      if (!section || data == null)
        return res.status(400).json({ error: 'Faltan parámetros' });

      await conn.query(
        `INSERT INTO expediente_config (section, data)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()`,
        [section, JSON.stringify(data), JSON.stringify(data)]
      );
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } finally {
    await conn.end();
  }
};
