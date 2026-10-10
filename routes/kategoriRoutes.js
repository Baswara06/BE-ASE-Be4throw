const express = require('express');
const { listKategori } = require('../controllers/kategoriController');

const router = express.Router();

// Publik: analisis boleh tanpa login
router.get('/', listKategori);

module.exports = router;