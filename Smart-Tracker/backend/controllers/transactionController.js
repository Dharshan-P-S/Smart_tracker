// controllers/transactionController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const mongoose = require('mongoose');

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
        throw new Error("Invalid dateInput for getMonthBoundaries");
    }
    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // Last day of month
    return { startOfMonth, endOfMonth };
};


// @desc    Add a new transaction (income/expense)
// @route   POST /api/transactions
// @access  Public (Temporarily)
const addTransaction = async (req, res) => {
    try {
        const { type, amount, description, category, emoji, date, recurrence } = req.body;
        const userId = await getPlaceholderUserId();

        if (!type || !amount || !description || !category || !date) { // Added date validation
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
        const { startOfMonth, endOfMonth } = getMonthBoundaries(transactionDate);

        // Check if a monthly_savings transaction exists for this month
        const existingMonthlySummary = await Transaction.findOne({
            user: userId,
            type: 'monthly_savings',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (existingMonthlySummary) {
            return res.status(400).json({ message: `Cannot add individual transaction. A monthly total savings entry already exists for ${startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.` });
        }

        const newTransaction = new Transaction({
            user: userId,
            type,
            amount: parseFloat(amount),
            description,
            category,
            emoji: emoji || '',
            date: transactionDate,
            recurrence: recurrence || 'once',
        });

        const savedTransaction = await newTransaction.save();
        res.status(201).json(savedTransaction);
    } catch (error) {
        console.error('Error adding transaction:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: error.message });
        }
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while adding transaction' });
    }
};

// @desc    Add a monthly total savings transaction
// @route   POST /api/transactions/monthly-savings
// @access  Public (Temporarily)
const addMonthlySavings = async (req, res) => {
    try {
        const { monthYear, amount } = req.body; // monthYear is "YYYY-MM"
        const userId = await getPlaceholderUserId();

        if (!monthYear || amount === undefined || amount === null) {
            return res.status(400).json({ message: 'Please provide month (YYYY-MM) and amount' });
        }
        if (isNaN(parseFloat(amount))) {
            return res.status(400).json({ message: 'Amount must be a number.' });
        }

        const { startOfMonth, endOfMonth } = getMonthBoundaries(monthYear);
        const displayMonth = startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });


        // Check if any regular (income/expense) transactions exist for this month
        const existingRegularTransactions = await Transaction.findOne({
            user: userId,
            type: { $in: ['income', 'expense'] },
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (existingRegularTransactions) {
            return res.status(400).json({ message: `Cannot add monthly total. Individual transactions already exist for ${displayMonth}. Please delete them first.` });
        }

        // Check if a monthly_savings transaction already exists for this month
        const existingMonthlySummary = await Transaction.findOne({
            user: userId,
            type: 'monthly_savings',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (existingMonthlySummary) {
            return res.status(400).json({ message: `A monthly total savings entry already exists for ${displayMonth}.` });
        }
        
        // Backend validation for cumulative savings (important for negative monthly savings)
        const allMonthlyDataRaw = await getMonthlySavingsInternal(userId); // Use internal helper

        let cumulativeSavingsUpToPreviousMonth = 0;
        const previousMonthKey = new Date(startOfMonth);
        previousMonthKey.setUTCDate(0); // Go to last day of previous month
        const formattedPreviousMonthKey = `${previousMonthKey.getUTCFullYear()}-${(previousMonthKey.getUTCMonth() + 1).toString().padStart(2, '0')}`;

        const prevMonthData = allMonthlyDataRaw.find(m => m.month === formattedPreviousMonthKey);
        if (prevMonthData) {
             // Calculate cumulative up to previous month by summing all savings before the current month
            let tempCumulative = 0;
            for (const m of allMonthlyDataRaw) {
                if (m.month < monthYear) { // monthYear is target month YYYY-MM
                    tempCumulative += m.savings;
                } else {
                    break; // Assuming sorted data
                }
            }
            cumulativeSavingsUpToPreviousMonth = tempCumulative;
        }


        if (parseFloat(amount) < 0 && (cumulativeSavingsUpToPreviousMonth + parseFloat(amount) < 0)) {
            return res.status(400).json({ 
                message: `Adding this negative saving of ${parseFloat(amount).toFixed(2)} for ${displayMonth} would make cumulative savings up to this month negative (to ${(cumulativeSavingsUpToPreviousMonth + parseFloat(amount)).toFixed(2)}). Current cumulative before this month is ${cumulativeSavingsUpToPreviousMonth.toFixed(2)}.` 
            });
        }


        const newMonthlySaving = new Transaction({
            user: userId,
            type: 'monthly_savings',
            amount: parseFloat(amount),
            description: `Total Savings for ${displayMonth}`,
            category: 'Monthly Summary',
            emoji: '💰', // Or some other fixed emoji or none
            date: startOfMonth, // Store as the first day of the month
            recurrence: 'once',
        });

        const savedMonthlySaving = await newMonthlySaving.save();
        res.status(201).json(savedMonthlySaving);

    } catch (error) {
        console.error('Error adding monthly savings:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: error.message });
        }
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while adding monthly savings' });
    }
};


// @desc    Get dashboard data (totals, recent transactions)
// @route   GET /api/dashboard
// @access  Public (Temporarily)
const getDashboardData = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const { startOfMonth } = getMonthBoundaries(now);

        const recentTransactions = await Transaction.find({
            user: userId,
            type: { $in: ['income', 'expense'] }, // Dashboard usually reflects income/expense
            date: { $gte: startOfMonth }
        })
        .sort({ date: -1 })
        .limit(5)
        .lean();

        const totalsAggregation = await Transaction.aggregate([
            {
                $match: {
                    user: userId,
                    date: { $gte: startOfMonth },
                    // Check if a monthly_savings exists for current month, if so, income/expense are effectively 0 for dashboard totals
                }
            },
            {
                $group: {
                    _id: null, // Group all for the month
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
                // If monthly summary exists, balance IS that summary. Income/Expense for display can be tricky.
                // For simplicity, if summary exists, income/expense leading to that summary are not explicitly shown as "total" for month.
                // Or, we can say income = summary, expense = 0 if summary > 0, else income = 0, expense = -summary.
                // Let's assume balance is the summary.
                balance = monthData.monthlySummary;
                // To avoid confusion, let's set income/expense based on the balance if a summary exists
                if (balance >= 0) {
                    totalIncome = balance;
                    totalExpense = 0;
                } else {
                    totalIncome = 0;
                    totalExpense = -balance; // Make expense positive
                }
            } else {
                totalIncome = monthData.totalIncome;
                totalExpense = monthData.totalExpense;
                balance = totalIncome - totalExpense;
            }
        }

        res.status(200).json({ totalIncome, totalExpense, balance, recentTransactions });
    } catch (error) {
        console.error('Error fetching dashboard data in Controller:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching dashboard data. Check backend logs.' });
    }
};

// @desc    Get ALL transactions for the temp user
// @route   GET /api/transactions/all
// @access  Public (Temporarily)
const getAllTransactions = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const allTransactions = await Transaction.find({ user: userId })
            .sort({ date: -1 })
            .lean();
        res.status(200).json(allTransactions);
    } catch (error) {
        console.error('Error fetching ALL transactions in Controller:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching all transactions.' });
    }
};

// @desc    Update a transaction
// @route   PUT /api/transactions/:id
// @access  Public (Temporarily)
const updateTransaction = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const transactionId = req.params.id;
        const { description, category, emoji, amount } = req.body;

        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(400).json({ message: 'Invalid transaction ID format' });
        }

        const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or not authorized.' });
        }

        // --- Validations specific to type ---
        if (transaction.type === 'income' || transaction.type === 'expense') {
            if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
                return res.status(400).json({ message: 'Description cannot be empty.' });
            }
            if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
                return res.status(400).json({ message: 'Category cannot be empty.' });
            }
            if (amount !== undefined) {
                const numericAmount = parseFloat(amount);
                if (isNaN(numericAmount) || numericAmount <= 0) {
                    return res.status(400).json({ message: 'Amount must be a positive number for income/expense.' });
                }
            }
        } else if (transaction.type === 'monthly_savings') {
            if (amount !== undefined && isNaN(parseFloat(amount))) {
                return res.status(400).json({ message: 'Amount must be a number for monthly savings.' });
            }
            // Description, category, emoji for monthly_savings are typically fixed.
            // If allowing them to change, add validation. For now, assume they don't change or are not sent.
        }
        
        // --- Cumulative Savings Validation on Amount Change ---
        if (amount !== undefined && parseFloat(amount) !== transaction.amount) {
            const allMonthlyDataRaw = await getMonthlySavingsInternal(userId, transactionId, parseFloat(amount)); // Pass pending update
            
            let finalCumulative = 0;
            let cumulativeBreached = false;
            let breachMonth = "";

            allMonthlyDataRaw.sort((a,b) => a.month.localeCompare(b.month)); // Ensure sorted

            for (const monthData of allMonthlyDataRaw) {
                finalCumulative += monthData.savings;
                if (finalCumulative < 0) {
                    // Check if this negative cumulative is "more negative" than allowed by a subsequent positive balance
                    // This simple check assumes any negative cumulative is bad unless it's the final month.
                    // A more complex check would see if it recovers later. For now, strict check.
                    const transactionMonthKey = `${transaction.date.getUTCFullYear()}-${(transaction.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                    if (monthData.month >= transactionMonthKey) { // Only care about effects from this month forward
                        cumulativeBreached = true;
                        breachMonth = monthData.month;
                        break;
                    }
                }
            }

            if (cumulativeBreached) {
                 const displayBreachMonth = new Date(breachMonth + "-01T12:00:00Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                return res.status(400).json({ 
                    message: `Updating amount would make cumulative savings negative (${finalCumulative.toFixed(2)}) by ${displayBreachMonth}.`
                });
            }
        }


        // Apply updates
        if (transaction.type === 'income' || transaction.type === 'expense') {
            if (description !== undefined) transaction.description = description.trim();
            if (category !== undefined) transaction.category = category.trim();
            if (emoji !== undefined) transaction.emoji = emoji === null ? '' : emoji;
        }
        // Amount can be updated for all types (with validation above)
        if (amount !== undefined) transaction.amount = parseFloat(amount);
        
        // For 'monthly_savings', description and category might be fixed based on its date
        if (transaction.type === 'monthly_savings') {
            const monthDate = new Date(transaction.date);
            const displayMonth = monthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            transaction.description = `Total Savings for ${displayMonth}`;
            transaction.category = 'Monthly Summary';
            // transaction.emoji = '💰'; // Keep it consistent
        }


        const updatedTransaction = await transaction.save();
        res.status(200).json(updatedTransaction);
    } catch (error) {
        console.error('Error updating transaction in Controller:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: error.message, errors: error.errors });
        }
        res.status(500).json({ message: 'Server error while updating transaction.' });
    }
};

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Public (Temporarily)
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

        // --- Cumulative Savings Validation on Delete ---
        // Simulate effect of deletion: treat its amount contribution as 0
        const allMonthlyDataRaw = await getMonthlySavingsInternal(userId, transactionId, 0, true); // true for deletion simulation
        
        let finalCumulative = 0;
        let cumulativeBreached = false;
        let breachMonth = "";

        allMonthlyDataRaw.sort((a,b) => a.month.localeCompare(b.month)); // Ensure sorted

        for (const monthData of allMonthlyDataRaw) {
            finalCumulative += monthData.savings;
             if (finalCumulative < 0) {
                const transactionMonthKey = `${transaction.date.getUTCFullYear()}-${(transaction.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                if (monthData.month >= transactionMonthKey) {
                    cumulativeBreached = true;
                    breachMonth = monthData.month;
                    break;
                }
            }
        }
        
        if (cumulativeBreached) {
            const displayBreachMonth = new Date(breachMonth + "-01T12:00:00Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            return res.status(400).json({ 
                message: `Deleting this transaction would make cumulative savings negative (${finalCumulative.toFixed(2)}) by ${displayBreachMonth}.`
            });
        }

        const deleteResult = await Transaction.deleteOne({ _id: transactionId, user: userId });
        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({ message: 'Transaction not found or could not be deleted' });
        }
        res.status(200).json({ success: true, message: 'Transaction deleted successfully', id: transactionId });
    } catch (error) {
        console.error('Error deleting transaction in Controller:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while deleting transaction.' });
    }
};


