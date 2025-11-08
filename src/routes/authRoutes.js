// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
// Controller se naye functions import karo
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');

// Puraane routes
router.post('/register', register);
router.post('/login', login);

// Naye routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;