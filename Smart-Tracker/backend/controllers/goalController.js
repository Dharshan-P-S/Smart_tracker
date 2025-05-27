// controllers/goalController.js
const mongoose = require('mongoose');
const Goal = require('../models/Goal');
// const User = require('../models/User'); // Likely not needed directly anymore
const Transaction = require('../models/Transaction');

// --- Helper to calculate current total cumulative savings ---
// This helper function is fine as it takes userId as a parameter.
// Ensure it's called with the authenticated user's ID.
const calculateUserCumulativeSavings = async (userId) => {
    if (!userId) {
        console.error("[calculateUserCumulativeSavings] Error: userId is undefined or null.");
        throw new Error("User context is missing for cumulative savings calculation.");
    }
    try {
        // ... (rest of your existing function is okay)
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
        throw calcError;
    }
};

// @desc    Get all goals for the logged-in user
exports.getGoals = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Not authorized, user information missing.' });
        }
        const userId = req.user._id;

        const goals = await Goal.find({ user: userId }).sort({ status: 1, targetDate: 1 }).lean();
        const goalsWithProgress = goals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
            return {
                ...goal,
                progress: Math.min(progress, 100),
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

    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id;

    const trimmedDescription = description ? description.trim() : "";

    if (!trimmedDescription) {
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
    const parsedTargetDate = new Date(targetDate + "T00:00:00.000Z");
    const todayUTCStart = new Date();
    todayUTCStart.setUTCHours(0, 0, 0, 0);

    if (isNaN(parsedTargetDate.getTime())) {
        return res.status(400).json({ message: 'Target date is invalid.' });
    }
    if (parsedTargetDate <= todayUTCStart) {
        return res.status(400).json({ message: 'Target date must be a valid future date.' });
    }

    try {
        const existingGoal = await Goal.findOne({
            user: userId,
            description: { $regex: new RegExp(`^${trimmedDescription}$`, 'i') }
        });

        if (existingGoal) {
            return res.status(400).json({ message: 'A goal with this description already exists. Please use a different description.' });
        }

        const newGoalData = {
            user: userId,
            description: trimmedDescription,
            targetAmount: parsedTargetAmount,
            targetDate: parsedTargetDate,
            icon: icon || '🎯',
        };
        const newGoalInstance = new Goal(newGoalData);
        const goal = await newGoalInstance.save();
        const progress = 0;
        const responsePayload = {
            ...goal.toObject(),
            progress,
            remainingAmount: goal.targetAmount
        };
        res.status(201).json(responsePayload);
    } catch (err) {
        console.error('[addGoal] CRITICAL ERROR ADDING GOAL:', err.name, err.message, err.stack);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed.', errors: err.errors });
        }
        res.status(500).json({ message: 'Server Error adding goal.' });
    }
};

