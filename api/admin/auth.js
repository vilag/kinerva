const bcrypt = require('bcryptjs');
const { getConnection } = require('../_db');
const { signToken }     = require('../_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let conn;
  try {
    conn = await getConnection();

    // GET ?action=check  →  ¿existe algún admin?
    if (req.method === 'GET') {
      const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM admins');
      return res.json({ hasAdmins: cnt > 0 });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { action, username, password, confirm } = req.body || {};

    // Crear primer admin
    if (action === 'setup') {
      const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM admins');
      if (cnt > 0) return res.status(403).json({ success: false, message: 'Ya existe un administrador' });
      if (!username || username.length < 3)
        return res.status(400).json({ success: false, message: 'Usuario: mínimo 3 caracteres' });
      if (!password || password.length < 6)
        return res.status(400).json({ success: false, message: 'Contraseña: mínimo 6 caracteres' });
      if (password !== confirm)
        return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });

      const hash = await bcrypt.hash(password, 10);
      await conn.execute('INSERT INTO admins (username, password_hash) VALUES (?,?)', [username, hash]);
      return res.json({ success: true });
    }

    // Login
    if (action === 'login') {
      const [[admin]] = await conn.execute(
        'SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1',
        [username]
      );
      if (!admin || !(await bcrypt.compare(password, admin.password_hash)))
        return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });

      const token = signToken({ id: admin.id, username: admin.username });
      return res.json({ success: true, token, username: admin.username });
    }

    res.status(400).json({ success: false, message: 'Acción no reconocida' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
