const fs   = require('fs');
const path = require('path');
const { getConnection } = require('../_db');
const { verifyTherapist } = require('../_therapistAuth');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'therapist-photos');
const MAX_BYTES  = 2 * 1024 * 1024; // 2 MB
const ALLOWED    = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const session = verifyTherapist(req);
  if (!session) return res.status(401).json({ error: 'No autorizado' });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Imagen requerida' });

  // Parsear data URL: "data:image/jpeg;base64,..."
  const match = String(image).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Formato de imagen inválido' });

  const [, mime, b64] = match;
  const ext = ALLOWED[mime];
  if (!ext) return res.status(400).json({ error: 'Solo se permiten imágenes JPG, PNG o WEBP' });

  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length > MAX_BYTES)
    return res.status(400).json({ error: 'La imagen no puede superar 2 MB' });

  // Crear directorio si no existe
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const filename  = `therapist-${session.sub}.${ext}`;
  const filepath  = path.join(UPLOAD_DIR, filename);
  const urlPath   = `/uploads/therapist-photos/${filename}`;

  fs.writeFileSync(filepath, buffer);

  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      'UPDATE therapist_users SET photo_path = ? WHERE id = ?',
      [urlPath, session.sub]
    );
    return res.json({ success: true, photo_path: urlPath });
  } catch (err) {
    console.error('[therapist/photo]', err.message);
    return res.status(500).json({ error: 'Error al guardar en base de datos' });
  } finally {
    if (conn) await conn.end();
  }
};
