// controllers/transactionController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Goal = require('../models/Goal'); // <<<< ENSURE GOAL MODEL IS IMPORTED
const mongoose = require('mongoose');

// --- Helper to format currency (for error messages) ---
const formatCurrencyLocal = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0.00'; // Or your preferred currency
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

const getPlaceholderUserId = async () => {
    if (!User) {
        throw new Error("User model not available.");
    }
    const firstUser = await User.findOne().select('_id').lean();
    if (!firstUser) {
        throw new Error("No users found in the database to use as a placeholder.");
    }
    return firstUser._id;
};

// Helper to get start and end of a month from YYYY-MM string or Date object
const getMonthBoundaries = (dateInput) => {
    let year, month;
    if (typeof dateInput === 'string' && dateInput.includes('-')) { // "YYYY-MM"
        [year, month] = dateInput.split('-').map(Number);
        month -= 1; // Adjust month to be 0-indexed for Date constructor
    } else if (dateInput instanceof Date) {
        year = dateInput.getUTCFullYear();
        month = dateInput.getUTCMonth();
    } else {
        // console.error("Invalid dateInput for getMonthBoundaries:", dateInput);
        throw new Error("Invalid dateInput for getMonthBoundaries");
    }
    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // Last day of month
    return { startOfMonth, endOfMonth };
};

// Internal helper for getMonthlySavings, also used by update/delete for projections
const getMonthlySavingsInternal = async (userId, SUT_transactionId = null, SUT_newAmount = null, SUT_isDelete = false) => {
    const allTransactions = await Transaction.find({ user: userId }).lean();
    const monthlyAggregates = {};

    for (let tx of allTransactions) {
        let currentAmount = tx.amount;
        let currentType = tx.type;

        if (SUT_transactionId && tx._id.toString() === SUT_transactionId.toString()) {
            if (SUT_isDelete) {
                continue;
            }
            if (SUT_newAmount !== null) currentAmount = SUT_newAmount;
        }
        
        const txDate = new Date(tx.date);
        if (isNaN(txDate.getTime())) {
            console.warn(`[getMonthlySavingsInternal] Invalid date for transaction ID ${tx._id}: ${tx.date}`);
            continue; 
        }
        const monthKey = `${txDate.getUTCFullYear()}-${(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;

        if (!monthlyAggregates[monthKey]) {
            monthlyAggregates[monthKey] = {
                totalIncome: 0,
                totalExpense: 0,
                monthlySummaryAmount: null,
                hasMonthlySummary: false
            };
        }

        if (currentType === 'income') {
            monthlyAggregates[monthKey].totalIncome += currentAmount;
        } else if (currentType === 'expense') {
            monthlyAggregates[monthKey].totalExpense += currentAmount;
        } else if (currentType === 'monthly_savings') {
            monthlyAggregates[monthKey].monthlySummaryAmount = currentAmount;
            monthlyAggregates[monthKey].hasMonthlySummary = true;
        }
    }
    
    const result = [];
    for (const monthKey in monthlyAggregates) {
        const data = monthlyAggregates[monthKey];
        let savingsForMonth;
        if (data.hasMonthlySummary) {
            savingsForMonth = data.monthlySummaryAmount;
        } else {
            savingsForMonth = data.totalIncome - data.totalExpense;
        }
        result.push({
            month: monthKey,
            savings: savingsForMonth
        });
    }
    
    result.sort((a, b) => a.month.localeCompare(b.month));
    return result;
};


// @desc    Add a new transaction (income/expense)
// @route   POST /api/transactions
const addTransaction = async (req, res) => {
    try {
        const { type, amount, description, category, emoji, date, recurrence } = req.body;
        const userId = await getPlaceholderUserId();

        if (!type || !amount || !description || !category || !date) {
            return res.status(400).json({ message: 'Please provide type, amount, description, category, and date' });
        }
        if (type !== 'income' && type !== 'expense') {
            return res.status(400).json({ message: 'Invalid transaction type for this endpoint. Use /monthly-savings for summary.' });
        }
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }
        const validRecurrences = ['once', 'daily', 'weekly', 'monthly'];
        if (recurrence && !validRecurrences.includes(recurrence)) {
            return res.status(400).json({ message: 'Invalid recurrence value' });
        }

        const transactionDate = new Date(date);
         if (isNaN(transactionDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format for transaction.'});
        }
        const { startOfMonth, endOfMonth } = getMonthBoundaries(transactionDate);

        const existingMonthlySummary = await Transaction.findOne({
            user: userId,
            type: 'monthly_savings',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (existingMonthlySummary) {
            return res.status(400).json({ message: `Cannot add individual transaction. A monthly total savings entry already exists for ${startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.` });
        }
        
        if (type === 'expense') {
            const allMonthlyDataRaw = await getMonthlySavingsInternal(userId, null, null, false);
            let cumulativeSavingsUpToTransactionMonth = 0;
            const transactionMonthKey = `${transactionDate.getUTCFullYear()}-${(transactionDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
            for (const m of allMonthlyDataRaw) {
                if (m.month < transactionMonthKey) {
                    cumulativeSavingsUpToTransactionMonth += m.savings;
                }
            }
            const currentTransactionMonthData = allMonthlyDataRaw.find(m => m.month === transactionMonthKey);
            const netSavingsOfTransactionMonthBeforeThisTx = currentTransactionMonthData ? currentTransactionMonthData.savings : 0;
            if ((cumulativeSavingsUpToTransactionMonth + netSavingsOfTransactionMonthBeforeThisTx - parseFloat(amount)) < 0) {
                return res.status(400).json({
                    message: `Adding this expense would make cumulative savings negative by the end of ${transactionDate.toLocaleString('default', {month: 'long', year: 'numeric', timeZone: 'UTC'})}.`
                });
            }
        }

        const newTransactionData = {
            user: userId, type, amount: parseFloat(amount), description, category,
            emoji: emoji || '', date: transactionDate, recurrence: recurrence || 'once',
        };

        const newTransaction = new Transaction(newTransactionData);
        const savedTransaction = await newTransaction.save();
        res.status(201).json(savedTransaction);
    } catch (error) {
        console.error('Error adding transaction:', error);
        if (error instanceof mongoose.Error.ValidationError) return res.status(400).json({ message: error.message });
        if (error.message.includes("No users found")) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'Server error while adding transaction' });
    }
};

