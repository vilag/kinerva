const bcrypt = require('bcryptjs');
const { getConnection } = require('../_db');
const { verifyAdmin }   = require('../_adminAuth');
const { validatePassword } = require('../_therapistAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, error: 'No autorizado' });

  let conn;
  try {
    conn = await getConnection();

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

    /* GET — lista */
    if (req.method === 'GET') {
      const [rows] = await conn.execute(
        `SELECT id, name, username, email, phone, specialty, is_active,
                failed_attempts, locked_until, created_at, last_login
         FROM therapist_users ORDER BY created_at DESC`
      );
      return res.json({ success: true, therapists: rows });
    }

    /* POST — crear */
    if (req.method === 'POST') {
      const { name, username, email, password, specialty, phone } = req.body || {};
      if (!name || !username || !password)
        return res.status(400).json({ success: false, error: 'Nombre, usuario y contraseña son obligatorios' });

      const passError = validatePassword(password);
      if (passError)
        return res.status(400).json({ success: false, error: passError });

      const hash = await bcrypt.hash(password, 12);
      const clean = String(username).trim().toLowerCase().slice(0, 60);

      try {
        await conn.execute(
          `INSERT INTO therapist_users (name, username, email, phone, specialty, password_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name.trim().slice(0, 150), clean,
           email?.trim().slice(0, 120) || null,
           phone?.trim().slice(0, 30) || null,
           specialty?.trim().slice(0, 120) || null,
           hash]
        );
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
          return res.status(409).json({ success: false, error: 'Ese usuario o correo ya existe' });
        throw e;
      }
      return res.json({ success: true });
    }

    /* PATCH — editar */
    if (req.method === 'PATCH') {
      const { id } = req.query || {};
      const { name, username, email, phone, specialty, is_active, password, unlock } = req.body || {};
      if (!id) return res.status(400).json({ success: false, error: 'id requerido' });

      const sets = [];
      const vals = [];

      if (name)      { sets.push('name = ?');      vals.push(name.trim().slice(0, 150)); }
      if (username)  { sets.push('username = ?');  vals.push(String(username).trim().toLowerCase().slice(0, 60)); }
      if (email !== undefined) { sets.push('email = ?'); vals.push(email?.trim().slice(0, 120) || null); }
      if (phone !== undefined) { sets.push('phone = ?'); vals.push(phone?.trim().slice(0, 30) || null); }
      if (specialty !== undefined) { sets.push('specialty = ?'); vals.push(specialty?.trim().slice(0, 120) || null); }
      if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }

      // Desbloquear cuenta manualmente
      if (unlock) {
        sets.push('failed_attempts = 0', 'locked_until = NULL');
      }

      if (password) {
        const passError = validatePassword(password);
        if (passError)
          return res.status(400).json({ success: false, error: passError });
        sets.push('password_hash = ?');
        vals.push(await bcrypt.hash(password, 12));
      }

      if (!sets.length)
        return res.status(400).json({ success: false, error: 'Sin campos a actualizar' });

      vals.push(id);
      try {
        await conn.execute(`UPDATE therapist_users SET ${sets.join(', ')} WHERE id = ?`, vals);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
          return res.status(409).json({ success: false, error: 'Ese usuario o correo ya existe' });
        throw e;
      }
      return res.json({ success: true });
    }

    /* DELETE — eliminar permanentemente */
    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ success: false, error: 'id requerido' });
      await conn.execute('DELETE FROM therapist_users WHERE id = ?', [id]);
      return res.json({ success: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('[admin/therapists]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