// @desc    Get transactions older than the current month
// @route   GET /api/transactions/old
// @access  Public (Temporarily)
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
// @access  Public (Temporarily)
const getCurrentMonthIncome = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const { startOfMonth } = getMonthBoundaries(now);
        const incomeTransactions = await Transaction.find({
            user: userId,
            type: 'income',
            date: { $gte: startOfMonth }
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
// @access  Public (Temporarily)
const getCurrentMonthExpense = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const { startOfMonth } = getMonthBoundaries(now);
        const expenseTransactions = await Transaction.find({
            user: userId,
            type: 'expense',
            date: { $gte: startOfMonth }
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

// Internal helper for getMonthlySavings, also used by update/delete for projections
const getMonthlySavingsInternal = async (userId, SUT_transactionId = null, SUT_newAmount = null, SUT_isDelete = false) => {
    // SUT = Subject Under Test (for pending changes)
    const allTransactions = await Transaction.find({ user: userId }).lean();
    
    const monthlyAggregates = {};

    for (let tx of allTransactions) {
        let currentAmount = tx.amount;
        let currentType = tx.type;

        if (SUT_transactionId && tx._id.toString() === SUT_transactionId.toString()) {
            if (SUT_isDelete) {
                continue; // Skip this transaction as if it's deleted
            }
            // Apply pending change for amount/type for projection
            if (SUT_newAmount !== null) currentAmount = SUT_newAmount;
            // if (SUT_newType !== null) currentType = SUT_newType; // Type change not supported by UI currently
        }

        const monthKey = `${tx.date.getUTCFullYear()}-${(tx.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;

        if (!monthlyAggregates[monthKey]) {
            monthlyAggregates[monthKey] = {
                totalIncome: 0,
                totalExpense: 0,
                monthlySummaryAmount: null, // Stores the amount if a 'monthly_savings' tx exists
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
    
    result.sort((a, b) => a.month.localeCompare(b.month)); // Ensure sorted by month
    return result;
};


// @desc    Get monthly savings (income - expense OR monthly_savings amount) for all months
// @route   GET /api/transactions/savings/monthly
// @access  Public (Temporarily)
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
    addMonthlySavings, // Export new function
    getDashboardData,
    getAllTransactions,
    updateTransaction,
    deleteTransaction,
    getOldTransactions,
    getCurrentMonthIncome,
    getCurrentMonthExpense,
    getMonthlySavings,
};