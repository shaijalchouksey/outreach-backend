// src/controllers/userController.js

const getUserProfile = async (req, res) => {
    try {
        // Middleware ne token ko decode karke 'req.user' mein daal diya tha.
        // Humne ab companyName bhi token mein daal diya hai.

        const userProfile = {
            userId: req.user.userId,
            tenantId: req.user.tenantId,
            email: req.user.email,
            role: req.user.role,
            companyName: req.user.companyName // <-- YEH NAYI LINE
        };

        res.status(200).json(userProfile);

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};

module.exports = {
    getUserProfile,
};