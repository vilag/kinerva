const { getConnection } = require('../_db');
const { verifyPatient } = require('../_patientAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const session = verifyPatient(req);
  if (!session) return res.status(401).json({ success: false, message: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();
    const [routines] = await conn.execute(
      'SELECT id, title, description, status, created_at FROM routines WHERE patient_id = ? ORDER BY created_at DESC',
      [session.sub]
    );
    for (const r of routines) {
      const [exercises] = await conn.execute(
        `SELECT id, name, description, sets, reps, duration_seconds, video_url, schedule_times, sort_order
         FROM routine_exercises WHERE routine_id = ? ORDER BY sort_order ASC`,
        [r.id]
      );
      r.exercises = exercises;
    }
    return res.json({ success: true, routines });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
