const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyAdmin(req);
  if (!user) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    // ── GET: obtener paciente + citas + notas ─────────────────────
    if (req.method === 'GET') {
      const { id, phone } = req.query;
      let patient = null;

      if (id) {
        const [[p]] = await conn.execute('SELECT * FROM patients WHERE id = ? LIMIT 1', [parseInt(id)]);
        patient = p;
      } else if (phone) {
        let [[p]] = await conn.execute('SELECT * FROM patients WHERE phone = ? LIMIT 1', [phone]);
        if (!p) {
          // Auto-crear desde citas existentes
          const [[appt]] = await conn.execute(
            'SELECT name, phone, email FROM appointments WHERE phone = ? LIMIT 1', [phone]
          );
          if (appt) {
            await conn.execute(
              'INSERT INTO patients (name, phone, email) VALUES (?,?,?)',
              [appt.name, appt.phone, appt.email || null]
            );
            [[p]] = await conn.execute('SELECT * FROM patients WHERE phone = ? LIMIT 1', [phone]);
          }
        }
        patient = p;
      }

      if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

      const [appointments] = await conn.execute(
        'SELECT * FROM appointments WHERE phone = ? ORDER BY date DESC, hour DESC',
        [patient.phone]
      );
      const [notes] = await conn.execute(
        'SELECT * FROM patient_notes WHERE patient_id = ? ORDER BY created_at DESC',
        [patient.id]
      );

      return res.json({ patient, appointments, notes });
    }

    // ── PUT: actualizar datos del paciente ────────────────────────
    if (req.method === 'PUT') {
      const { id, name, email, birth_date, notes } = req.body || {};
      if (!id || !name) return res.status(400).json({ error: 'Datos incompletos' });

      await conn.execute(
        'UPDATE patients SET name=?, email=?, birth_date=?, notes=? WHERE id=?',
        [name.trim(), email?.trim() || null, birth_date || null, notes?.trim() || null, parseInt(id)]
      );
      return res.json({ success: true });
    }

    // ── POST: agregar o eliminar nota ─────────────────────────────
    if (req.method === 'POST') {
      const { action, patient_id, content, note_id } = req.body || {};

      if (action === 'add_note') {
        const text = content?.trim();
        if (!text || !patient_id) return res.status(400).json({ error: 'Datos incompletos' });
        const [result] = await conn.execute(
          'INSERT INTO patient_notes (patient_id, content, created_by) VALUES (?,?,?)',
          [parseInt(patient_id), text, user.username]
        );
        return res.json({ success: true, note_id: result.insertId });
      }

      if (action === 'delete_note') {
        if (!note_id || !patient_id) return res.status(400).json({ error: 'Datos incompletos' });
        await conn.execute(
          'DELETE FROM patient_notes WHERE id = ? AND patient_id = ?',
          [parseInt(note_id), parseInt(patient_id)]
        );
        return res.json({ success: true });
      }

      return res.status(400).json({ error: 'Acción no reconocida' });
    }

    res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
