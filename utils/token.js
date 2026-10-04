const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET belum diset di .env');
}

// Create a JWT. 30 days if "ingat saya" is checked, otherwise 1 day.
function createToken(user, rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : '1d';
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn }
  );
  return { token, expiresIn };
}

// Throws an error if the token is fake or expired
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { createToken, verifyToken };