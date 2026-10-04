const { body } = require('express-validator');

const registerRules = [
  body('nama')
    .trim()
    .notEmpty().withMessage('Nama wajib diisi')
    .isLength({ max: 100 }).withMessage('Nama maksimal 100 karakter'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email wajib diisi').bail()
    .isEmail().withMessage('Format email tidak valid').bail()
    .toLowerCase(),

  body('password')
    .notEmpty().withMessage('Password wajib diisi').bail()
    .isLength({ min: 8, max: 72 }).withMessage('Password harus 8–72 karakter').bail()
    .matches(/[A-Za-z]/).withMessage('Password harus mengandung huruf')
    .matches(/\d/).withMessage('Password harus mengandung angka'),

  body('konfirmasiPassword')
    .notEmpty().withMessage('Konfirmasi password wajib diisi').bail()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Konfirmasi password tidak sama'),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email wajib diisi').bail()
    .isEmail().withMessage('Format email tidak valid').bail()
    .toLowerCase(),

  body('password').notEmpty().withMessage('Password wajib diisi'),

  body('ingatSaya')
    .optional()
    .isBoolean().withMessage('ingatSaya harus true atau false')
    .toBoolean(),
];

module.exports = { registerRules, loginRules };