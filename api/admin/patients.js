const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  let conn;
  try {
    conn = await getConnection();

    const q = (req.query.q || '').trim();
    const like = `%${q}%`;

    const [patients] = await conn.execute(
      `SELECT p.id, p.name, p.phone, p.email, p.created_at,
              COUNT(a.id)  AS total_appts,
              MAX(a.date)  AS last_appt
       FROM patients p
       LEFT JOIN appointments a ON a.phone = p.phone
       WHERE ${q ? '(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)' : '1=1'}
       GROUP BY p.id
       ORDER BY last_appt DESC, p.name
       LIMIT 200`,
      q ? [like, like, like] : []
    );

    res.json({ patients });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
