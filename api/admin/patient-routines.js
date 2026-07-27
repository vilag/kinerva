const { getConnection } = require('../_db');
const { verifyStaff }   = require('../_staffAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyStaff(req)) return res.status(401).json({ success: false, message: 'No autorizado' });

  const q = req.query || {};
  let conn;
  try {
    conn = await getConnection();

    // Auto-migrate: add missing columns if they don't exist yet
    try {
      await conn.execute(
        `ALTER TABLE routine_exercises ADD COLUMN schedule_times VARCHAR(500) NULL AFTER video_url`
      );
    } catch(e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    try {
      await conn.execute(`ALTER TABLE routines ADD COLUMN start_date DATE NULL`);
    } catch(e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    try {
      await conn.execute(`ALTER TABLE routines ADD COLUMN end_date DATE NULL`);
    } catch(e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    /* GET — listar rutinas de un paciente */
    if (req.method === 'GET') {
      if (!q.patient_id) return res.status(400).json({ success: false, message: 'patient_id requerido' });
      const [routines] = await conn.execute(
        'SELECT id, title, description, status, start_date, end_date, created_at FROM routines WHERE patient_id = ? ORDER BY created_at DESC',
        [q.patient_id]
      );
      for (const r of routines) {
        const [exs] = await conn.execute(
          'SELECT id, name, description, sets, reps, duration_seconds, video_url, schedule_times, sort_order FROM routine_exercises WHERE routine_id = ? ORDER BY sort_order ASC',
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
          `INSERT INTO routine_exercises (routine_id, name, description, sets, reps, duration_seconds, video_url, schedule_times, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [q.routine_id, body.name, body.description || null, body.sets || null,
           body.reps || null, body.duration_seconds || null, body.video_url || null,
           body.schedule_times || null, maxOrd + 1]
        );
        return res.json({ success: true });
      }

      // crear rutina
      if (!q.patient_id || !body.title)
        return res.status(400).json({ success: false, message: 'patient_id y title requeridos' });
      const [result] = await conn.execute(
        'INSERT INTO routines (patient_id, title, description, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
        [q.patient_id, body.title, body.description || null,
         body.start_date || null, body.end_date || null]
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
               video_url        = COALESCE(?, video_url),
               schedule_times   = ?
           WHERE id = ?`,
          [body.name || null, body.description || null, body.sets || null,
           body.reps || null, body.duration_seconds || null, body.video_url || null,
           body.schedule_times ?? null, q.exercise_id]
        );
      } else {
        // Construir SET dinámico para no pisar campos no enviados
        const sets = [];
        const vals = [];
        if (body.title       !== undefined) { sets.push('title = ?');       vals.push(body.title || null); }
        if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description || null); }
        if (body.status      !== undefined) { sets.push('status = ?');      vals.push(body.status || null); }
        if ('start_date' in body) { sets.push('start_date = ?'); vals.push(body.start_date || null); }
        if ('end_date'   in body) { sets.push('end_date = ?');   vals.push(body.end_date   || null); }
        if (sets.length === 0) return res.json({ success: true });
        vals.push(q.routine_id);
        await conn.execute(`UPDATE routines SET ${sets.join(', ')} WHERE id = ?`, vals);
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
