const bcrypt = require('bcryptjs');
const { getConnection } = require('../_db');
const { signTherapistToken } = require('../_therapistAuth');

const MAX_ATTEMPTS = 5;
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

  // Sanitize: strip whitespace, limit length to prevent excessive hashing
  const user = String(username).trim().toLowerCase().slice(0, 60);
  const pass = String(password).slice(0, 128);

  let conn;
  try {
    conn = await getConnection();

    // Auto-crear tabla si no existe
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS therapist_users (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(150) NOT NULL,
        username        VARCHAR(60) UNIQUE NOT NULL,
        email           VARCHAR(120) UNIQUE,
        phone           VARCHAR(30),
        specialty       VARCHAR(120),
        bio             TEXT,
        photo_path      VARCHAR(300),
        password_hash   VARCHAR(255) NOT NULL,
        is_active       TINYINT(1) NOT NULL DEFAULT 1,
        failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        locked_until    DATETIME NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login      DATETIME NULL
      )
    `);

    const [[therapist]] = await conn.execute(
      'SELECT * FROM therapist_users WHERE username = ? LIMIT 1',
      [user]
    );

    // Generic error — no revelar si el usuario existe o no
    const GENERIC = 'Credenciales incorrectas';

    if (!therapist || !therapist.is_active) {
      // Simular trabajo de bcrypt para prevenir timing attacks
      await bcrypt.hash('dummy', 12);
      return res.status(401).json({ error: GENERIC });
    }

    // Verificar bloqueo por intentos fallidos
    if (therapist.locked_until && new Date(therapist.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(therapist.locked_until) - Date.now()) / 60000);
      return res.status(429).json({
        error: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${remaining} minuto${remaining !== 1 ? 's' : ''}.`,
      });
    }

    const valid = await bcrypt.compare(pass, therapist.password_hash);

    if (!valid) {
      const newAttempts = therapist.failed_attempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await conn.execute(
          'UPDATE therapist_users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
          [newAttempts, lockUntil, therapist.id]
        );
        return res.status(429).json({
          error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_MINUTES} minutos.`,
        });
      }
      await conn.execute(
        'UPDATE therapist_users SET failed_attempts = ? WHERE id = ?',
        [newAttempts, therapist.id]
      );
      return res.status(401).json({ error: GENERIC });
    }

    // Login exitoso — resetear contadores y registrar acceso
    await conn.execute(
      'UPDATE therapist_users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
      [therapist.id]
    );

    const token = signTherapistToken(
      { sub: therapist.id, username: therapist.username },
      !!rememberMe
    );

    const { password_hash, failed_attempts, locked_until, ...safeUser } = therapist;
    return res.json({ success: true, token, user: safeUser });

  } catch (err) {
    console.error('[therapist-login]', err.message);
    return res.status(500).json({ error: 'Error interno' });
  } finally {
    if (conn) await conn.end();
  }
};
