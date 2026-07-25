const jwt = require('jsonwebtoken');

const SECRET = process.env.THERAPIST_JWT_SECRET || 'kinerva-therapist-dev-secret-CHANGE-IN-PROD';

function verifyTherapist(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.slice(7), SECRET); }
  catch { return null; }
}

function signTherapistToken(payload, rememberMe = false) {
  return jwt.sign(payload, SECRET, { expiresIn: rememberMe ? '7d' : '2h' });
}

function validatePassword(pass) {
  if (!pass || pass.length < 8)       return 'Mínimo 8 caracteres';
  if (!/[A-Z]/.test(pass))            return 'Debe incluir al menos una mayúscula';
  if (!/[0-9]/.test(pass))            return 'Debe incluir al menos un número';
  if (!/[^A-Za-z0-9]/.test(pass))    return 'Debe incluir al menos un carácter especial (!@#$%...)';
  return null;
}

module.exports = { verifyTherapist, signTherapistToken, validatePassword };
