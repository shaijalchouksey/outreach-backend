const express = require('express');
const router = express.Router();
const { getTikTokData } = require('../controllers/intentController');
const authMiddleware = require('../middleware/authMiddleware');

// (1) Naya endpoint: GET /api/v1/intent/tiktok
// (2) Yeh protected hai: Sirf logged-in user hi ise call kar sakta hai.
router.get('/tiktok', authMiddleware, getTikTokData);

module.exports = router;