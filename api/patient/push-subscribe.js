const { getConnection } = require('../_db');
const { verifyPatient } = require('../_patientAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = verifyPatient(req);
  if (!session) return res.status(401).json({ success: false });

  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end();

  const { endpoint, keys } = req.body || {};
  if (!endpoint) return res.status(400).json({ success: false, message: 'endpoint requerido' });

  let conn;
  try {
    conn = await getConnection();

    // Auto-create table if missing
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        endpoint   VARCHAR(600) NOT NULL,
        p256dh     VARCHAR(300) NOT NULL,
        auth       VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_endpoint (endpoint(255))
      )
    `);

    if (req.method === 'POST') {
      if (!keys?.p256dh || !keys?.auth)
        return res.status(400).json({ success: false, message: 'keys incompletas' });
      await conn.execute(
        `INSERT INTO push_subscriptions (patient_id, endpoint, p256dh, auth)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           patient_id = VALUES(patient_id),
           p256dh     = VALUES(p256dh),
           auth       = VALUES(auth)`,
        [session.sub, endpoint, keys.p256dh, keys.auth]
      );
      return res.json({ success: true });
    }

    // DELETE — unsubscribe
    await conn.execute(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND patient_id = ?',
      [endpoint, session.sub]
    );
    return res.json({ success: true });

  } catch (err) {
    console.error('[push-subscribe]', err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
