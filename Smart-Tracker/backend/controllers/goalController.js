const mongoose = require('mongoose'); // Still needed for ObjectId, etc.
const Goal = require('../models/Goal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// --- INSECURE PLACEHOLDER ---
const getPlaceholderUserId = async () => {
    // In a real app, this would come from req.user.id set by auth middleware
    const firstUser = await User.findOne().select('_id').lean();
    if (!firstUser) {
        throw new Error("No users found in the database to use as a placeholder.");
    }
    return firstUser._id;
};
// --- END INSECURE PLACEHOLDER ---

// --- Helper to calculate current total cumulative savings ---
const calculateUserCumulativeSavings = async (userId) => {
    try {
        const allTransactions = await Transaction.find({ user: userId }).lean();
        const monthlyAggregates = {};
        for (let tx of allTransactions) {
            const txDate = new Date(tx.date);
            if (isNaN(txDate.getTime())) continue;
            const monthKey = `${txDate.getUTCFullYear()}-${(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
            if (!monthlyAggregates[monthKey]) {
                monthlyAggregates[monthKey] = { totalIncome: 0, totalExpense: 0, monthlySummaryAmount: null, hasMonthlySummary: false };
            }
            if (tx.type === 'income') monthlyAggregates[monthKey].totalIncome += tx.amount;
            else if (tx.type === 'expense') monthlyAggregates[monthKey].totalExpense += tx.amount;
            else if (tx.type === 'monthly_savings') {
                monthlyAggregates[monthKey].monthlySummaryAmount = tx.amount;
                monthlyAggregates[monthKey].hasMonthlySummary = true;
            }
        }
        let cumulativeSavings = 0;
        const sortedMonthKeys = Object.keys(monthlyAggregates).sort();
        for (const monthKey of sortedMonthKeys) {
            const data = monthlyAggregates[monthKey];
            cumulativeSavings += data.hasMonthlySummary ? data.monthlySummaryAmount : (data.totalIncome - data.totalExpense);
        }
        return cumulativeSavings;
    } catch (calcError) {
        console.error(`[calculateUserCumulativeSavings] Error for user ${userId}:`, calcError.message, calcError.stack);
        throw calcError; // Re-throw to be handled by caller
    }
};

// @desc    Get all goals for the logged-in user
exports.getGoals = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId(); // Replace with req.user.id in a real app
        const goals = await Goal.find({ user: userId }).sort({ status: 1, targetDate: 1 }).lean();
        const goalsWithProgress = goals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
            return {
                ...goal,
                progress: Math.min(progress, 100), // Cap progress at 100%
                remainingAmount: Math.max(0, goal.targetAmount - goal.savedAmount)
            };
        });
        res.json(goalsWithProgress);
    } catch (err) {
        console.error('[getGoals] Error fetching goals:', err.message, err.stack);
        res.status(500).json({ message: 'Server Error fetching goals.' });
    }
};

// @desc    Add a new goal
exports.addGoal = async (req, res) => {
    console.log('[addGoal] Received request to add a new goal.');
    console.log('[addGoal] Request body:', JSON.stringify(req.body, null, 2));

    const { description, targetAmount, targetDate, icon } = req.body;
    let userId;

    const trimmedDescription = description ? description.trim() : "";

    if (!trimmedDescription) { // Check trimmed description
        return res.status(400).json({ message: 'Description is required and cannot be empty.' });
    }
    if (targetAmount === undefined || targetAmount === null || targetAmount === '') {
        return res.status(400).json({ message: 'Target amount is required.' });
    }
    const parsedTargetAmount = parseFloat(targetAmount);
    if (isNaN(parsedTargetAmount) || parsedTargetAmount <= 0) {
        return res.status(400).json({ message: 'Target amount must be a positive number.' });
    }
    if (!targetDate || typeof targetDate !== 'string') {
        return res.status(400).json({ message: 'Target date is required and must be a string (YYYY-MM-DD).' });
    }
    const parsedTargetDate = new Date(targetDate + "T00:00:00.000Z"); // Ensure UTC context for date comparison
    const todayUTCStart = new Date();
    todayUTCStart.setUTCHours(0, 0, 0, 0);

    if (isNaN(parsedTargetDate.getTime())) {
        return res.status(400).json({ message: 'Target date is invalid.' });
    }
    if (parsedTargetDate <= todayUTCStart) { // Compare with today's start in UTC
        return res.status(400).json({ message: 'Target date must be a valid future date.' });
    }

    try {
        userId = await getPlaceholderUserId(); // Replace with req.user.id

        // Server-side check for duplicate description (case-insensitive)
        const existingGoal = await Goal.findOne({
            user: userId,
            description: { $regex: new RegExp(`^${trimmedDescription}$`, 'i') }
        });

        if (existingGoal) {
            return res.status(400).json({ message: 'A goal with this description already exists. Please use a different description.' });
        }

        const newGoalData = {
            user: userId,
            description: trimmedDescription, // Use the trimmed description
            targetAmount: parsedTargetAmount,
            targetDate: parsedTargetDate, // Store as Date object
            icon: icon || '🎯',
            // savedAmount and status will default as per schema
        };
        const newGoalInstance = new Goal(newGoalData);
        const goal = await newGoalInstance.save();
        const progress = 0; // New goals start with 0 progress
        const responsePayload = {
            ...goal.toObject(), // Convert Mongoose doc to plain object
            progress,
            remainingAmount: goal.targetAmount // Initially, remaining is the target
        };
        res.status(201).json(responsePayload);
    } catch (err) {
        console.error('[addGoal] CRITICAL ERROR ADDING GOAL:', err.name, err.message, err.stack);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed.', errors: err.errors });
        }
        if (err.message && err.message.includes("No users found")) { // Handle placeholder error specifically
            return res.status(500).json({ message: "Server setup error: No placeholder user available." });
        }
        res.status(500).json({ message: 'Server Error adding goal.' });
    }
};

// @desc    Update an existing goal
exports.updateGoal = async (req, res) => {
    const { description: newDescription, targetAmount: newTargetAmountStr, targetDate: newTargetDateStr, savedAmount: newSavedAmountStr, status: newStatus, icon: newIcon } = req.body;
    const goalId = req.params.id;
    let userId;

    try {
        userId = await getPlaceholderUserId(); // Replace with req.user.id
        let goal = await Goal.findById(goalId);

        if (!goal) return res.status(404).json({ message: 'Goal not found' });
        if (goal.user.toString() !== userId.toString()) return res.status(401).json({ message: 'Not authorized' });

        const originalDescription = goal.description;
        const originalSavedAmountOnGoal = goal.savedAmount;

        let pendingGoalUpdates = {};
        let descriptionChanged = false;

        if (newDescription !== undefined) {
            const trimmedNewDescription = newDescription.trim();
            if (trimmedNewDescription === "") {
                return res.status(400).json({ message: 'Description cannot be empty.' });
            }
            // Check for duplicate description if it's being changed (case-insensitive)
            if (trimmedNewDescription.toLowerCase() !== originalDescription.toLowerCase()) {
                const existingGoalWithNewDesc = await Goal.findOne({
                    user: userId,
                    _id: { $ne: goalId }, // Exclude the current goal being updated
                    description: { $regex: new RegExp(`^${trimmedNewDescription}$`, 'i') }
                });
                if (existingGoalWithNewDesc) {
                    return res.status(400).json({ message: 'Another goal with this description already exists. Please use a different description.' });
                }
                descriptionChanged = true; // Mark that description has changed
            }
            pendingGoalUpdates.description = trimmedNewDescription; // Store trimmed
        }

        if (newIcon !== undefined) pendingGoalUpdates.icon = newIcon;

        if (newTargetAmountStr !== undefined) {
            const newTarget = parseFloat(newTargetAmountStr);
            if (isNaN(newTarget) || newTarget <= 0) return res.status(400).json({ message: 'Target amount must be > 0.' });
            pendingGoalUpdates.targetAmount = newTarget;
        }
        // Use the potentially updated target amount for subsequent checks
        const currentTargetAmount = pendingGoalUpdates.targetAmount !== undefined ? pendingGoalUpdates.targetAmount : goal.targetAmount;


        if (newTargetDateStr !== undefined) {
            const newDate = new Date(newTargetDateStr + "T00:00:00.000Z"); // UTC context
            const todayUTCStart = new Date();
            todayUTCStart.setUTCHours(0, 0, 0, 0);
            // Allow past date only if newStatus is achieved/archived or current status is achieved/archived
            const canHavePastDate = (newStatus && ['achieved', 'archived'].includes(newStatus)) || ['achieved', 'archived'].includes(goal.status);

            if (isNaN(newDate.getTime())) {
                return res.status(400).json({ message: 'Target date is invalid.'});
            }
            if (!canHavePastDate && newDate <= todayUTCStart) {
                return res.status(400).json({ message: 'Target date must be in the future for active goals.'});
            }
            pendingGoalUpdates.targetDate = newDate;
        }

        let finalTargetSavedAmountForGoal = originalSavedAmountOnGoal;
        let savedAmountManuallyChanged = false;

        if (newSavedAmountStr !== undefined) {
            const parsedSavedAmount = parseFloat(newSavedAmountStr);
            if (isNaN(parsedSavedAmount) || parsedSavedAmount < 0) return res.status(400).json({ message: 'Saved amount cannot be negative.' });
            
            // Cap saved amount at current target amount
            finalTargetSavedAmountForGoal = Math.min(parsedSavedAmount, currentTargetAmount);
            if (finalTargetSavedAmountForGoal !== originalSavedAmountOnGoal) {
                savedAmountManuallyChanged = true;
            }
        }
        
        // If status is being set to 'achieved', force saved amount to target amount
        if (newStatus === 'achieved') {
            finalTargetSavedAmountForGoal = currentTargetAmount;
            if (finalTargetSavedAmountForGoal !== originalSavedAmountOnGoal) {
                savedAmountManuallyChanged = true; // Treat as manual change if status forces it
            }
        }
        
        // Determine the description to use for transaction lookup/creation
        const effectiveDescriptionForTransactions = pendingGoalUpdates.description !== undefined ? pendingGoalUpdates.description : originalDescription;

        // If saved amount was manually changed OR if the description changed (which affects transaction linkage)
        if (savedAmountManuallyChanged || (descriptionChanged && originalSavedAmountOnGoal > 0) ) {
            // 1. Get sum of old transactions (before deleting them)
            // Important: Use originalDescription for finding old transactions
            const oldGoalTransactions = await Transaction.find({
                user: userId, category: 'Goal Savings',
                description: `Saving for: ${originalDescription}`
            }).lean();
            const sumOfOldGoalTransactions = oldGoalTransactions.reduce((acc, tx) => acc + tx.amount, 0);

            // 2. Delete old transactions linked to the original description
            await Transaction.deleteMany({
                user: userId, category: 'Goal Savings',
                description: `Saving for: ${originalDescription}`
            });

            // 3. If new saved amount is > 0, create a new consolidated transaction
            if (finalTargetSavedAmountForGoal > 0) {
                const now = new Date();
                const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                const currentMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
                const existingMonthlySummary = await Transaction.findOne({
                    user: userId, type: 'monthly_savings',
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd }
                });
                if (existingMonthlySummary) {
                    // This is a critical state. Old transactions deleted. New one can't be made.
                    // A more robust solution would involve database transactions or a compensating action.
                    console.error("[updateGoal] CRITICAL: Aborted update due to monthly summary. Old goal transactions deleted.");
                    return res.status(400).json({ message: `Cannot update saved amount or description. A monthly summary exists for the current month. Old goal transactions related to '${originalDescription}' were removed. Manual adjustment of funds or goal may be needed.` });
                }

                // Recalculate cumulative savings *without* the old goal transactions, then check if new amount is valid
                const cumulativeSavingsWithoutOldGoalTx = await calculateUserCumulativeSavings(userId); // This now reflects savings pool *after* deleting old goal tx
                
                if (finalTargetSavedAmountForGoal > cumulativeSavingsWithoutOldGoalTx) {
                    console.error("[updateGoal] CRITICAL: Aborted update. Insufficient funds after removing old goal transactions.");
                     // Attempt to restore old transactions or log for manual fix
                    // For now, return error, data is inconsistent.
                    return res.status(400).json({
                        message: `Cannot set saved amount to ${finalTargetSavedAmountForGoal.toFixed(2)}. After removing previous savings for '${originalDescription}', available funds are only ${cumulativeSavingsWithoutOldGoalTx.toFixed(2)}. Manual adjustment needed.`
                    });
                }
                
                // Create new transaction with the effective description
                const newGoalTransaction = new Transaction({
                    user: userId, type: 'expense', amount: finalTargetSavedAmountForGoal,
                    description: `Saving for: ${effectiveDescriptionForTransactions}`, // Use potentially new description
                    category: 'Goal Savings',
                    emoji: pendingGoalUpdates.icon !== undefined ? pendingGoalUpdates.icon : goal.icon, 
                    date: new Date(), recurrence: 'once',
                });
                await newGoalTransaction.save();
            }
            // Update the goal's saved amount with the final calculated value
            pendingGoalUpdates.savedAmount = finalTargetSavedAmountForGoal;
        } else if (newSavedAmountStr !== undefined) { // If only saved amount changed (no description change, no status to achieved)
            pendingGoalUpdates.savedAmount = finalTargetSavedAmountForGoal; // This case should not require transaction recreation if description is same
        }


        if (newStatus !== undefined && ['active', 'achieved', 'archived'].includes(newStatus)) {
            pendingGoalUpdates.status = newStatus;
        }
        
        Object.assign(goal, pendingGoalUpdates); // Apply all pending updates to the goal model

        // Final status adjustments based on amounts
        if (goal.status === 'active' && goal.savedAmount >= goal.targetAmount) {
            goal.status = 'achieved';
        }
        if (goal.status === 'achieved') { // If achieved, ensure savedAmount is exactly targetAmount
            goal.savedAmount = goal.targetAmount;
        } else if (goal.status === 'active' && goal.savedAmount > goal.targetAmount) { // If active and somehow over, cap it
             goal.savedAmount = goal.targetAmount;
        }
        
        const updatedGoal = await goal.save();

        const progress = updatedGoal.targetAmount > 0 ? (updatedGoal.savedAmount / updatedGoal.targetAmount) * 100 : 0;
        res.json({
            ...updatedGoal.toObject(),
            progress: Math.min(progress, 100), // Cap progress
            remainingAmount: Math.max(0, updatedGoal.targetAmount - updatedGoal.savedAmount)
        });
    } catch (err) {
        console.error('[updateGoal] Error updating goal:', err.name, err.message, err.stack);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed.', errors: err.errors });
        }
        res.status(500).json({ message: 'Server Error updating goal. Data might be in an inconsistent state.' });
    }
};

// @desc    Delete a goal and its associated savings transactions
exports.deleteGoal = async (req, res) => {
    const goalId = req.params.id;
    try {
        const userId = await getPlaceholderUserId(); // Replace with req.user.id
        const goal = await Goal.findOne({ _id: goalId, user: userId });

        if (!goal) return res.status(404).json({ message: 'Goal not found or not authorized' });

        // 1. Delete associated transactions first (use the goal's current description)
        await Transaction.deleteMany({
            user: userId, category: 'Goal Savings',
            description: `Saving for: ${goal.description}` // Use the description from the goal to be deleted
        });

        // 2. Delete the goal
        await Goal.findByIdAndDelete(goalId); // Use findByIdAndDelete for Mongoose

        res.json({ message: 'Goal and associated savings transactions removed successfully' });
    } catch (err) {
        console.error('[deleteGoal] Error deleting goal:', err.name, err.message, err.stack);
        res.status(500).json({ message: 'Server Error deleting goal.' });
    }
};

// @desc    Contribute funds towards a goal
exports.contributeToGoal = async (req, res) => {
    const { amount } = req.body;
    const goalId = req.params.id;
    let userId;

    try {
        userId = await getPlaceholderUserId(); // Replace with req.user.id
        const contributionAmount = parseFloat(amount);

        if (isNaN(contributionAmount) || contributionAmount <= 0) {
            return res.status(400).json({ message: 'Contribution amount must be a positive number.' });
        }

        const goal = await Goal.findById(goalId);
        if (!goal) return res.status(404).json({ message: 'Goal not found.' });
        if (goal.user.toString() !== userId.toString()) return res.status(401).json({ message: 'Not authorized.' });
        if (goal.status !== 'active') return res.status(400).json({ message: 'Can only contribute to active goals.' });

        let actualContribution = contributionAmount;
        const remainingForGoal = goal.targetAmount - goal.savedAmount;

        if (remainingForGoal <= 0) { // Should not happen if status is 'active', but as a safeguard
            return res.status(400).json({ message: `Goal "${goal.description}" is already fully funded or achieved.` });
        }
        
        if (contributionAmount > remainingForGoal) {
             // Backend will cap the contribution to exactly what's needed to achieve the goal.
             // The frontend toast warning is good, but backend enforces.
            actualContribution = remainingForGoal;
            console.log(`[contributeToGoal] Contribution ${contributionAmount} exceeds remaining ${remainingForGoal}. Capping to ${actualContribution}.`);
        }
        
        const currentOverallCumulativeSavings = await calculateUserCumulativeSavings(userId);
        if (actualContribution > currentOverallCumulativeSavings) {
            return res.status(400).json({
                message: `Cannot contribute ${actualContribution.toFixed(2)}. Your current total cumulative savings is only ${currentOverallCumulativeSavings.toFixed(2)}.`
            });
        }
        
        const now = new Date();
        const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const currentMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        const existingMonthlySummary = await Transaction.findOne({
            user: userId, type: 'monthly_savings',
            date: { $gte: currentMonthStart, $lte: currentMonthEnd }
        });
        if (existingMonthlySummary) {
            return res.status(400).json({ message: `Cannot add goal contribution. A monthly summary already exists for the current month. Please remove it first or wait until next month.` });
        }

        // 1. Create transaction for the actual (possibly capped) contribution
        const newTransaction = new Transaction({
            user: userId, type: 'expense', amount: actualContribution,
            description: `Saving for: ${goal.description}`, category: 'Goal Savings',
            emoji: goal.icon || '🐖', date: new Date(), recurrence: 'once',
        });
        await newTransaction.save();

        // 2. Update goal's savedAmount
        goal.savedAmount += actualContribution;
        if (goal.savedAmount >= goal.targetAmount) {
            goal.savedAmount = goal.targetAmount; // Ensure it doesn't exceed target
            goal.status = 'achieved';
        }
        await goal.save();
        
        const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
        res.json({
            ...goal.toObject(),
            progress: Math.min(progress, 100),
            remainingAmount: Math.max(0, goal.targetAmount - goal.savedAmount)
        });

    } catch (err) {
        console.error('[contributeToGoal] Error contributing to goal:', err.name, err.message, err.stack);
        res.status(500).json({ message: 'Server Error contributing to goal.' });
    }
};