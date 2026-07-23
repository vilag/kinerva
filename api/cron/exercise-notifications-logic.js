const { getConnection } = require('../_db');
const webpush = require('web-push');

// Llamado una sola vez al iniciar el servidor
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contacto@kinervafisioterapia.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

module.exports = async function sendExerciseNotifications() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  let conn;
  try {
    conn = await getConnection();

    // Hora actual en México (UTC-6, sin horario de verano desde 2023)
    const mxNow = new Date(Date.now() - 6 * 60 * 60 * 1000);
    mxNow.setMinutes(mxNow.getMinutes() + 5);
    const target = `${String(mxNow.getHours()).padStart(2,'0')}:${String(mxNow.getMinutes()).padStart(2,'0')}`;

    // Ejercicios con ese horario en rutinas activas
    const [exercises] = await conn.execute(
      `SELECT re.id, re.name, r.patient_id, r.title AS routine_title
       FROM routine_exercises re
       JOIN routines r ON r.id = re.routine_id
       WHERE r.status = 'activa'
         AND re.schedule_times IS NOT NULL
         AND JSON_CONTAINS(re.schedule_times, JSON_QUOTE(?))`,
      [target]
    );

    if (!exercises.length) return { sent: 0, time: target };

    // Agrupar por paciente
    const byPatient = {};
    for (const ex of exercises) {
      (byPatient[ex.patient_id] = byPatient[ex.patient_id] || []).push(ex);
    }

    // Suscripciones push de esos pacientes
    const ids = Object.keys(byPatient);
    const ph  = ids.map(() => '?').join(',');
    const [subs] = await conn.execute(
      `SELECT patient_id, endpoint, p256dh, auth FROM push_subscriptions WHERE patient_id IN (${ph})`,
      ids
    );

    let sent = 0;
    const expired = [];

    for (const sub of subs) {
      for (const ex of (byPatient[sub.patient_id] || [])) {
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
          if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.endpoint);
        }
      }
    }

    // Limpiar suscripciones caducadas
    for (const ep of expired) {
      await conn.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [ep]);
    }

    return { sent, time: target, expired: expired.length };
  } finally {
    if (conn) await conn.end();
  }
};
