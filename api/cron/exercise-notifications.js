const { getConnection } = require('../_db');
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:contacto@kinervafisioterapia.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async function handler(req, res) {
  // Vercel sets Authorization: Bearer {CRON_SECRET} automatically for cron jobs
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let conn;
  try {
    conn = await getConnection();

    // Current time in Mexico (UTC-6, no DST since 2023)
    const utcNow = new Date();
    const mxNow  = new Date(utcNow.getTime() - 6 * 60 * 60 * 1000);
    mxNow.setMinutes(mxNow.getMinutes() + 5);
    const target = `${String(mxNow.getHours()).padStart(2,'0')}:${String(mxNow.getMinutes()).padStart(2,'0')}`;

    // Find exercises scheduled exactly at target time
    const [exercises] = await conn.execute(
      `SELECT re.id, re.name, r.patient_id, r.title AS routine_title
       FROM routine_exercises re
       JOIN routines r ON r.id = re.routine_id
       WHERE r.status = 'activa'
         AND re.schedule_times IS NOT NULL
         AND JSON_CONTAINS(re.schedule_times, JSON_QUOTE(?))`,
      [target]
    );

    if (!exercises.length) {
      return res.json({ success: true, sent: 0, time: target });
    }

    // Group exercises by patient_id
    const byPatient = {};
    for (const ex of exercises) {
      (byPatient[ex.patient_id] = byPatient[ex.patient_id] || []).push(ex);
    }

    // Load push subscriptions for matching patients
    const ids = Object.keys(byPatient);
    const placeholders = ids.map(() => '?').join(',');
    const [subs] = await conn.execute(
      `SELECT patient_id, endpoint, p256dh, auth
       FROM push_subscriptions WHERE patient_id IN (${placeholders})`,
      ids
    );

    let sent = 0;
    const expired = [];

    for (const sub of subs) {
      const exList = byPatient[sub.patient_id] || [];
      for (const ex of exList) {
        const payload = JSON.stringify({
          title: '⏰ Ejercicio en 5 minutos',
          body:  `${ex.name}  ·  ${ex.routine_title}`,
          tag:   `ex-${ex.id}-${target}`,
          url:   '/paciente',
        });
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err) {
          // 410 Gone / 404 = subscription no longer valid
          if (err.statusCode === 410 || err.statusCode === 404) {
            expired.push(sub.endpoint);
          }
        }
      }
    }

    // Clean up expired subscriptions
    for (const ep of expired) {
      await conn.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [ep]);
    }

    return res.json({ success: true, sent, time: target, expired: expired.length });
  } catch (err) {
    console.error('[exercise-notifications]', err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