// @desc    Add a monthly total savings transaction
// @route   POST /api/transactions/monthly-savings
const addMonthlySavings = async (req, res) => {
    try {
        const { monthYear, amount } = req.body;
        const userId = await getPlaceholderUserId();

        if (!monthYear || amount === undefined || amount === null) {
            return res.status(400).json({ message: 'Please provide month (YYYY-MM) and amount' });
        }
        if (isNaN(parseFloat(amount))) {
            return res.status(400).json({ message: 'Amount must be a number.' });
        }

        const { startOfMonth, endOfMonth } = getMonthBoundaries(monthYear);
        const displayMonth = startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

        const existingRegularTransactions = await Transaction.findOne({
            user: userId, type: { $in: ['income', 'expense'] },
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });
        if (existingRegularTransactions) {
            return res.status(400).json({ message: `Cannot add monthly total. Individual transactions already exist for ${displayMonth}. Please delete them first.` });
        }

        const existingMonthlySummary = await Transaction.findOne({
            user: userId, type: 'monthly_savings',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });
        if (existingMonthlySummary) {
            return res.status(400).json({ message: `A monthly total savings entry already exists for ${displayMonth}.` });
        }
        
        const allMonthlyDataRaw = await getMonthlySavingsInternal(userId);
        let cumulativeSavingsUpToPreviousMonth = 0;
        for (const m of allMonthlyDataRaw) {
            if (m.month < monthYear) {
                cumulativeSavingsUpToPreviousMonth += m.savings;
            } else {
                break;
            }
        }

        if (parseFloat(amount) < 0 && (cumulativeSavingsUpToPreviousMonth + parseFloat(amount) < 0)) {
            return res.status(400).json({ 
                message: `Adding this negative saving of ${formatCurrencyLocal(parseFloat(amount))} for ${displayMonth} would make cumulative savings up to this month negative (to ${formatCurrencyLocal(cumulativeSavingsUpToPreviousMonth + parseFloat(amount))}). Current cumulative before this month is ${formatCurrencyLocal(cumulativeSavingsUpToPreviousMonth)}.` 
            });
        }

        const newMonthlySaving = new Transaction({
            user: userId, type: 'monthly_savings', amount: parseFloat(amount),
            description: `Total Savings for ${displayMonth}`, category: 'Monthly Summary',
            emoji: '💰', date: startOfMonth, recurrence: 'once',
        });
        const savedMonthlySaving = await newMonthlySaving.save();
        res.status(201).json(savedMonthlySaving);
    } catch (error) {
        console.error('Error adding monthly savings:', error);
        if (error instanceof mongoose.Error.ValidationError) return res.status(400).json({ message: error.message });
        if (error.message.includes("No users found")) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'Server error while adding monthly savings' });
    }
};


