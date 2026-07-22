const jwt = require('jsonwebtoken');

const SECRET = process.env.PATIENT_JWT_SECRET || 'kinerva-patient-dev-secret';

function verifyPatient(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.slice(7), SECRET); }
  catch { return null; }
}

function signPatientToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

module.exports = { verifyPatient, signPatientToken };
