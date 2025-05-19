const Goal = require('../models/Goal');
const User = require('../models/User'); // For placeholder ID
const Transaction = require('../models/Transaction'); // Import Transaction model
const mongoose = require('mongoose'); // Keep mongoose import for other uses if any

// --- INSECURE PLACEHOLDER ---
const getPlaceholderUserId = async () => {
    const firstUser = await User.findOne().select('_id');
    if (!firstUser) {
        throw new Error("No users found in the database to use as a placeholder.");
    }
    return firstUser._id;
};
// --- END INSECURE PLACEHOLDER ---

// --- Helper to calculate current total cumulative savings ---
const calculateUserCumulativeSavings = async (userId) => {
    // console.log(`[calculateUserCumulativeSavings] Called for userId: ${userId}`); // Optional: keep for debugging
    try {
        const allTransactions = await Transaction.find({ user: userId }).lean();
        // console.log(`[calculateUserCumulativeSavings] Fetched ${allTransactions.length} transactions for user ${userId}`);
        const monthlyAggregates = {};

        for (let tx of allTransactions) {
            const monthKey = `${tx.date.getUTCFullYear()}-${(tx.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
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
            const netSavingsForMonth = data.hasMonthlySummary ? data.monthlySummaryAmount : (data.totalIncome - data.totalExpense);
            cumulativeSavings += netSavingsForMonth;
            // console.log(`[calculateUserCumulativeSavings] Month: ${monthKey}, Net: ${netSavingsForMonth}, Cumulative: ${cumulativeSavings}`);
        }
        // console.log(`[calculateUserCumulativeSavings] Final cumulative for user ${userId}: ${cumulativeSavings}`);
        return cumulativeSavings;
    } catch (calcError) {
        console.error(`[calculateUserCumulativeSavings] Error for user ${userId}:`, calcError);
        throw calcError;
    }
};


// @desc    Get all goals for the logged-in user
exports.getGoals = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const goals = await Goal.find({ user: userId }).sort({ status: 1, targetDate: 1 });
        const goalsWithProgress = goals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
            return {
                ...goal.toObject(),
                progress: Math.min(progress, 100),
                remainingAmount: Math.max(0, goal.targetAmount - goal.savedAmount)
            };
        });
        res.json(goalsWithProgress);
    } catch (err) {
        console.error('[getGoals] Error fetching goals:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a new goal
exports.addGoal = async (req, res) => {
    const { description, targetAmount, targetDate, icon } = req.body;
    let userId;
    if (!description || !targetAmount || !targetDate) {
        return res.status(400).json({ message: 'Description, target amount, and target date are required' });
    }
    if (parseFloat(targetAmount) <= 0) {
        return res.status(400).json({ message: 'Target amount must be a positive number' });
    }
    const parsedTargetDate = new Date(targetDate + "T00:00:00.000Z");
    if (isNaN(parsedTargetDate.getTime()) || parsedTargetDate <= new Date(new Date().setUTCHours(0,0,0,0))) {
        return res.status(400).json({ message: 'Target date must be a valid future date' });
    }
    try {
        userId = await getPlaceholderUserId();
        const newGoal = new Goal({
            user: userId, description, targetAmount: parseFloat(targetAmount),
            targetDate: parsedTargetDate, icon: icon || '🎯',
        });
        const goal = await newGoal.save();
        const progress = 0;
        res.status(201).json({
            ...goal.toObject(), progress,
            remainingAmount: goal.targetAmount
        });
    } catch (err) {
        console.error('[addGoal] Error adding goal:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Update an existing goal
exports.updateGoal = async (req, res) => {
    const { description, targetAmount, targetDate, savedAmount, status, icon } = req.body;
    const goalId = req.params.id;
    let userId;
    try {
        userId = await getPlaceholderUserId();
        let goal = await Goal.findById(goalId);
        if (!goal) return res.status(404).json({ message: 'Goal not found' });
        if (goal.user.toString() !== userId.toString()) return res.status(401).json({ message: 'Not authorized' });

        if (description !== undefined) goal.description = description;
        if (targetAmount !== undefined) {
            const newTarget = parseFloat(targetAmount);
            if (newTarget <= 0) return res.status(400).json({ message: 'Target amount must be > 0.' });
            goal.targetAmount = newTarget;
        }
        if (targetDate !== undefined) {
            const newDate = new Date(targetDate + "T00:00:00.000Z");
            if (isNaN(newDate.getTime()) || (newDate <= new Date(new Date().setUTCHours(0,0,0,0)) && status !== 'achieved' && goal.status !== 'achieved')) { // Corrected logic
                return res.status(400).json({ message: 'Target date must be future for active goals.'});
            }
            goal.targetDate = newDate;
        }
        if (savedAmount !== undefined) {
            const newSaved = parseFloat(savedAmount);
            if (newSaved < 0) return res.status(400).json({ message: 'Saved amount cannot be negative.' });
            goal.savedAmount = Math.min(newSaved, goal.targetAmount);
        }
        if (status !== undefined && ['active', 'achieved', 'archived'].includes(status)) {
            goal.status = status;
            if (status === 'achieved') goal.savedAmount = goal.targetAmount;
        }
        if (icon !== undefined) goal.icon = icon;
        if (goal.status === 'active' && goal.savedAmount >= goal.targetAmount) {
            goal.status = 'achieved';
            goal.savedAmount = goal.targetAmount;
        }
        const updatedGoal = await goal.save();
        const progress = updatedGoal.targetAmount > 0 ? (updatedGoal.savedAmount / updatedGoal.targetAmount) * 100 : 0;
        res.json({
            ...updatedGoal.toObject(), progress: Math.min(progress, 100),
            remainingAmount: Math.max(0, updatedGoal.targetAmount - updatedGoal.savedAmount)
        });
    } catch (err) {
        console.error('[updateGoal] Error updating goal:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a goal
exports.deleteGoal = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const goal = await Goal.findOne({ _id: req.params.id, user: userId });
        if (!goal) return res.status(404).json({ message: 'Goal not found or not authorized' });
        await Goal.findByIdAndDelete(req.params.id);
        res.json({ message: 'Goal removed successfully' });
    } catch (err) {
        console.error('[deleteGoal] Error deleting goal:', err.message);
        res.status(500).send('Server Error');
    }
};


// @desc    Contribute funds towards a goal
// @route   POST /api/goals/:id/contribute
// @access  Private (using placeholder)
exports.contributeToGoal = async (req, res) => {
    const { amount } = req.body;
    const goalId = req.params.id;
    let userId;
    // console.log(`[contributeToGoal] Received request for goalId: ${goalId}, amount: ${amount}`); // Optional debug

    try {
        userId = await getPlaceholderUserId();
        // console.log(`[contributeToGoal] Placeholder userId: ${userId}`); // Optional debug

        const contributionAmount = parseFloat(amount);
        // console.log(`[contributeToGoal] Parsed contributionAmount: ${contributionAmount}`); // Optional debug

        if (isNaN(contributionAmount) || contributionAmount <= 0) {
            // console.log('[contributeToGoal] Validation failed: Invalid contribution amount.'); // Optional debug
            return res.status(400).json({ message: 'Contribution amount must be a positive number.' });
        }

        const goal = await Goal.findById(goalId);
        // console.log('[contributeToGoal] Fetched goal:', goal ? `ID: ${goal._id}, Status: ${goal.status}` : 'Not Found'); // Optional debug
        if (!goal) {
            // console.log('[contributeToGoal] Goal not found in DB.'); // Optional debug
            return res.status(404).json({ message: 'Goal not found.' });
        }
        if (goal.user.toString() !== userId.toString()) {
            // console.log(`[contributeToGoal] Authorization failed: Goal user ${goal.user} !== current user ${userId}`); // Optional debug
            return res.status(401).json({ message: 'Not authorized.' });
        }
        if (goal.status !== 'active') {
            // console.log(`[contributeToGoal] Validation failed: Goal status is '${goal.status}', not 'active'.`); // Optional debug
            return res.status(400).json({ message: 'Can only contribute to active goals.' });
        }

        const remainingForGoal = goal.targetAmount - goal.savedAmount;
        // console.log(`[contributeToGoal] Goal target: ${goal.targetAmount}, saved: ${goal.savedAmount}, remaining for goal: ${remainingForGoal}`); // Optional debug
        if (contributionAmount > remainingForGoal) {
            // console.log(`[contributeToGoal] Validation failed: Contribution ${contributionAmount} exceeds remaining ${remainingForGoal}.`); // Optional debug
            return res.status(400).json({ message: `Contribution exceeds remaining amount for goal. Max: ${remainingForGoal.toFixed(2)}` });
        }

        // console.log('[contributeToGoal] Calculating currentOverallCumulativeSavings...'); // Optional debug
        const currentOverallCumulativeSavings = await calculateUserCumulativeSavings(userId);
        // console.log(`[contributeToGoal] Current overall cumulative savings for user ${userId}: ${currentOverallCumulativeSavings}`); // Optional debug
        if (contributionAmount > currentOverallCumulativeSavings) {
            // console.log(`[contributeToGoal] Validation failed: Contribution ${contributionAmount} exceeds cumulative savings ${currentOverallCumulativeSavings}.`); // Optional debug
            return res.status(400).json({
                message: `Cannot contribute ${contributionAmount.toFixed(2)}. Your current total cumulative savings is only ${currentOverallCumulativeSavings.toFixed(2)}.`
            });
        }
        
        const now = new Date();
        const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const currentMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        // console.log(`[contributeToGoal] Current month boundaries for summary check: ${currentMonthStart.toISOString()} to ${currentMonthEnd.toISOString()}`); // Optional debug

        const existingMonthlySummary = await Transaction.findOne({
            user: userId, type: 'monthly_savings',
            date: { $gte: currentMonthStart, $lte: currentMonthEnd }
        });
        // console.log('[contributeToGoal] Existing monthly summary for current month:', existingMonthlySummary ? `ID: ${existingMonthlySummary._id}` : 'None'); // Optional debug

        if (existingMonthlySummary) {
            // console.log('[contributeToGoal] Validation failed: Monthly summary exists for current month.'); // Optional debug
            return res.status(400).json({ message: `Cannot add goal contribution as expense. A monthly total savings summary already exists for the current month. Please manage savings via the monthly summary or delete it to add individual savings expenses.` });
        }

        // No Mongoose session/transaction used here
        // console.log('[contributeToGoal] Proceeding WITHOUT Mongoose session.'); // Optional debug

        const newTransaction = new Transaction({
            user: userId,
            type: 'expense',
            amount: contributionAmount,
            description: `Saving for: ${goal.description}`,
            category: 'Goal Savings',
            emoji: goal.icon || '🐖',
            date: new Date(), // Contribution happens now
            recurrence: 'once',
        });
        // console.log('[contributeToGoal] New transaction object to save:', JSON.stringify(newTransaction, null, 2)); // Optional debug
        await newTransaction.save(); // Save without session
        // console.log('[contributeToGoal] New transaction saved successfully.'); // Optional debug

        goal.savedAmount += contributionAmount;
        // console.log(`[contributeToGoal] Goal savedAmount updated to: ${goal.savedAmount}`); // Optional debug
        if (goal.savedAmount >= goal.targetAmount) {
            goal.savedAmount = goal.targetAmount; // Cap at target
            goal.status = 'achieved';
            // console.log(`[contributeToGoal] Goal status changed to 'achieved'. Saved amount capped at target.`); // Optional debug
        }
        // console.log('[contributeToGoal] Goal object to update:', JSON.stringify(goal, null, 2)); // Optional debug
        await goal.save(); // Save without session
        // console.log('[contributeToGoal] Goal updated successfully.'); // Optional debug

        const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
        const responsePayload = {
            ...goal.toObject(),
            progress: Math.min(progress, 100),
            remainingAmount: Math.max(0, goal.targetAmount - goal.savedAmount)
        };
        // console.log('[contributeToGoal] Contribution successful. Sending response:', JSON.stringify(responsePayload, null, 2)); // Optional debug
        res.json(responsePayload);

    } catch (err) {
        console.error('[contributeToGoal] Outer catch - Error contributing to goal:', err.message, err.stack); // Log stack for more detail
        
        let clientMessage = 'Server Error contributing to goal. Please check logs.';
        // Check for specific known error messages to pass to client
        const knownClientErrors = [
            "Cannot contribute", "monthly total savings summary", "Not authorized", 
            "Goal not found", "Contribution amount must be a positive number", 
            "Can only contribute to active goals", "Contribution exceeds remaining amount"
        ];

        if (knownClientErrors.some(knownError => err.message.includes(knownError))) {
            clientMessage = err.message;
        } else if (err.name === 'ValidationError') { // Mongoose validation error
            clientMessage = "Validation failed. Please check your input.";
        }
        
        if (!res.headersSent) {
            res.status(err.isClientError || err.name === 'ValidationError' ? 400 : 500).json({ message: clientMessage });
        } else {
            console.error("[contributeToGoal] Headers already sent, could not send error response for:", err.message);
        }
    }
};