// @desc    Update an existing goal
exports.updateGoal = async (req, res) => {
    const { description: newDescription, targetAmount: newTargetAmountStr, targetDate: newTargetDateStr, savedAmount: newSavedAmountStr, status: newStatus, icon: newIcon } = req.body;
    const goalId = req.params.id;

    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id;

    try {
        let goal = await Goal.findById(goalId);

        if (!goal) return res.status(404).json({ message: 'Goal not found' });
        if (goal.user.toString() !== userId.toString()) return res.status(401).json({ message: 'Not authorized to update this goal' });

        // ... (rest of your complex update logic, ensure all `userId` references are correct)
        // Critical: Ensure calculateUserCumulativeSavings(userId) uses the authenticated userId.
        // And any new Transaction() calls also use the authenticated userId.

         const originalDescription = goal.description;
         const originalSavedAmountOnGoal = goal.savedAmount;
         let pendingGoalUpdates = {};
         let descriptionChanged = false;

         if (newDescription !== undefined) {
             const trimmedNewDescription = newDescription.trim();
             if (trimmedNewDescription === "") return res.status(400).json({ message: 'Description cannot be empty.' });
             if (trimmedNewDescription.toLowerCase() !== originalDescription.toLowerCase()) {
                 const existingGoalWithNewDesc = await Goal.findOne({ user: userId, _id: { $ne: goalId }, description: { $regex: new RegExp(`^${trimmedNewDescription}$`, 'i') } });
                 if (existingGoalWithNewDesc) return res.status(400).json({ message: 'Another goal with this description already exists.' });
                 descriptionChanged = true;
             }
             pendingGoalUpdates.description = trimmedNewDescription;
         }
         if (newIcon !== undefined) pendingGoalUpdates.icon = newIcon;
         if (newTargetAmountStr !== undefined) {
             const newTarget = parseFloat(newTargetAmountStr);
             if (isNaN(newTarget) || newTarget <= 0) return res.status(400).json({ message: 'Target amount must be > 0.' });
             pendingGoalUpdates.targetAmount = newTarget;
         }
         const currentTargetAmount = pendingGoalUpdates.targetAmount !== undefined ? pendingGoalUpdates.targetAmount : goal.targetAmount;
         if (newTargetDateStr !== undefined) {
             const newDate = new Date(newTargetDateStr + "T00:00:00.000Z");
             const todayUTCStart = new Date(); todayUTCStart.setUTCHours(0, 0, 0, 0);
             const canHavePastDate = (newStatus && ['achieved', 'archived'].includes(newStatus)) || ['achieved', 'archived'].includes(goal.status);
             if (isNaN(newDate.getTime())) return res.status(400).json({ message: 'Target date is invalid.'});
             if (!canHavePastDate && newDate <= todayUTCStart) return res.status(400).json({ message: 'Target date must be in the future for active goals.'});
             pendingGoalUpdates.targetDate = newDate;
         }

         let finalTargetSavedAmountForGoal = originalSavedAmountOnGoal;
         let savedAmountManuallyChanged = false;

         if (newSavedAmountStr !== undefined) {
             const parsedSavedAmount = parseFloat(newSavedAmountStr);
             if (isNaN(parsedSavedAmount) || parsedSavedAmount < 0) return res.status(400).json({ message: 'Saved amount cannot be negative.' });
             finalTargetSavedAmountForGoal = Math.min(parsedSavedAmount, currentTargetAmount);
             if (finalTargetSavedAmountForGoal !== originalSavedAmountOnGoal) savedAmountManuallyChanged = true;
         }
         if (newStatus === 'achieved') {
             finalTargetSavedAmountForGoal = currentTargetAmount;
             if (finalTargetSavedAmountForGoal !== originalSavedAmountOnGoal) savedAmountManuallyChanged = true;
         }
         const effectiveDescriptionForTransactions = pendingGoalUpdates.description !== undefined ? pendingGoalUpdates.description : originalDescription;

         if (savedAmountManuallyChanged || (descriptionChanged && originalSavedAmountOnGoal > 0) ) {
             await Transaction.deleteMany({ user: userId, category: 'Goal Savings', description: `Saving for: ${originalDescription}` });
             if (finalTargetSavedAmountForGoal > 0) {
                 const now = new Date();
                 const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                 const currentMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
                 const existingMonthlySummary = await Transaction.findOne({ user: userId, type: 'monthly_savings', date: { $gte: currentMonthStart, $lte: currentMonthEnd } });
                 if (existingMonthlySummary) {
                     console.error("[updateGoal] CRITICAL: Aborted update due to monthly summary.");
                     return res.status(400).json({ message: `Cannot update. A monthly summary exists for current month. Old goal transactions for '${originalDescription}' removed.` });
                 }
                 const cumulativeSavingsWithoutOldGoalTx = await calculateUserCumulativeSavings(userId); // Uses authenticated userId
                 if (finalTargetSavedAmountForGoal > cumulativeSavingsWithoutOldGoalTx) {
                     return res.status(400).json({ message: `Cannot set saved amount to ${finalTargetSavedAmountForGoal.toFixed(2)}. Available funds: ${cumulativeSavingsWithoutOldGoalTx.toFixed(2)}.` });
                 }
                 const newGoalTransaction = new Transaction({
                     user: userId, type: 'expense', amount: finalTargetSavedAmountForGoal,
                     description: `Saving for: ${effectiveDescriptionForTransactions}`, category: 'Goal Savings',
                     emoji: pendingGoalUpdates.icon !== undefined ? pendingGoalUpdates.icon : goal.icon,
                     date: new Date(), recurrence: 'once',
                 });
                 await newGoalTransaction.save();
             }
             pendingGoalUpdates.savedAmount = finalTargetSavedAmountForGoal;
         } else if (newSavedAmountStr !== undefined) {
             pendingGoalUpdates.savedAmount = finalTargetSavedAmountForGoal;
         }

         if (newStatus !== undefined && ['active', 'achieved', 'archived'].includes(newStatus)) pendingGoalUpdates.status = newStatus;
         Object.assign(goal, pendingGoalUpdates);
         if (goal.status === 'active' && goal.savedAmount >= goal.targetAmount) goal.status = 'achieved';
         if (goal.status === 'achieved') goal.savedAmount = goal.targetAmount;
         else if (goal.status === 'active' && goal.savedAmount > goal.targetAmount) goal.savedAmount = goal.targetAmount;

        const updatedGoal = await goal.save();
        const progress = updatedGoal.targetAmount > 0 ? (updatedGoal.savedAmount / updatedGoal.targetAmount) * 100 : 0;
        res.json({ ...updatedGoal.toObject(), progress: Math.min(progress, 100), remainingAmount: Math.max(0, updatedGoal.targetAmount - updatedGoal.savedAmount) });

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
    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id;

    try {
        const goal = await Goal.findOne({ _id: goalId, user: userId });

        if (!goal) return res.status(404).json({ message: 'Goal not found or not authorized' });

        await Transaction.deleteMany({
            user: userId, category: 'Goal Savings',
            description: `Saving for: ${goal.description}`
        });

        await Goal.findByIdAndDelete(goalId);

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

    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id;

    try {
        const contributionAmount = parseFloat(amount);

        if (isNaN(contributionAmount) || contributionAmount <= 0) {
            return res.status(400).json({ message: 'Contribution amount must be a positive number.' });
        }

        const goal = await Goal.findById(goalId);
        if (!goal) return res.status(404).json({ message: 'Goal not found.' });
        if (goal.user.toString() !== userId.toString()) return res.status(401).json({ message: 'Not authorized for this goal.' });
        if (goal.status !== 'active') return res.status(400).json({ message: 'Can only contribute to active goals.' });

        let actualContribution = contributionAmount;
        const remainingForGoal = goal.targetAmount - goal.savedAmount;

        if (remainingForGoal <= 0) {
            return res.status(400).json({ message: `Goal "${goal.description}" is already fully funded or achieved.` });
        }
        if (contributionAmount > remainingForGoal) {
            actualContribution = remainingForGoal;
            console.log(`[contributeToGoal] Contribution ${contributionAmount} exceeds remaining ${remainingForGoal}. Capping to ${actualContribution}.`);
        }

        const currentOverallCumulativeSavings = await calculateUserCumulativeSavings(userId); // Uses authenticated userId
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
            return res.status(400).json({ message: `Cannot add goal contribution. A monthly summary already exists for current month. Please remove it first or wait until next month.` });
        }

        const newTransaction = new Transaction({
            user: userId, type: 'expense', amount: actualContribution,
            description: `Saving for: ${goal.description}`, category: 'Goal Savings',
            emoji: goal.icon || '🐖', date: new Date(), recurrence: 'once',
        });
        await newTransaction.save();

        goal.savedAmount += actualContribution;
        if (goal.savedAmount >= goal.targetAmount) {
            goal.savedAmount = goal.targetAmount;
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