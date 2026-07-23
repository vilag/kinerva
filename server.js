require('dotenv').config();

const express  = require('express');
const path     = require('path');
const cron     = require('node-cron');
const app      = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname)));

// ── API routes ─────────────────────────────────────────────────────────────
const routes = {
  '/api/get_slots':          './api/get_slots',
  '/api/book':               './api/book',
  '/api/test':               './api/test',
  '/api/admin/auth':         './api/admin/auth',
  '/api/admin/dashboard':    './api/admin/dashboard',
  '/api/admin/appointments': './api/admin/appointments',
  '/api/admin/patients':     './api/admin/patients',
  '/api/admin/patient':      './api/admin/patient',
  '/api/admin/expediente':   './api/admin/expediente',
  '/api/admin/expedientes':  './api/admin/expedientes',
  '/api/admin/prospects':       './api/admin/prospects',
  '/api/admin/patient-users':   './api/admin/patient-users',
  '/api/admin/patient-routines':'./api/admin/patient-routines',
  '/api/prospects':             './api/prospects',
  '/api/auth/patient':          './api/auth/patient',
  '/api/patient/me':              './api/patient/me',
  '/api/patient/routines':        './api/patient/routines',
  '/api/patient/push-subscribe':  './api/patient/push-subscribe',
};

for (const [route, file] of Object.entries(routes)) {
  app.all(route, (req, res, next) =>
    Promise.resolve(require(file)(req, res)).catch(next)
  );
}

app.use((err, req, res, _next) => {
  console.error(err.message);
  if (!res.headersSent) res.status(500).json({ error: err.message });
});

// ── Admin SPA ──────────────────────────────────────────────────────────────
app.get(['/admin', '/admin/'], (req, res) =>
  res.sendFile(path.join(__dirname, 'admin/index.html'))
);

app.get(['/portal', '/portal/'], (req, res) =>
  res.sendFile(path.join(__dirname, 'portal/index.html'))
);

app.get(['/paciente', '/paciente/'], (req, res) =>
  res.sendFile(path.join(__dirname, 'paciente/index.html'))
);

app.get(['/privacidad', '/privacidad/'], (req, res) =>
  res.sendFile(path.join(__dirname, 'privacidad/index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Kinerva → http://localhost:${PORT}`);

  // ── Cron: notificaciones de ejercicio (cada minuto) ──────────────
  const sendNotifications = require('./api/cron/exercise-notifications-logic');
  cron.schedule('* * * * *', async () => {
    try {
      const result = await sendNotifications();
      if (result?.sent > 0) console.log(`[cron] notificaciones enviadas: ${result.sent} (${result.time})`);
    } catch (err) {
      console.error('[cron] exercise-notifications error:', err.message);
    }
  });
});
