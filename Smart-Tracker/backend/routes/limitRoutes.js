// routes/limitRoutes.js
const express = require('express');
const router = express.Router();
const {
    getLimits,
    addLimit,
    updateLimit,
    deleteLimit
} = require('../controllers/limitController');
const { protect } = require('../middleware/authMiddleware'); // IMPORT PROTECT

// Apply protect middleware to all limit routes
router.use(protect); // Protect all routes below this line

router.route('/')
    .get(getLimits)
    .post(addLimit);

router.route('/:id')
    .put(updateLimit)
    .delete(deleteLimit);

module.exports = router;