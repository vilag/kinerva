const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    /* GET — lista de expedientes */
    if (req.method === 'GET') {
      const [rows] = await conn.query(`
        SELECT
          folio,
          MAX(CASE WHEN section = 'paciente' THEN data END) AS pac_data,
          MAX(updated_at) AS updated_at
        FROM expediente_config
        WHERE folio NOT IN ('_system', '_global')
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
    }

    /* DELETE — elimina expediente con registro de auditoría */
    if (req.method === 'DELETE') {
      const folio = req.query?.folio;
      if (!folio || ['_system', '_global', '_config'].includes(folio))
        return res.status(400).json({ error: 'Folio inválido' });

      const [sections] = await conn.query(
        'SELECT section, data, updated_at FROM expediente_config WHERE folio = ?',
        [folio]
      );
      if (sections.length === 0)
        return res.status(404).json({ error: 'Expediente no encontrado' });

      /* Guardar en auditoría antes de eliminar */
      await conn.query(
        `INSERT INTO expedientes_eliminados (folio, data_json, deleted_by)
         VALUES (?, ?, ?)`,
        [folio, JSON.stringify(sections), 'admin']
      );

      await conn.query('DELETE FROM expediente_config WHERE folio = ?', [folio]);

      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[expedientes]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
