const bcrypt = require('bcryptjs');
const { getConnection }     = require('../_db');
const { signToken }         = require('../_adminAuth');
const { signPatientToken }  = require('../_patientAuth');
const { signTherapistToken } = require('../_therapistAuth');

const MAX_ATTEMPTS    = 5;
const LOCKOUT_MINUTES = 15;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password, rememberMe } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  const user = String(username).trim().toLowerCase().slice(0, 60);
  const pass = String(password).slice(0, 128);
  const GENERIC = 'Usuario o contraseña incorrectos';

  let conn;
  try {
    conn = await getConnection();

    /* ── 1. Admin ──────────────────────────────────────────────── */
    const [[admin]] = await conn.execute(
      'SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1',
      [user]
    );
    if (admin) {
      if (await bcrypt.compare(pass, admin.password_hash)) {
        const token = signToken({ id: admin.id, username: admin.username });
        return res.json({ success: true, type: 'admin', token,
          user: { name: admin.username, username: admin.username } });
      }
      // Contraseña incorrecta pero el username era de admin → error genérico
      return res.status(401).json({ error: GENERIC });
    }

    /* ── 2. Fisioterapeuta ─────────────────────────────────────── */
    const [[therapist]] = await conn.execute(
      `SELECT id, name, username, password_hash, is_active, failed_attempts, locked_until
       FROM therapist_users WHERE username = ? LIMIT 1`,
      [user]
    ).catch(() => [[]]);   // tabla puede no existir aún

    if (therapist) {
      if (!therapist.is_active)
        return res.status(401).json({ error: GENERIC });

      if (therapist.locked_until && new Date(therapist.locked_until) > new Date()) {
        const min = Math.ceil((new Date(therapist.locked_until) - Date.now()) / 60000);
        return res.status(429).json({
          error: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${min} minuto${min !== 1 ? 's' : ''}.`,
        });
      }

      if (await bcrypt.compare(pass, therapist.password_hash)) {
        await conn.execute(
          'UPDATE therapist_users SET failed_attempts=0, locked_until=NULL, last_login=NOW() WHERE id=?',
          [therapist.id]
        );
        const token = signTherapistToken({ sub: therapist.id, username: therapist.username }, !!rememberMe);
        return res.json({ success: true, type: 'therapist', token,
          user: { name: therapist.name, username: therapist.username } });
      }

      // Contraseña incorrecta — registrar intento fallido
      const attempts = therapist.failed_attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await conn.execute(
          'UPDATE therapist_users SET failed_attempts=?, locked_until=? WHERE id=?',
          [attempts, lockUntil, therapist.id]
        );
        return res.status(429).json({
          error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_MINUTES} minutos.`,
        });
      }
      await conn.execute(
        'UPDATE therapist_users SET failed_attempts=? WHERE id=?',
        [attempts, therapist.id]
      );
      return res.status(401).json({ error: GENERIC });
    }

    /* ── 3. Paciente ───────────────────────────────────────────── */
    const [[patient]] = await conn.execute(
      'SELECT id, name, username, phone, birth_date, password_hash FROM patient_users WHERE username = ? LIMIT 1',
      [user]
    ).catch(() => [[]]);

    if (patient) {
      if (await bcrypt.compare(pass, patient.password_hash)) {
        await conn.execute('UPDATE patient_users SET last_login=NOW() WHERE id=?', [patient.id]);
        const token = signPatientToken({ sub: patient.id, username: patient.username });
        return res.json({ success: true, type: 'patient', token,
          user: { name: patient.name, username: patient.username } });
      }
      return res.status(401).json({ error: GENERIC });
    }

    // Usuario no encontrado en ninguna tabla
    await bcrypt.hash('timing-equalization', 10); // prevenir timing attack
    return res.status(401).json({ error: GENERIC });

  } catch (err) {
    console.error('[auth/login]', err.message);
    return res.status(500).json({ error: 'Error interno' });
  } finally {
    if (conn) await conn.end();
  }
};
