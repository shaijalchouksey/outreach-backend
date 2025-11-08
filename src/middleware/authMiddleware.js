const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const authMiddleware = (req, res, next) => {
    // 1. Header se token nikaalo (e.g., 'Bearer 12345abc...')
    const authHeader = req.header('Authorization');

    // 2. Check karo ki token hai ya nahi
    if (!authHeader) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // 3. 'Bearer ' part ko token se alag karo
        // (Ho sakta hai token 'Bearer ' ke bina aaye, isliye check karo)
        let token;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            // Agar 'Bearer ' nahi hai, toh maante hain poora header hi token hai
            // (Postman ka 'Bearer Token' option 'Bearer ' laga deta hai)
            token = authHeader;
        }

        if (!token) {
             return res.status(401).json({ message: 'Token is not valid (Malformed)' });
        }

        // 4. Token ko verify karo
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. Agar token sahi hai, toh 'user' data ko request object mein daal do
        // Taaki agla controller (userController) isse access kar sake
        req.user = decoded;

        // 6. Request ko aage jaane do
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = authMiddleware;