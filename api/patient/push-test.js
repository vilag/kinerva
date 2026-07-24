const { getConnection } = require('../_db');
const { verifyPatient } = require('../_patientAuth');
const webpush = require('web-push');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = verifyPatient(req);
  if (!session) return res.status(401).json({ error: 'No autorizado' });

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({
      error: 'VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY no están configurados en el servidor. Agrégalos al archivo .env y reinicia el servidor.',
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

    const [rows] = await conn.execute(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE patient_id = ? LIMIT 1',
      [session.sub]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Sin suscripción guardada. Cierra el portal, vuelve a abrirlo, activa notificaciones y prueba de nuevo.',
      });
    }

    const sub = rows[0];
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: '✅ Prueba Kinerva',
        body: 'Las notificaciones están funcionando correctamente.',
        tag: 'kinerva-test',
        url: '/paciente',
      })
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[push-test]', err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      if (conn) {
        await conn.execute(
          'DELETE FROM push_subscriptions WHERE patient_id = ?',
          [session.sub]
        ).catch(() => {});
      }
      return res.status(410).json({
        error: 'Suscripción expirada. Recarga el portal, activa las notificaciones de nuevo y prueba.',
      });
    }
    return res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
};
