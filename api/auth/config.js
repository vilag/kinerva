module.exports = async function handler(req, res) {
  return res.status(410).json({ success: false, message: 'Endpoint no disponible' });
};
