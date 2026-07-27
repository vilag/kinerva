const { verifyAdmin }     = require('./_adminAuth');
const { verifyTherapist } = require('./_therapistAuth');

/**
 * Verifica token de administrador O fisioterapeuta.
 * Retorna { role: 'admin'|'therapist', id, username } o null.
 */
function verifyStaff(req) {
  const admin = verifyAdmin(req);
  if (admin) return { role: 'admin', id: admin.id, username: admin.username };
  const fisio = verifyTherapist(req);
  if (fisio)  return { role: 'therapist', id: fisio.sub, username: fisio.username };
  return null;
}

module.exports = { verifyStaff };
