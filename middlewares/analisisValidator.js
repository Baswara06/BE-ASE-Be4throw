const { body, param } = require('express-validator');

const kondisiRules = [
  body('beratKg')
    .optional({ values: 'null' })
    .isFloat({ gt: 0, max: 1000 }).withMessage('Berat harus angka lebih dari 0 dan maksimal 1000 kg')
    .toFloat(),

  body('jawaban')
    .optional()
    .isObject().withMessage('jawaban harus berupa objek'),

  body('kirim')
    .optional()
    .isBoolean().withMessage('kirim harus true atau false')
    .toBoolean(),
];

const buatAnalisisRules = [
  body('barangId').isInt({ min: 1 }).withMessage('barangId harus berupa angka').toInt(),
  ...kondisiRules,
];

const idAnalisisRules = [
  param('id').isInt({ min: 1 }).withMessage('ID analisis harus berupa angka'),
];

module.exports = { buatAnalisisRules, kondisiRules, idAnalisisRules };