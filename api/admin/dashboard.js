const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    const now   = new Date();
    const today = now.toISOString().slice(0, 10);

    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart  = mon.toISOString().slice(0, 10);
    const weekEnd    = new Date(mon.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [[{ t }]] = await conn.execute('SELECT COUNT(*) AS t FROM appointments WHERE date = ?', [today]);
    const [[{ w }]] = await conn.execute('SELECT COUNT(*) AS w FROM appointments WHERE date BETWEEN ? AND ?', [weekStart, weekEnd]);
    const [[{ m }]] = await conn.execute('SELECT COUNT(*) AS m FROM appointments WHERE date BETWEEN ? AND ?', [monthStart, monthEnd]);
    const [[{ p }]] = await conn.execute('SELECT COUNT(*) AS p FROM patients');

    const [todayAppts] = await conn.execute(
      'SELECT * FROM appointments WHERE date = ? ORDER BY hour', [today]
    );
    const [upcoming] = await conn.execute(
      `SELECT * FROM appointments
       WHERE date > ? AND date <= DATE_ADD(?, INTERVAL 7 DAY)
         AND (status IS NULL OR status != 'cancelada')
       ORDER BY date, hour LIMIT 10`,
      [today, today]
    );

    res.json({
      stats:       { today: t, week: w, month: m, patients: p },
      todayAppts,
      upcoming,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
