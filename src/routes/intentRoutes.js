const express = require('express');
const router = express.Router();
const { getTikTokData, getSearchHistory, saveSearchHistory, saveTikTokPosts, saveInstagramPosts } = require('../controllers/intentController');
const authMiddleware = require('../middleware/authMiddleware');

// (1) Naya endpoint: GET /api/v1/intent/tiktok
// (2) Yeh protected hai: Sirf logged-in user hi ise call kar sakta hai.
router.get('/tiktok', authMiddleware, getTikTokData);

// (3) Search history fetch karne ke liye endpoint
// GET /api/v1/intent/search-history?platform=tiktok&limit=10
router.get('/search-history', authMiddleware, getSearchHistory);

// (4) Search history save karne ke liye endpoint
// POST /api/v1/intent/search-history
router.post('/search-history', authMiddleware, saveSearchHistory);

// (5) TikTok posts data save karne ke liye endpoint
// POST /api/v1/intent/tiktok-posts
router.post('/tiktok-posts', authMiddleware, saveTikTokPosts);

// (6) Instagram posts data save karne ke liye endpoint
// POST /api/v1/intent/instagram-posts
router.post('/instagram-posts', authMiddleware, saveInstagramPosts);

module.exports = router;
