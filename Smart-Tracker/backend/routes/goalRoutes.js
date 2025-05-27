// routes/goalRoutes.js
const express = require('express');
const router = express.Router();
const {
    getGoals,
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal
} = require('../controllers/goalController');
const { protect } = require('../middleware/authMiddleware'); // IMPORT PROTECT

// Apply protect middleware to all goal routes
router.use(protect); // Protect all routes below this line

router.route('/')
    .get(getGoals)
    .post(addGoal);

router.route('/:id')
    .put(updateGoal)
    .delete(deleteGoal);

router.post('/:id/contribute', contributeToGoal);

module.exports = router;