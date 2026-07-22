const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: 'No autorizado' });
  if (req.method !== 'GET') return res.status(405).end();

  let conn;
  try {
    conn = await getConnection();
    const [users] = await conn.execute(
      `SELECT pu.id, pu.name, pu.email, pu.picture, pu.phone, pu.birth_date,
              pu.created_at, pu.last_login,
              COUNT(r.id) AS routine_count
       FROM patient_users pu
       LEFT JOIN routines r ON r.patient_id = pu.id
       GROUP BY pu.id
       ORDER BY pu.last_login DESC`
    );
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
