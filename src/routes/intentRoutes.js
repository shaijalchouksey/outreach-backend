const express = require('express');
const router = express.Router();
const { getTikTokData, getStoredTikTokPosts } = require('../controllers/intentController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/tiktok', authMiddleware, getTikTokData);
router.get('/tiktok-posts', authMiddleware, getStoredTikTokPosts);

module.exports = router;
