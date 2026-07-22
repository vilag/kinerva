const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: 'No autorizado' });

  const q = req.query || {};
  let conn;
  try {
    conn = await getConnection();

    /* GET — listar rutinas de un paciente */
    if (req.method === 'GET') {
      if (!q.patient_id) return res.status(400).json({ success: false, message: 'patient_id requerido' });
      const [routines] = await conn.execute(
        'SELECT id, title, description, status, created_at FROM routines WHERE patient_id = ? ORDER BY created_at DESC',
        [q.patient_id]
      );
      for (const r of routines) {
        const [exs] = await conn.execute(
          'SELECT id, name, description, sets, reps, duration_seconds, video_url, sort_order FROM routine_exercises WHERE routine_id = ? ORDER BY sort_order ASC',
          [r.id]
        );
        r.exercises = exs;
      }
      return res.json({ success: true, routines });
    }

    /* POST — crear rutina o agregar ejercicio */
    if (req.method === 'POST') {
      const body = req.body || {};

      if (q.action === 'add-exercise') {
        if (!q.routine_id || !body.name)
          return res.status(400).json({ success: false, message: 'routine_id y name requeridos' });
        const [[{ maxOrd }]] = await conn.execute(
          'SELECT COALESCE(MAX(sort_order),0) AS maxOrd FROM routine_exercises WHERE routine_id = ?',
          [q.routine_id]
        );
        await conn.execute(
          `INSERT INTO routine_exercises (routine_id, name, description, sets, reps, duration_seconds, video_url, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [q.routine_id, body.name, body.description || null, body.sets || null,
           body.reps || null, body.duration_seconds || null, body.video_url || null, maxOrd + 1]
        );
        return res.json({ success: true });
      }

      // crear rutina
      if (!q.patient_id || !body.title)
        return res.status(400).json({ success: false, message: 'patient_id y title requeridos' });
      const [result] = await conn.execute(
        'INSERT INTO routines (patient_id, title, description) VALUES (?, ?, ?)',
        [q.patient_id, body.title, body.description || null]
      );
      return res.json({ success: true, routine_id: result.insertId });
    }

    /* PATCH — actualizar rutina o ejercicio */
    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (q.action === 'exercise') {
        await conn.execute(
          `UPDATE routine_exercises
           SET name             = COALESCE(?, name),
               description      = COALESCE(?, description),
               sets             = COALESCE(?, sets),
               reps             = COALESCE(?, reps),
               duration_seconds = COALESCE(?, duration_seconds),
               video_url        = COALESCE(?, video_url)
           WHERE id = ?`,
          [body.name || null, body.description || null, body.sets || null,
           body.reps || null, body.duration_seconds || null, body.video_url || null, q.exercise_id]
        );
      } else {
        await conn.execute(
          'UPDATE routines SET title = COALESCE(?,title), description = COALESCE(?,description), status = COALESCE(?,status) WHERE id = ?',
          [body.title || null, body.description || null, body.status || null, q.routine_id]
        );
      }
      return res.json({ success: true });
    }

    /* DELETE — eliminar rutina o ejercicio */
    if (req.method === 'DELETE') {
      if (q.action === 'exercise') {
        await conn.execute('DELETE FROM routine_exercises WHERE id = ?', [q.exercise_id]);
      } else {
        await conn.execute('DELETE FROM routines WHERE id = ?', [q.routine_id]);
      }
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
