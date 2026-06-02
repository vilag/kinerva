// Servidor de desarrollo local — equivalente a `vercel dev`
// Uso: node server.js  (o: npm run dev)
require('dotenv').config();

const express = require('express');
const path    = require('path');
const app     = express();

app.use(express.json());
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
};

for (const [route, file] of Object.entries(routes)) {
  app.all(route, (req, res) => require(file)(req, res));
}

// ── Admin SPA ──────────────────────────────────────────────────────────────
app.get(['/admin', '/admin/'], (req, res) =>
  res.sendFile(path.join(__dirname, 'admin/index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`\n🚀  Kinerva dev → http://localhost:${PORT}\n   Admin      → http://localhost:${PORT}/admin\n`)
);
