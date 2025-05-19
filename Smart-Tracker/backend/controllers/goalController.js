const Goal = require('../models/Goal');
const User = require('../models/User'); // For placeholder ID

// --- INSECURE PLACEHOLDER ---
const getPlaceholderUserId = async () => {
    const firstUser = await User.findOne().select('_id');
    if (!firstUser) {
        throw new Error("No users found in the database to use as a placeholder.");
    }
    return firstUser._id;
};
// --- END INSECURE PLACEHOLDER ---

// @desc    Get all goals for the logged-in user
// @route   GET /api/goals
// @access  Private (using placeholder for now)
exports.getGoals = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const goals = await Goal.find({ user: userId }).sort({ targetDate: 1 }); // Sort by target date

        // Optionally, calculate progress for each goal here if needed
        const goalsWithProgress = goals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
            return {
                ...goal.toObject(),
                progress: Math.min(progress, 100), // Cap progress at 100%
                remainingAmount: Math.max(0, goal.targetAmount - goal.savedAmount)
            };
        });

        res.json(goalsWithProgress);
    } catch (err) {
        console.error('Error fetching goals:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a new goal
// @route   POST /api/goals
// @access  Private (using placeholder)
exports.addGoal = async (req, res) => {
    const { description, targetAmount, targetDate, icon } = req.body;
    let userId;

    // Basic validation
    if (!description || !targetAmount || !targetDate) {
        return res.status(400).json({ message: 'Description, target amount, and target date are required' });
    }
    if (parseFloat(targetAmount) <= 0) {
        return res.status(400).json({ message: 'Target amount must be a positive number' });
    }
    const parsedTargetDate = new Date(targetDate);
    if (isNaN(parsedTargetDate.getTime()) || parsedTargetDate <= new Date()) {
        return res.status(400).json({ message: 'Target date must be a valid future date' });
    }


    try {
        userId = await getPlaceholderUserId();
        const newGoal = new Goal({
            user: userId,
            description,
            targetAmount: parseFloat(targetAmount),
            targetDate: parsedTargetDate,
            icon: icon || '🎯', // Default icon if not provided
            savedAmount: 0, // Initialize saved amount
            status: 'active'
        });

        const goal = await newGoal.save();
        const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;

        res.status(201).json({
            ...goal.toObject(),
            progress: Math.min(progress, 100),
            remainingAmount: Math.max(0, goal.targetAmount - goal.savedAmount)
        });
    } catch (err) {
        console.error('Error adding goal:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Update an existing goal
// @route   PUT /api/goals/:id
// @access  Private (using placeholder)
exports.updateGoal = async (req, res) => {
    const { description, targetAmount, targetDate, savedAmount, status, icon } = req.body;
    const goalId = req.params.id;
    let userId;

    try {
        userId = await getPlaceholderUserId();
        let goal = await Goal.findById(goalId);

        if (!goal) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        if (goal.user.toString() !== userId.toString()) {
            return res.status(401).json({ message: 'Not authorized to update this goal' });
        }

        // Build update object
        if (description !== undefined) goal.description = description;
        if (targetAmount !== undefined) {
            const newTargetAmount = parseFloat(targetAmount);
            if (newTargetAmount <= 0) return res.status(400).json({ message: 'Target amount must be positive.' });
            goal.targetAmount = newTargetAmount;
        }
        if (targetDate !== undefined) {
            const newTargetDate = new Date(targetDate);
            if (isNaN(newTargetDate.getTime()) || newTargetDate <= new Date()) { // Allow updating to today for achieved goals
                 if (status !== 'achieved' && newTargetDate <= new Date()) {
                    return res.status(400).json({ message: 'Target date must be a valid future date for active goals.' });
                 }
            }
            goal.targetDate = newTargetDate;
        }
        if (savedAmount !== undefined) {
            const newSavedAmount = parseFloat(savedAmount);
            if (newSavedAmount < 0) return res.status(400).json({ message: 'Saved amount cannot be negative.' });
            if (newSavedAmount > goal.targetAmount) {
                 // Optionally cap savedAmount to targetAmount or allow over-saving
                 // For now, let's allow it but ensure progress doesn't exceed 100% visually if capped.
                 // If capping: goal.savedAmount = goal.targetAmount; goal.status = 'achieved';
                 // If status is not being explicitly set to achieved, don't auto-achieve based on savedAmount only.
            }
            goal.savedAmount = newSavedAmount;
        }
        if (status !== undefined && ['active', 'achieved', 'archived'].includes(status)) {
            goal.status = status;
            if (status === 'achieved' && goal.savedAmount < goal.targetAmount) {
                // If manually set to achieved, ensure saved amount matches target
                goal.savedAmount = goal.targetAmount;
            }
        }
        if (icon !== undefined) goal.icon = icon;


        const updatedGoal = await goal.save();
        const progress = updatedGoal.targetAmount > 0 ? (updatedGoal.savedAmount / updatedGoal.targetAmount) * 100 : 0;

        res.json({
            ...updatedGoal.toObject(),
            progress: Math.min(progress, 100),
            remainingAmount: Math.max(0, updatedGoal.targetAmount - updatedGoal.savedAmount)
        });

    } catch (err) {
        console.error('Error updating goal:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a goal
// @route   DELETE /api/goals/:id
// @access  Private (using placeholder)
exports.deleteGoal = async (req, res) => {
    const goalId = req.params.id;
    let userId;

    try {
        userId = await getPlaceholderUserId();
        const goal = await Goal.findById(goalId);

        if (!goal) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        if (goal.user.toString() !== userId.toString()) {
            return res.status(401).json({ message: 'Not authorized to delete this goal' });
        }

        await Goal.findByIdAndDelete(goalId);
        res.json({ message: 'Goal removed successfully' });

    } catch (err) {
        console.error('Error deleting goal:', err.message);
        res.status(500).send('Server Error');
    }
};