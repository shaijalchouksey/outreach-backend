const express = require('express');
const router = express.Router();
const { getTikTokData, saveSearchHistory, saveTikTokPosts } = require('../controllers/intentController');
const authMiddleware = require('../middleware/authMiddleware');

// (1) Naya endpoint: GET /api/v1/intent/tiktok
// (2) Yeh protected hai: Sirf logged-in user hi ise call kar sakta hai.
router.get('/tiktok', authMiddleware, getTikTokData);

// (3) Search history save karne ke liye endpoint
// POST /api/v1/intent/search-history
router.post('/search-history', authMiddleware, saveSearchHistory);

// (4) TikTok posts data save karne ke liye endpoint
// POST /api/v1/intent/tiktok-posts
router.post('/tiktok-posts', authMiddleware, saveTikTokPosts);

module.exports = router;
