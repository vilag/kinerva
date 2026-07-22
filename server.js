// Servidor de desarrollo local — equivalente a `vercel dev`
// Uso: node server.js  (o: npm run dev)
require('dotenv').config();

const express = require('express');
const path    = require('path');
const app     = express();

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
  '/api/patient/me':            './api/patient/me',
  '/api/patient/routines':      './api/patient/routines',
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
app.listen(PORT, () =>
  console.log(`\n🚀  Kinerva dev → http://localhost:${PORT}\n   Admin      → http://localhost:${PORT}/admin\n`)
);
