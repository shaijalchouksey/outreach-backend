const pool = require('../config/db');

// Yeh function frontend se search term lega aur DB mein save karega
const logSearch = async (req, res) => {
    // (1) User ki ID humein token (middleware) se milegi
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    // (2) Search term humein frontend ki body se milega
    const { searchTerm, platform } = req.body;

    if (!searchTerm || !platform) {
        return res.status(400).json({ message: 'Search term and platform are required.' });
    }

    try {
        const query = `
            INSERT INTO search_history (user_id, tenant_id, platform, search_term)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(query, [userId, tenantId, platform, searchTerm]);
        
        // (3) Frontend ko bas 'OK' bhej do
        res.status(201).json({ message: 'Search logged successfully' });

    } catch (error) {
        console.error('Error logging search:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    logSearch,
};