// @desc    Get dashboard data (totals, recent transactions)
// @route   GET /api/dashboard
const getDashboardData = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const { startOfMonth, endOfMonth } = getMonthBoundaries(now);

        const recentTransactions = await Transaction.find({
            user: userId,
            type: { $in: ['income', 'expense'] },
            date: { $gte: startOfMonth, $lte: endOfMonth }
        })
        .sort({ date: -1 })
        .limit(5)
        .lean();

        const totalsAggregation = await Transaction.aggregate([
            { $match: { user: userId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
            {
                $group: {
                    _id: null,
                    totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
                    totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
                    monthlySummary: { $sum: { $cond: [{ $eq: ["$type", "monthly_savings"] }, "$amount", 0] } },
                    hasMonthlySummaryFlag: { $max: { $cond: [{ $eq: ["$type", "monthly_savings"] }, 1, 0] } }
                }
            }
        ]);
        
        let totalIncome = 0;
        let totalExpense = 0;
        let balance = 0;

        if (totalsAggregation.length > 0) {
            const monthData = totalsAggregation[0];
            if (monthData.hasMonthlySummaryFlag === 1) {
                balance = monthData.monthlySummary;
                if (balance >= 0) { totalIncome = balance; totalExpense = 0; }
                else { totalIncome = 0; totalExpense = -balance; }
            } else {
                totalIncome = monthData.totalIncome;
                totalExpense = monthData.totalExpense;
                balance = totalIncome - totalExpense;
            }
        }
        res.status(200).json({ totalIncome, totalExpense, balance, recentTransactions });
    } catch (error) {
        console.error('Error fetching dashboard data in Controller:', error);
        if (error.message.includes("No users found")) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'Server error while fetching dashboard data. Check backend logs.' });
    }
};

// @desc    Get ALL transactions for the temp user
// @route   GET /api/transactions/all
const getAllTransactions = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const allTransactions = await Transaction.find({ user: userId }).sort({ date: -1 }).lean();
        res.status(200).json(allTransactions);
    } catch (error) {
        console.error('Error fetching ALL transactions in Controller:', error);
        if (error.message.includes("No users found")) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'Server error while fetching all transactions.' });
    }
};

