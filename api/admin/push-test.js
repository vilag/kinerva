const { getConnection } = require('../_db');
const { verifyStaff }   = require('../_staffAuth');
const webpush = require('web-push');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const staff = verifyStaff(req);
  if (!staff) return res.status(401).json({ error: 'No autorizado' });

  const { patient_id, patient_name } = req.body || {};
  if (!patient_id) return res.status(400).json({ error: 'patient_id requerido' });

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({
      error: 'VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY no están configurados en el servidor (.env).',
    });
  }

  webpush.setVapidDetails(
    'mailto:contacto@kinervafisioterapia.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  let conn;
  try {
    conn = await getConnection();

    const [rows] = await conn.execute(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE patient_id = ? LIMIT 5',
      [patient_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: `${patient_name || 'El paciente'} aún no tiene notificaciones activadas en su portal.`,
      });
    }

    let sent = 0;
    const expired = [];

    for (const sub of rows) {
      const payload = JSON.stringify({
        title: '📋 Kinerva — Mensaje de tu fisioterapeuta',
        body:  'Tienes una notificación de prueba de Kinerva Fisioterapia.',
        tag:   'admin-test',
        url:   '/paciente',
      });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.endpoint);
      }
    }

    for (const ep of expired) {
      await conn.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [ep]);
    }

    if (sent === 0) {
      return res.status(410).json({
        error: 'La suscripción del paciente está expirada. Debe reabrir el portal y activar notificaciones de nuevo.',
      });
    }

    return res.json({ success: true, sent });
  } catch (err) {
    console.error('[admin/push-test]', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
