const express = require('express');
const router = express.Router();
const {
    getLimits,
    addLimit,
    updateLimit,
    deleteLimit
} = require('../controllers/limitController');
// const { protect } = require('../middleware/authMiddleware'); // REMOVED protection

// Apply protect middleware to all routes in this file
// router.use(protect); // REMOVED protection

// Define routes
router.route('/')
    .get(getLimits)     // GET /api/limits - Fetches all limits for the user
    .post(addLimit);    // POST /api/limits - Adds a new limit

router.route('/:id')
    .put(updateLimit)   // PUT /api/limits/:id - Updates a specific limit
    .delete(deleteLimit); // DELETE /api/limits/:id - Deletes a specific limit

module.exports = router;
