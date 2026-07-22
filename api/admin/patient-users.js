const bcrypt            = require('bcryptjs');
const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    /* GET — lista de pacientes del portal */
    if (req.method === 'GET') {
      const [users] = await conn.execute(
        `SELECT pu.id, pu.username, pu.name, pu.phone, pu.birth_date,
                pu.created_at, pu.last_login,
                COUNT(r.id) AS routine_count
         FROM patient_users pu
         LEFT JOIN routines r ON r.patient_id = pu.id
         GROUP BY pu.id
         ORDER BY pu.created_at DESC`
      );
      return res.json({ success: true, users });
    }

    /* POST — crear paciente */
    if (req.method === 'POST') {
      const { name, username, password } = req.body || {};
      if (!name || !username || !password)
        return res.status(400).json({ success: false, message: 'Nombre, usuario y contraseña son obligatorios' });

      const clean = username.trim().toLowerCase();
      const hash  = await bcrypt.hash(password, 10);

      try {
        await conn.execute(
          'INSERT INTO patient_users (name, username, password_hash) VALUES (?, ?, ?)',
          [name.trim(), clean, hash]
        );
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
          return res.status(409).json({ success: false, message: 'Ese usuario ya existe' });
        throw e;
      }
      return res.json({ success: true });
    }

    /* DELETE — eliminar paciente */
    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ success: false, message: 'id requerido' });
      await conn.execute('DELETE FROM patient_users WHERE id = ?', [id]);
      return res.json({ success: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
