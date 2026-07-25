const bcrypt = require('bcryptjs');
const { getConnection } = require('../_db');
const { verifyTherapist, validatePassword } = require('../_therapistAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = verifyTherapist(req);
  if (!session) return res.status(401).json({ error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

    if (req.method === 'GET') {
      const [[t]] = await conn.execute(
        `SELECT id, name, username, email, phone, specialty, bio, photo_path,
                is_active, created_at, last_login
         FROM therapist_users WHERE id = ? AND is_active = 1 LIMIT 1`,
        [session.sub]
      );
      if (!t) return res.status(404).json({ error: 'No encontrado' });
      return res.json({ success: true, user: t });
    }

    if (req.method === 'PUT') {
      const { name, email, phone, specialty, bio, currentPassword, newPassword } = req.body || {};

      if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

      const [[current]] = await conn.execute(
        'SELECT id, password_hash FROM therapist_users WHERE id = ? AND is_active = 1 LIMIT 1',
        [session.sub]
      );
      if (!current) return res.status(404).json({ error: 'No encontrado' });

      const sets = ['name = ?', 'email = ?', 'phone = ?', 'specialty = ?', 'bio = ?'];
      const vals = [
        name.trim().slice(0, 150),
        email?.trim().slice(0, 120) || null,
        phone?.trim().slice(0, 30) || null,
        specialty?.trim().slice(0, 120) || null,
        bio?.trim().slice(0, 1000) || null,
      ];

      // Cambio de contraseña opcional
      if (newPassword) {
        if (!currentPassword)
          return res.status(400).json({ error: 'Ingresa tu contraseña actual para cambiarla' });

        const ok = await bcrypt.compare(String(currentPassword).slice(0, 128), current.password_hash);
        if (!ok)
          return res.status(400).json({ error: 'Contraseña actual incorrecta' });

        const passError = validatePassword(newPassword);
        if (passError)
          return res.status(400).json({ error: passError });

        sets.push('password_hash = ?');
        vals.push(await bcrypt.hash(newPassword, 12));
      }

      vals.push(session.sub);
      await conn.execute(`UPDATE therapist_users SET ${sets.join(', ')} WHERE id = ?`, vals);

      const [[updated]] = await conn.execute(
        `SELECT id, name, username, email, phone, specialty, bio, photo_path,
                is_active, created_at, last_login
         FROM therapist_users WHERE id = ? LIMIT 1`,
        [session.sub]
      );
      return res.json({ success: true, user: updated });
    }

    return res.status(405).end();
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Ese correo ya está en uso' });
    console.error('[therapist/me]', err.message);
    return res.status(500).json({ error: 'Error interno' });
  } finally {
    if (conn) await conn.end();
  }
};
