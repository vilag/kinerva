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

// ── Cron endpoint (llamado por cron-job.org cada minuto) ───────────
const sendNotifications = require('./api/cron/exercise-notifications-logic');

app.get('/api/cron/exercise-notifications', async (req, res) => {
  const token = req.query.token || req.headers['x-cron-token'];
  const cronToken = process.env.CRON_TOKEN;
  if (!cronToken || token !== cronToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await sendNotifications();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[cron]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Kinerva → http://localhost:${PORT}`);
});
