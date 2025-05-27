// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path if your User model is elsewhere

const protect = async (req, res, next) => {
    let token;
    console.log('[AuthMiddleware] Request to:', req.originalUrl); // Log the requested URL

    // Check for token in Authorization header (Bearer token)
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header (split 'Bearer TOKEN' and take the token part)
            token = req.headers.authorization.split(' ')[1];
            console.log('[AuthMiddleware] Token from header for', req.originalUrl, ':', token); // Log token for specific URL

            // Verify token
            console.log('[AuthMiddleware] JWT_SECRET for verification:', process.env.JWT_SECRET); // Log the secret being used
            const decoded = jwt.verify(token, process.env.JWT_SECRET); // Ensure JWT_SECRET is in your .env
            console.log('[AuthMiddleware] Decoded token payload for', req.originalUrl, ':', decoded);

            // Get user from the token payload (usually contains user id)
            // Select '-password' to exclude the password hash from the user object attached to req
            // Common JWT payload structures for user ID: decoded.id, decoded.user.id, decoded._id
            const userIdFromToken = decoded.id || (decoded.user && decoded.user.id) || decoded._id;
            console.log('[AuthMiddleware] User ID from token for', req.originalUrl, ':', userIdFromToken);

            if (!userIdFromToken) {
                console.error('[AuthMiddleware] No user ID found in decoded token for', req.originalUrl);
                return res.status(401).json({ message: 'Not authorized, token invalid (no user ID)' });
            }

            req.user = await User.findById(userIdFromToken).select('-password');
            console.log('[AuthMiddleware] User fetched from DB for', req.originalUrl, ':', req.user ? req.user._id.toString() : 'null');

            if (!req.user) {
                 // Handle case where user associated with token no longer exists
                 console.error('[AuthMiddleware] User not found in DB for ID:', userIdFromToken, 'for URL:', req.originalUrl);
                 return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next(); // Proceed to the next middleware or route handler
        } catch (error) {
            // THIS IS THE MOST IMPORTANT LOG FOR THE 401 ERROR
            console.error('---------------------------------------------------------');
            console.error('[AuthMiddleware] TOKEN VERIFICATION FAILED for URL:', req.originalUrl);
            console.error('[AuthMiddleware] Error Name:', error.name);
            console.error('[AuthMiddleware] Error Message:', error.message);
            console.error('[AuthMiddleware] Full Error Object:', error);
            console.error('---------------------------------------------------------');
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token && !(req.headers.authorization && req.headers.authorization.startsWith('Bearer'))) { // Added check to avoid double logging if header exists but no token
        console.log('[AuthMiddleware] No token or Authorization header not Bearer for URL:', req.originalUrl);
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };