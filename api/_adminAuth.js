const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'kinerva-dev-secret-change-in-prod';

function verifyAdmin(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), SECRET);
  } catch {
    return null;
  }
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

module.exports = { verifyAdmin, signToken };
