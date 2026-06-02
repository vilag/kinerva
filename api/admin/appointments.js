const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

const VALID_STATUS = ['pendiente', 'confirmada', 'completada', 'cancelada'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    // ── GET: listar citas con filtros ─────────────────────────────
    if (req.method === 'GET') {
      const { date, status } = req.query;
      const where  = ['1=1'];
      const params = [];

      if (date) {
        where.push('a.date = ?');   params.push(date);
      } else {
        where.push('a.date >= CURDATE()');
      }
      if (status && VALID_STATUS.includes(status)) {
        where.push('a.status = ?'); params.push(status);
      }

      const [rows] = await conn.execute(
        `SELECT a.*, p.id AS pid
         FROM appointments a
         LEFT JOIN patients p ON p.phone = a.phone
         WHERE ${where.join(' AND ')}
         ORDER BY a.date, a.hour
         LIMIT 200`,
        params
      );
      return res.json({ appointments: rows });
    }

    // ── PATCH: cambiar estado ─────────────────────────────────────
    if (req.method === 'PATCH') {
      const { id, status } = req.body || {};
      if (!id || !VALID_STATUS.includes(status))
        return res.status(400).json({ error: 'Datos inválidos' });

      await conn.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