// @desc    Update a transaction
// @route   PUT /api/transactions/:id
const updateTransaction = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const transactionId = req.params.id;
        const { description, category, emoji, amount: newAmountStr } = req.body;

        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(400).json({ message: 'Invalid transaction ID format' });
        }

        const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or not authorized.' });
        }

        const originalAmount = transaction.amount;
        const originalCategory = transaction.category;
        const originalDescription = transaction.description;
        let goalToUpdate = null;

        if (transaction.type === 'income' || transaction.type === 'expense') {
            if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
                return res.status(400).json({ message: 'Description cannot be empty.' });
            }
            if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
                return res.status(400).json({ message: 'Category cannot be empty.' });
            }
            if (newAmountStr !== undefined) {
                const numericAmount = parseFloat(newAmountStr);
                if (isNaN(numericAmount) || numericAmount <= 0) {
                    return res.status(400).json({ message: 'Amount must be a positive number for income/expense.' });
                }
            }
        } else if (transaction.type === 'monthly_savings') {
            if (newAmountStr !== undefined && isNaN(parseFloat(newAmountStr))) {
                return res.status(400).json({ message: 'Amount must be a number for monthly savings.' });
            }
        }
        
        const newAmount = newAmountStr !== undefined ? parseFloat(newAmountStr) : originalAmount;
        const updatedCategory = category !== undefined ? category.trim() : originalCategory;

        if (updatedCategory === 'Goal Savings' && transaction.type === 'expense') {
            const currentDescriptionForGoalParsing = description !== undefined ? description.trim() : originalDescription;
            const descParts = currentDescriptionForGoalParsing.split('Saving for: ');
            if (descParts.length > 1) {
                const goalDescriptionQuery = descParts[1].trim();
                goalToUpdate = await Goal.findOne({ description: goalDescriptionQuery, user: userId, status: { $in: ['active', 'achieved'] } });
                if (goalToUpdate) {
                    const amountDifference = newAmount - originalAmount;
                    const proposedNewGoalSavedAmount = goalToUpdate.savedAmount - amountDifference;
                    if (proposedNewGoalSavedAmount < 0) {
                        return res.status(400).json({ 
                            message: `Editing this expense to ${formatCurrencyLocal(newAmount)} would make the goal's effective saved amount negative.`
                        });
                    }
                } else {
                    console.warn(`[updateTransaction] Goal Savings expense update, but could not find matching goal for description: "${currentDescriptionForGoalParsing}"`);
                }
            }
        }
        
        if (newAmountStr !== undefined && newAmount !== originalAmount) {
            const allMonthlyDataRaw = await getMonthlySavingsInternal(userId, transactionId, newAmount);
            let finalCumulative = 0;
            let cumulativeBreached = false;
            let breachMonth = "";
            allMonthlyDataRaw.sort((a,b) => a.month.localeCompare(b.month));
            for (const monthData of allMonthlyDataRaw) {
                finalCumulative += monthData.savings;
                if (finalCumulative < 0) {
                    const transactionDate = new Date(transaction.date); // Ensure transaction.date is valid
                    if (isNaN(transactionDate.getTime())) {
                        console.error(`[updateTransaction] Invalid date on transaction ${transaction._id} during cumulative check.`);
                        // Handle appropriately, maybe skip or error
                    } else {
                        const transactionMonthKey = `${transactionDate.getUTCFullYear()}-${(transactionDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                        if (monthData.month >= transactionMonthKey) {
                            cumulativeBreached = true;
                            breachMonth = monthData.month;
                            break;
                        }
                    }
                }
            }
            if (cumulativeBreached) {
                 const displayBreachMonth = new Date(breachMonth + "-01T00:00:00.000Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                return res.status(400).json({ 
                    message: `Updating amount to ${formatCurrencyLocal(newAmount)} would make overall cumulative savings negative (${formatCurrencyLocal(finalCumulative)}) by ${displayBreachMonth}.`
                });
            }
        }

        if (transaction.type === 'income' || transaction.type === 'expense') {
            if (description !== undefined) transaction.description = description.trim();
            if (category !== undefined) transaction.category = category.trim();
            if (emoji !== undefined) transaction.emoji = emoji === null ? '' : emoji;
        }
        if (newAmountStr !== undefined) transaction.amount = newAmount;
        
        if (transaction.type === 'monthly_savings') {
            const monthDate = new Date(transaction.date);
            const displayMonth = monthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            transaction.description = `Total Savings for ${displayMonth}`;
            transaction.category = 'Monthly Summary';
        }

        if (goalToUpdate) {
            const amountDifferenceFromOriginalExpense = newAmount - originalAmount;
            goalToUpdate.savedAmount -= amountDifferenceFromOriginalExpense;
            goalToUpdate.savedAmount = Math.max(0, goalToUpdate.savedAmount);
            goalToUpdate.savedAmount = Math.min(goalToUpdate.savedAmount, goalToUpdate.targetAmount);
            if (goalToUpdate.status === 'achieved' && goalToUpdate.savedAmount < goalToUpdate.targetAmount) {
                goalToUpdate.status = 'active';
            } else if (goalToUpdate.status === 'active' && goalToUpdate.savedAmount >= goalToUpdate.targetAmount) {
                goalToUpdate.status = 'achieved';
                goalToUpdate.savedAmount = goalToUpdate.targetAmount;
            }
            await goalToUpdate.save();
        }

        const updatedTransaction = await transaction.save();
        res.status(200).json(updatedTransaction);

    } catch (error) {
        console.error('Error updating transaction in Controller:', error);
        if (error.message.includes("No users found")) return res.status(500).json({ message: error.message });
        if (error instanceof mongoose.Error.ValidationError) return res.status(400).json({ message: error.message, errors: error.errors });
        res.status(500).json({ message: 'Server error while updating transaction.' });
    }
};

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
const deleteTransaction = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const transactionId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(400).json({ message: 'Invalid transaction ID format' });
        }
        const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        let goalToUpdate = null;
        const amountBeingDeleted = transaction.amount;

        if (transaction.category === 'Goal Savings' && transaction.type === 'expense') {
            const descParts = transaction.description.split('Saving for: ');
            if (descParts.length > 1) {
                const goalDescriptionQuery = descParts[1].trim();
                goalToUpdate = await Goal.findOne({ description: goalDescriptionQuery, user: userId /* , status: { $in: ['active', 'achieved'] } // Consider broader search for goal if it might be archived */});
                if (!goalToUpdate) {
                     console.warn(`[deleteTransaction] Goal Savings expense deleted, but could not find matching goal for description: "${transaction.description}"`);
                }
            }
        }
        
        const allMonthlyDataRaw = await getMonthlySavingsInternal(userId, transactionId, 0, true);
        let finalCumulative = 0;
        let cumulativeBreached = false;
        let breachMonth = "";
        allMonthlyDataRaw.sort((a,b) => a.month.localeCompare(b.month));
        for (const monthData of allMonthlyDataRaw) {
            finalCumulative += monthData.savings;
             if (finalCumulative < 0) {
                const transactionDate = new Date(transaction.date);
                if (isNaN(transactionDate.getTime())) {
                    console.error(`[deleteTransaction] Invalid date on transaction ${transaction._id}`);
                } else {
                    const transactionMonthKey = `${transactionDate.getUTCFullYear()}-${(transactionDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                    if (monthData.month >= transactionMonthKey) {
                        cumulativeBreached = true;
                        breachMonth = monthData.month;
                        break;
                    }
                }
            }
        }
        if (cumulativeBreached) {
            const displayBreachMonth = new Date(breachMonth + "-01T00:00:00.000Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            return res.status(400).json({ 
                message: `Deleting this transaction would make overall cumulative savings negative (${formatCurrencyLocal(finalCumulative)}) by ${displayBreachMonth}.`
            });
        }

        // IMPORTANT: Perform deletion of transaction BEFORE attempting to update goal,
        // especially if not using DB transactions for atomicity.
        await Transaction.deleteOne({ _id: transactionId, user: userId });

        if (goalToUpdate) {
            // CORRECTED LOGIC: Deleting an expense that was a contribution means the saved amount for the goal DECREASES.
            goalToUpdate.savedAmount -= amountBeingDeleted; 
            goalToUpdate.savedAmount = Math.max(0, goalToUpdate.savedAmount); // Ensure not negative

            if (goalToUpdate.status === 'achieved' && goalToUpdate.savedAmount < goalToUpdate.targetAmount) {
                goalToUpdate.status = 'active';
            }
            // No need to check if active becomes achieved here, as deleting an expense won't achieve a goal.
            await goalToUpdate.save();
            console.log(`[deleteTransaction] Goal "${goalToUpdate.description}" updated due to expense deletion. New saved amount: ${goalToUpdate.savedAmount}, Status: ${goalToUpdate.status}`);
        }

        res.status(200).json({ success: true, message: 'Transaction deleted successfully', id: transactionId });

    } catch (error) {
        console.error('Error deleting transaction in Controller:', error);
        if (error.message.includes("No users found")) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'Server error while deleting transaction.' });
    }
};


