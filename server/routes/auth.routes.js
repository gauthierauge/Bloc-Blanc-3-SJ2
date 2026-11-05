const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { loginLimiter } = require('../config/rateLimit');

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);

module.exports = router;
