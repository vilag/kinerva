const { getConnection }  = require('../_db');
const { verifyPatient }  = require('../_patientAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = verifyPatient(req);
  if (!session) return res.status(401).json({ success: false, message: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    if (req.method === 'GET') {
      const [[user]] = await conn.execute(
        'SELECT id, name, email, picture, phone, birth_date, created_at FROM patient_users WHERE id = ?',
        [session.sub]
      );
      return res.json({ success: true, user });
    }

    if (req.method === 'PATCH') {
      const { name, phone, birth_date } = req.body || {};
      await conn.execute(
        `UPDATE patient_users
         SET name       = COALESCE(?, name),
             phone      = COALESCE(?, phone),
             birth_date = COALESCE(?, birth_date)
         WHERE id = ?`,
        [name || null, phone || null, birth_date || null, session.sub]
      );
      const [[user]] = await conn.execute(
        'SELECT id, name, email, picture, phone, birth_date, created_at FROM patient_users WHERE id = ?',
        [session.sub]
      );
      return res.json({ success: true, user });
    }

    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
