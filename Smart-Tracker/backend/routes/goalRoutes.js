const express = require('express');
const router = express.Router();
const {
    getGoals,
    addGoal,
    updateGoal,
    deleteGoal
} = require('../controllers/goalController');
// const { protect } = require('../middleware/authMiddleware'); // Assuming protect middleware

// router.use(protect); // Apply protection if you have it

router.route('/')
    .get(getGoals)
    .post(addGoal);

router.route('/:id')
    .put(updateGoal)
    .delete(deleteGoal);

module.exports = router;