const express = require('express');
const validate = require('../middlewares/validate');
const { optionalAuth } = require('../middlewares/auth');
const {
  buatAnalisisRules,
  kondisiRules,
  idAnalisisRules,
} = require('../middlewares/analisisValidator');
const {
  buatAnalisis,
  ambilAnalisis,
  updateKondisi,
} = require('../controllers/analisisController');

const router = express.Router();

// Boleh tamu (keputusan tim 11 Okt); tamu wajib kirim header X-Kode-Akses untuk GET/PUT
router.post('/', optionalAuth, buatAnalisisRules, validate, buatAnalisis);
router.get('/:id', optionalAuth, idAnalisisRules, validate, ambilAnalisis);
router.put('/:id/kondisi', optionalAuth, idAnalisisRules, kondisiRules, validate, updateKondisi);

module.exports = router;