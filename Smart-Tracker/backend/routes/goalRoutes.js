const express = require('express');
const router = express.Router();
const {
    getGoals,
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal // Import new controller
} = require('../controllers/goalController');
// const { protect } = require('../middleware/authMiddleware');

// router.use(protect);

router.route('/')
    .get(getGoals)
    .post(addGoal);

router.route('/:id')
    .put(updateGoal)
    .delete(deleteGoal);

router.post('/:id/contribute', contributeToGoal); // New route for contributions

module.exports = router;