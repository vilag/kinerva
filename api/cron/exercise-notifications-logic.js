const { getConnection } = require('../_db');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contacto@kinervafisioterapia.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

module.exports = async function sendExerciseNotifications() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { sent: 0, error: 'VAPID keys no configuradas' };
  }

  let conn;
  try {
    conn = await getConnection();

    // Hora actual en México (UTC-6, sin horario de verano desde 2023)
    const mxNow = new Date(Date.now() - 6 * 60 * 60 * 1000);
    mxNow.setMinutes(mxNow.getMinutes() + 5);
    const target = `${String(mxNow.getHours()).padStart(2,'0')}:${String(mxNow.getMinutes()).padStart(2,'0')}`;

    // Ejercicios con ese horario en rutinas activas, agrupados por el paciente dueño de la rutina
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

    // Agrupar ejercicios por patient_id (string para consistencia con Object.keys)
    const byPatient = {};
    for (const ex of exercises) {
      const pid = String(ex.patient_id);
      if (!byPatient[pid]) byPatient[pid] = [];
      byPatient[pid].push(ex);
    }

    // Buscar suscripciones SOLO de los pacientes que tienen ejercicio en este horario
    const patientIds = Object.keys(byPatient); // IDs de los pacientes con ejercicio ahora
    const ph = patientIds.map(() => '?').join(',');
    const [subs] = await conn.execute(
      `SELECT patient_id, endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE patient_id IN (${ph})`,
      patientIds
    );

    let sent = 0;
    const expired = [];
    const notified = new Set();

    for (const sub of subs) {
      const pid = String(sub.patient_id);
      const exercises = byPatient[pid] || []; // solo ejercicios de ESTE paciente

      for (const ex of exercises) {
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
          notified.add(pid);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.endpoint);
        }
      }
    }

    for (const ep of expired) {
      await conn.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [ep]);
    }

    return {
      sent,
      time: target,
      patients_with_exercise: patientIds.length,
      patients_notified: notified.size,
      expired: expired.length,
    };
  } finally {
    if (conn) await conn.end();
  }
};
