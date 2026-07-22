const { getConnection }    = require('../_db');
const { signPatientToken } = require('../_patientAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential } = req.body || {};
  if (!credential)
    return res.status(400).json({ success: false, message: 'Token requerido' });

  // Verify with Google's tokeninfo endpoint (no extra package needed)
  const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
  if (!gRes.ok)
    return res.status(401).json({ success: false, message: 'Token de Google inválido' });

  const gData = await gRes.json();
  if (gData.error)
    return res.status(401).json({ success: false, message: gData.error_description || 'Token inválido' });

  // Verify audience matches our client ID (if configured)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && gData.aud !== clientId)
    return res.status(401).json({ success: false, message: 'Audience no coincide' });

  const { sub: googleId, email, name, picture } = gData;

  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO patient_users (google_id, email, name, picture)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         name  = IF(VALUES(name) IS NOT NULL, VALUES(name), name),
         picture = COALESCE(VALUES(picture), picture),
         last_login = NOW()`,
      [googleId, email, name || email, picture || null]
    );
    const [[user]] = await conn.execute(
      'SELECT id, name, email, picture, phone, birth_date FROM patient_users WHERE google_id = ?',
      [googleId]
    );
    const token = signPatientToken({ sub: user.id, email: user.email, googleId });
    return res.json({ success: true, token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