// @desc    Get transactions older than the current month
// @route   GET /api/transactions/old
const getOldTransactions = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const { startOfMonth: startOfCurrentMonth } = getMonthBoundaries(now);

        const oldTransactions = await Transaction.find({
            user: userId,
            date: { $lt: startOfCurrentMonth }
        })
        .sort({ date: -1 })
        .lean();
        res.status(200).json(oldTransactions);
    } catch (error) {
        console.error('Error fetching OLD transactions in Controller:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching old transactions.' });
    }
};

// @desc    Get income transactions for the current month
// @route   GET /api/transactions/current-month/income
const getCurrentMonthIncome = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const { startOfMonth, endOfMonth } = getMonthBoundaries(now);
        const incomeTransactions = await Transaction.find({
            user: userId,
            type: 'income',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        })
        .sort({ date: -1 })
        .lean();
        res.status(200).json(incomeTransactions);
    } catch (error) {
        console.error('Error fetching current month income:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching current month income.' });
    }
};

// @desc    Get expense transactions for the current month
// @route   GET /api/transactions/current-month/expense
const getCurrentMonthExpense = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const { startOfMonth, endOfMonth } = getMonthBoundaries(now);
        const expenseTransactions = await Transaction.find({
            user: userId,
            type: 'expense',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        })
        .sort({ date: -1 })
        .lean();
        res.status(200).json(expenseTransactions);
    } catch (error) {
        console.error('Error fetching current month expense:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching current month expense.' });
    }
};

// @desc    Get monthly savings (income - expense OR monthly_savings amount) for all months
// @route   GET /api/transactions/savings/monthly
const getMonthlySavings = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const monthlyData = await getMonthlySavingsInternal(userId);
        res.status(200).json(monthlyData);
    } catch (error) {
        console.error('Error fetching monthly savings:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching monthly savings.' });
    }
};

module.exports = {
    addTransaction,
    addMonthlySavings,
    getDashboardData,
    getAllTransactions,
    updateTransaction,
    deleteTransaction,
    getOldTransactions,
    getCurrentMonthIncome,
    getCurrentMonthExpense,
    getMonthlySavings,
};