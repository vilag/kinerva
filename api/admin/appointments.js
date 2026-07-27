const { getConnection } = require('../_db');
const { verifyStaff }   = require('../_staffAuth');

const VALID_STATUS = ['pendiente', 'confirmada', 'completada', 'cancelada'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const staff = verifyStaff(req);
  if (!staff) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    // Auto-migrate: add therapist_id if missing
    try {
      await conn.execute(`ALTER TABLE appointments ADD COLUMN therapist_id INT NULL`);
    } catch(e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

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
        `SELECT a.*, p.id AS pid, tu.name AS therapist_name
         FROM appointments a
         LEFT JOIN patients p ON p.phone = a.phone
         LEFT JOIN therapist_users tu ON tu.id = a.therapist_id
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

      if (staff.role === 'therapist') {
        // Registrar qué fisioterapeuta atendió / confirmó esta cita
        await conn.execute(
          'UPDATE appointments SET status = ?, therapist_id = ? WHERE id = ?',
          [status, staff.id, id]
        );
      } else {
        await conn.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
      }
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
