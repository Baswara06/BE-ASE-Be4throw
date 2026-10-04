const bcrypt = require('bcrypt');
const prisma = require('../utils/prisma');
const { createToken } = require('../utils/token');
const { success, fail } = require('../utils/response');

const SALT_ROUNDS = 10;

// Remove passwordHash before sending user data to the client
function toPublicUser(user) {
  const { passwordHash, ...publicData } = user;
  return publicData;
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { nama, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail(res, 409, 'Email sudah terdaftar. Gunakan email lain atau masuk dengan akun tersebut.');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // role is NOT taken from req.body, so nobody can register as admin
    const user = await prisma.user.create({
      data: { nama, email, passwordHash },
    });

    return success(res, 201, 'Pendaftaran berhasil. Silakan masuk.', toPublicUser(user));
  } catch (err) {
    // P2002 = unique constraint failed (two people registering the same email at the same time)
    if (err.code === 'P2002') {
      return fail(res, 409, 'Email sudah terdaftar. Gunakan email lain atau masuk dengan akun tersebut.');
    }
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password, ingatSaya } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

    // Same message for "email not found" and "wrong password"
    if (!passwordOk) {
      return fail(res, 401, 'Email atau password salah');
    }

    if (user.status !== 'aktif') {
      return fail(res, 403, 'Akun sedang nonaktif. Hubungi admin.');
    }

    const { token, expiresIn } = createToken(user, ingatSaya);

    return success(res, 200, 'Berhasil masuk', {
      token,
      expiresIn,
      user: toPublicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return fail(res, 404, 'Akun tidak ditemukan');
    }
    return success(res, 200, 'Data akun berhasil diambil', toPublicUser(user));
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };