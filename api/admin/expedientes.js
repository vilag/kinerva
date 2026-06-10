const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    conn = await getConnection();

    const [rows] = await conn.query(`
      SELECT
        folio,
        MAX(CASE WHEN section = 'paciente' THEN data END)  AS pac_data,
        MAX(updated_at) AS updated_at
      FROM expediente_config
      WHERE folio != '_system'
      GROUP BY folio
      ORDER BY MAX(updated_at) DESC
    `);

    const expedientes = rows.map(row => {
      let pac = {};
      try { pac = JSON.parse(row.pac_data || '{}'); } catch {}
      return {
        folio:            row.folio,
        nombre_paciente:  pac.nombre_paciente  || '',
        fecha_valoracion: pac.fecha_valoracion || '',
        motivo_consulta:  pac.motivo_consulta  || '',
        updated_at:       row.updated_at,
      };
    });

    return res.json({ success: true, expedientes });

  } catch (err) {
    console.error('[expedientes]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
