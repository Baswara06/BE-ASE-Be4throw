const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { registerRules, loginRules } = require('../middlewares/authValidator');
const { requireAuth } = require('../middlewares/auth');
const { loginLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.get('/me', requireAuth, authController.me);

module.exports = router;