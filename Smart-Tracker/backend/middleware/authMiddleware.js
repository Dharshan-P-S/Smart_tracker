const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path if your User model is elsewhere

const protect = async (req, res, next) => {
    let token;

    // Check for token in Authorization header (Bearer token)
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header (split 'Bearer TOKEN' and take the token part)
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET); // Ensure JWT_SECRET is in your .env

            // Get user from the token payload (usually contains user id)
            // Select '-password' to exclude the password hash from the user object attached to req
            req.user = await User.findById(decoded.id || decoded._id).select('-password');

            if (!req.user) {
                 // Handle case where user associated with token no longer exists
                 return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next(); // Proceed to the next middleware or route handler
        } catch (error) {
            console.error('Token verification failed:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };
