module.exports = async function handler(req, res) {
  return res.status(410).json({ success: false, message: 'Google Sign-In ya no está disponible' });
};
