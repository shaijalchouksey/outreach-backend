const express = require('express');
const router = express.Router();
const { logSearch } = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');


router.post('/log-search', authMiddleware, logSearch);

module.exports = router;
