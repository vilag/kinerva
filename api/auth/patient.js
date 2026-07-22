const bcrypt             = require('bcryptjs');
const { getConnection }  = require('../_db');
const { signPatientToken } = require('../_patientAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });

  let conn;
  try {
    conn = await getConnection();
    const [[user]] = await conn.execute(
      'SELECT id, name, username, phone, birth_date, password_hash FROM patient_users WHERE username = ?',
      [username.trim().toLowerCase()]
    );
    if (!user)
      return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });

    await conn.execute('UPDATE patient_users SET last_login = NOW() WHERE id = ?', [user.id]);

    const { password_hash, ...safeUser } = user;
    const token = signPatientToken({ sub: user.id, username: user.username });
    return res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
