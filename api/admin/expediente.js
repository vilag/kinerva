const { getConnection }  = require('../_db');
const { verifyAdmin }    = require('../_adminAuth');

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    /* GET /api/admin/expediente?section=...&folio=... */
    if (req.method === 'GET') {
      const section = req.query?.section || 'profesional';
      const folio   = req.query?.folio   || 'borrador';

      if (section === 'folio_next') {
        const [rows] = await conn.query(
          'SELECT data FROM expediente_config WHERE folio = ? AND section = ? LIMIT 1',
          ['_system', 'folio_counter']
        );
        const current  = rows[0] ? JSON.parse(rows[0].data).counter : 0;
        const next     = current + 1;
        const newFolio = `FISIO-${String(next).padStart(4, '0')}`;
        await conn.query(
          `INSERT INTO expediente_config (folio, section, data) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()`,
          ['_system', 'folio_counter', JSON.stringify({ counter: next }),
                                       JSON.stringify({ counter: next })]
        );
        return res.json({ success: true, folio: newFolio });
      }

      const [rows] = await conn.query(
        'SELECT data FROM expediente_config WHERE folio = ? AND section = ? LIMIT 1',
        [folio, section]
      );
      const data = rows[0] ? JSON.parse(rows[0].data) : {};
      return res.json({ success: true, data });
    }

    /* PUT /api/admin/expediente  body: { section, data, folio } */
    if (req.method === 'PUT') {
      const { section = 'profesional', data, folio = 'borrador' } = req.body || {};
      if (!section || data == null)
        return res.status(400).json({ error: 'Faltan parámetros' });

      await conn.query(
        `INSERT INTO expediente_config (folio, section, data)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()`,
        [folio, section, JSON.stringify(data), JSON.stringify(data)]
      );
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[expediente]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
