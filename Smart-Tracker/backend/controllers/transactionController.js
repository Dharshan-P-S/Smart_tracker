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
    // Ensure User model is available - this check is good.
    // if (!User) { // This check might be redundant if User is always imported.
    //     throw new Error("User model not available.");
    // }
    const firstUser = await User.findOne().select('_id').lean();
    if (!firstUser) {
        throw new Error("No users found in the database. Please ensure at least one user exists to use as a placeholder.");
    }
    return firstUser._id;
};

// Helper to get start and end of a month from YYYY-MM string or Date object
const getMonthBoundaries = (dateInput) => {
    let year, month;
    if (typeof dateInput === 'string' && dateInput.includes('-')) { // "YYYY-MM"
        [year, month] = dateInput.split('-').map(Number);
        month -= 1; // Adjust month to be 0-indexed for Date constructor
    } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) { // Added !isNaN check
        year = dateInput.getUTCFullYear();
        month = dateInput.getUTCMonth();
    } else {
        // console.error("Invalid dateInput for getMonthBoundaries:", dateInput);
        // throw new Error("Invalid dateInput for getMonthBoundaries");
        // Fallback to current month if dateInput is invalid
        // console.warn("Invalid dateInput for getMonthBoundaries, defaulting to current month:", dateInput);
        const now = new Date();
        year = now.getUTCFullYear();
        month = now.getUTCMonth();
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
    const sortedMonthKeys = Object.keys(monthlyAggregates).sort(); // Ensure chronological processing

    for (const monthKey of sortedMonthKeys) { // Use sorted keys
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
    
    // result.sort((a, b) => a.month.localeCompare(b.month)); // Already sorted by iterating sortedMonthKeys
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
            const netSavingsOfTransactionMonthBeforeThisTx = currentTransactionMonthData ? (currentTransactionMonthData.savings || 0) : 0; // Handle undefined
            const projectedCumulativeAfterExpense = cumulativeSavingsUpToTransactionMonth + netSavingsOfTransactionMonthBeforeThisTx - parseFloat(amount);

            if (projectedCumulativeAfterExpense < 0) {
                return res.status(400).json({
                    message: `Adding this expense would make cumulative savings negative by the end of ${transactionDate.toLocaleString('default', {month: 'long', year: 'numeric', timeZone: 'UTC'})}. Projected cumulative: ${formatCurrencyLocal(projectedCumulativeAfterExpense)}`
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

        if (!monthYear || amount === undefined || amount === null || !/^\d{4}-\d{2}$/.test(monthYear)) { // Added regex for YYYY-MM
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

        if ((cumulativeSavingsUpToPreviousMonth + parseFloat(amount)) < 0) { // Check if adding this makes cumulative negative
            return res.status(400).json({ 
                message: `Adding this saving of ${formatCurrencyLocal(parseFloat(amount))} for ${displayMonth} would make cumulative savings negative (to ${formatCurrencyLocal(cumulativeSavingsUpToPreviousMonth + parseFloat(amount))}). Current cumulative before this month is ${formatCurrencyLocal(cumulativeSavingsUpToPreviousMonth)}.` 
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

// Helper function to capitalize first letter
const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
};


const getExpenseSummary = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const { startDate: queryStartDate, endDate: queryEndDate, category, periodKeyword } = req.query;

        let dateFilter = {};
        let effectiveStartDate, effectiveEndDate; 
        let periodDescription = "for the requested period";

        // MODIFICATION START: Check if any date parameters are provided
        const hasNoDateParameters = !queryStartDate && !queryEndDate && !periodKeyword;

        if (hasNoDateParameters) {
            // If NO date parameters, it's an "all time" query for total expenses
            dateFilter = {}; // No date filter
            periodDescription = "of all time";
        } else {
            // Original logic for handling date parameters (including single-day to month expansion)
            if (queryStartDate) { 
                let sDate = new Date(queryStartDate); 
                let eDate = queryEndDate ? new Date(queryEndDate) : new Date(queryStartDate);

                if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
                    return res.status(400).json({ message: "Invalid startDate or endDate format." });
                }

                const isSingleDayQuery = queryStartDate && (!queryEndDate || queryStartDate === queryEndDate) && !periodKeyword;

                if (isSingleDayQuery) {
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(sDate));
                    periodDescription = `for ${sDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })} (showing full month)`;
                    dateFilter = { date: { $gte: effectiveStartDate, $lte: effectiveEndDate } };
                } else {
                    sDate.setUTCHours(0, 0, 0, 0);
                    effectiveStartDate = sDate;
                    effectiveEndDate = eDate; 
                    dateFilter = { date: { $gte: effectiveStartDate, $lt: effectiveEndDate } };

                    const formatDateDesc = (dateVal) => dateVal.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
                    const displayEndDate = new Date(effectiveEndDate.getTime() - (24*60*60*1000));

                    if (effectiveStartDate.toISOString().split('T')[0] === displayEndDate.toISOString().split('T')[0]) {
                         periodDescription = `for ${formatDateDesc(effectiveStartDate)}`;
                    } else {
                        const isFullMonth = effectiveStartDate.getUTCDate() === 1 &&
                                        effectiveEndDate.getUTCDate() === 1 &&
                                        (
                                            (effectiveEndDate.getUTCMonth() === effectiveStartDate.getUTCMonth() + 1 && effectiveEndDate.getUTCFullYear() === effectiveStartDate.getUTCFullYear()) ||
                                            (effectiveStartDate.getUTCMonth() === 11 && effectiveEndDate.getUTCMonth() === 0 && effectiveEndDate.getUTCFullYear() === effectiveStartDate.getUTCFullYear() + 1)
                                        );
                        if (isFullMonth) {
                            periodDescription = `for ${effectiveStartDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
                        } else {
                            periodDescription = `from ${formatDateDesc(effectiveStartDate)} to ${formatDateDesc(displayEndDate)}`;
                        }
                    }
                }
            } else if (periodKeyword) {
                const now = new Date();
                if (periodKeyword === 'current_month') {
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(now));
                    periodDescription = `for the current month (${now.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })})`;
                } else if (periodKeyword === 'last_month') {
                    const lastMonthDate = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(lastMonthDate));
                    periodDescription = `for last month (${lastMonthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })})`;
                } else if (periodKeyword === 'this_year') {
                    effectiveStartDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
                    effectiveEndDate = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
                    periodDescription = `for this year (${now.getUTCFullYear()})`;
                } else {
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(now));
                    periodDescription = `for the current month (defaulted from unrecognized period: ${periodKeyword})`;
                }
                if (effectiveStartDate && effectiveEndDate) {
                    dateFilter = { date: { $gte: effectiveStartDate, $lte: effectiveEndDate } }; 
                }
            } else { 
                 const now = new Date();
                ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(now));
                dateFilter = { date: { $gte: effectiveStartDate, $lte: effectiveEndDate } };
                periodDescription = `for the current month (default)`;
            }
        }
        // MODIFICATION END
        
        const matchConditions = {
            user: userId,
            type: 'expense',
            ...dateFilter,
        };

        if (category) {
            matchConditions.category = { $regex: new RegExp(`^${category}$`, 'i') };
        }

        const expenses = await Transaction.find(matchConditions).sort({ date: -1 }).lean();

        if (expenses.length === 0) {
            return res.status(200).json({
                period: periodDescription,
                category: category ? capitalizeFirstLetter(category) : "All Categories",
                totalExpenses: 0,
                count: 0,
                message: `No expenses found ${category ? `for category "${capitalizeFirstLetter(category)}"` : ""} ${periodDescription}.`
            });
        }

        const totalExpenses = expenses.reduce((sum, tx) => sum + tx.amount, 0);
        const count = expenses.length;

        let breakdown = [];
        if (!category && expenses.length > 0 && totalExpenses > 0) {
            const categoryMap = new Map();
            expenses.forEach(tx => {
                const cat = capitalizeFirstLetter(tx.category);
                categoryMap.set(cat, (categoryMap.get(cat) || 0) + tx.amount);
            });
            breakdown = Array.from(categoryMap.entries())
                .map(([catName, catTotal]) => ({
                    category: catName,
                    total: catTotal,
                    percentage: (catTotal / totalExpenses) * 100,
                }))
                .sort((a, b) => b.total - a.total);
        }
        
        const sampleTransactions = expenses.slice(0, 5).map(tx => ({
            _id: tx._id,
            date: tx.date,
            description: tx.description,
            category: tx.category,
            amount: tx.amount,
            emoji: tx.emoji
        }));

        res.status(200).json({
            period: periodDescription,
            category: category ? capitalizeFirstLetter(category) : "All Categories",
            totalExpenses,
            count,
            breakdown: breakdown.length > 0 ? breakdown : undefined,
            transactions: sampleTransactions.length > 0 ? sampleTransactions : undefined,
        });

    } catch (error) {
        console.error('Error fetching expense summary:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching expense summary.' });
    }
};


const getIncomeSummary = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const { startDate: queryStartDate, endDate: queryEndDate, category, periodKeyword } = req.query;

        let dateFilter = {};
        let effectiveStartDate, effectiveEndDate;
        let periodDescription = "for the requested period";

        // MODIFICATION START: Check if any date parameters are provided
        const hasNoDateParameters = !queryStartDate && !queryEndDate && !periodKeyword;

        if (hasNoDateParameters) {
            // If NO date parameters, it's an "all time" query for total income
            dateFilter = {}; // No date filter
            periodDescription = "of all time";
        } else {
            // Original logic for handling date parameters
            if (queryStartDate) {
                let sDate = new Date(queryStartDate);
                let eDate = queryEndDate ? new Date(queryEndDate) : new Date(queryStartDate);

                if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
                    return res.status(400).json({ message: "Invalid startDate or endDate format." });
                }

                const isSingleDayQuery = queryStartDate && (!queryEndDate || queryStartDate === queryEndDate) && !periodKeyword;

                if (isSingleDayQuery) {
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(sDate));
                    periodDescription = `for ${sDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })} (showing full month)`;
                    dateFilter = { date: { $gte: effectiveStartDate, $lte: effectiveEndDate } };
                } else {
                    sDate.setUTCHours(0, 0, 0, 0);
                    effectiveStartDate = sDate;
                    effectiveEndDate = eDate;
                    dateFilter = { date: { $gte: effectiveStartDate, $lt: effectiveEndDate } }; 
                    
                    const formatDateDesc = (dateVal) => dateVal.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
                    const displayEndDate = new Date(effectiveEndDate.getTime() - (24*60*60*1000));

                    if (effectiveStartDate.toISOString().split('T')[0] === displayEndDate.toISOString().split('T')[0]) {
                        periodDescription = `for ${formatDateDesc(effectiveStartDate)}`;
                    } else {
                        const isFullMonth = effectiveStartDate.getUTCDate() === 1 &&
                                        effectiveEndDate.getUTCDate() === 1 &&
                                        (
                                            (effectiveEndDate.getUTCMonth() === effectiveStartDate.getUTCMonth() + 1 && effectiveEndDate.getUTCFullYear() === effectiveStartDate.getUTCFullYear()) ||
                                            (effectiveStartDate.getUTCMonth() === 11 && effectiveEndDate.getUTCMonth() === 0 && effectiveEndDate.getUTCFullYear() === effectiveStartDate.getUTCFullYear() + 1)
                                        );
                        if (isFullMonth) {
                            periodDescription = `for ${effectiveStartDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
                        } else {
                            periodDescription = `from ${formatDateDesc(effectiveStartDate)} to ${formatDateDesc(displayEndDate)}`;
                        }
                    }
                }
            } else if (periodKeyword) {
                const now = new Date();
                if (periodKeyword === 'current_month') {
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(now));
                    periodDescription = `for the current month (${now.toLocaleString('default',{month:'long', year:'numeric',timeZone:'UTC'})})`;
                } else if (periodKeyword === 'last_month') {
                    const lm = new Date(now.getUTCFullYear(),now.getUTCMonth()-1,1);
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(lm));
                    periodDescription = `for last month (${lm.toLocaleString('default',{month:'long',year:'numeric',timeZone:'UTC'})})`;
                } else if (periodKeyword === 'this_year') {
                    effectiveStartDate = new Date(Date.UTC(now.getUTCFullYear(),0,1));
                    effectiveEndDate = new Date(Date.UTC(now.getUTCFullYear(),11,31,23,59,59,999));
                    periodDescription = `for this year (${now.getUTCFullYear()})`;
                } else { 
                    ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(now));
                    periodDescription = `for the current month (defaulted from unrecognized period: ${periodKeyword})`;
                }
                if (effectiveStartDate && effectiveEndDate) {
                    dateFilter = { date: { $gte: effectiveStartDate, $lte: effectiveEndDate } };
                }
            } else {
                const now = new Date();
                ({ startOfMonth: effectiveStartDate, endOfMonth: effectiveEndDate } = getMonthBoundaries(now));
                dateFilter = { date: { $gte: effectiveStartDate, $lte: effectiveEndDate } };
                periodDescription = `for the current month (default)`;
            }
        }
        // MODIFICATION END

        const matchConditions = {
            user: userId,
            type: 'income',
            ...dateFilter,
        };

        if (category) {
            matchConditions.category = { $regex: new RegExp(`^${category}$`, 'i') };
        }

        const incomeTransactions = await Transaction.find(matchConditions).sort({ date: -1 }).lean();

        if (incomeTransactions.length === 0) {
            return res.status(200).json({
                period: periodDescription,
                category: category ? capitalizeFirstLetter(category) : "All Sources",
                totalIncome: 0,
                count: 0,
                message: `No income found ${category ? `from source "${capitalizeFirstLetter(category)}"` : ""} ${periodDescription}.`
            });
        }

        const totalIncome = incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        const count = incomeTransactions.length;

        let breakdown = [];
        if (!category && incomeTransactions.length > 0 && totalIncome > 0) {
            const categoryMap = new Map();
            incomeTransactions.forEach(tx => {
                const cat = capitalizeFirstLetter(tx.category);
                categoryMap.set(cat, (categoryMap.get(cat) || 0) + tx.amount);
            });
            breakdown = Array.from(categoryMap.entries())
                .map(([catName, catTotal]) => ({
                    category: catName,
                    total: catTotal,
                    percentage: (catTotal / totalIncome) * 100,
                }))
                .sort((a, b) => b.total - a.total);
        }
        
        const sampleTransactions = incomeTransactions.slice(0, 5).map(tx => ({
            _id: tx._id, date: tx.date, description: tx.description,
            category: tx.category, amount: tx.amount, emoji: tx.emoji
        }));

        res.status(200).json({
            period: periodDescription,
            category: category ? capitalizeFirstLetter(category) : "All Sources",
            totalIncome,
            count,
            breakdown: breakdown.length > 0 ? breakdown : undefined,
            transactions: sampleTransactions.length > 0 ? sampleTransactions : undefined,
        });

    } catch (error) {
        console.error('Error fetching income summary:', error);
        if (error.message.includes("No users found")) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'Server error while fetching income summary.' });
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
                totalIncome = balance >= 0 ? balance : 0;
                totalExpense = balance < 0 ? -balance : 0;
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
        const originalType = transaction.type; 
        const originalCategory = transaction.category;
        const originalDescription = transaction.description;
        const originalDate = transaction.date; 
        let goalToUpdate = null;

        if (originalType === 'income' || originalType === 'expense') {
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
        } else if (originalType === 'monthly_savings') {
            if (newAmountStr !== undefined && isNaN(parseFloat(newAmountStr))) {
                return res.status(400).json({ message: 'Amount must be a number for monthly savings.' });
            }
             if (description !== undefined || category !== undefined) { 
                return res.status(400).json({ message: 'Description and category for monthly savings are derived and cannot be set directly.'});
            }
        }
        
        const newAmount = newAmountStr !== undefined ? parseFloat(newAmountStr) : originalAmount;
        const updatedCategory = category !== undefined ? category.trim() : originalCategory;

        if (updatedCategory === 'Goal Savings' && originalType === 'expense') {
            const currentDescriptionForGoalParsing = description !== undefined ? description.trim() : originalDescription;
            const descParts = currentDescriptionForGoalParsing.split('Saving for: ');
            if (descParts.length > 1) {
                const goalDescriptionQuery = descParts[1].trim();
                goalToUpdate = await Goal.findOne({ description: goalDescriptionQuery, user: userId, status: { $in: ['active', 'achieved'] } });
                if (goalToUpdate) {
                    const changeInContribution = newAmount - originalAmount; 
                    const proposedNewGoalSavedAmount = goalToUpdate.savedAmount + changeInContribution; 
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
            const allMonthlyDataRaw = await getMonthlySavingsInternal(userId, transactionId, newAmount, false); 
            let finalCumulative = 0;
            let cumulativeBreached = false;
            let breachMonth = "";
            
            for (const monthData of allMonthlyDataRaw) {
                finalCumulative += monthData.savings;
                if (finalCumulative < 0) {
                    const transactionMonthKey = `${new Date(originalDate).getUTCFullYear()}-${(new Date(originalDate).getUTCMonth() + 1).toString().padStart(2, '0')}`;
                    if (monthData.month >= transactionMonthKey) {
                        cumulativeBreached = true;
                        breachMonth = monthData.month;
                        break;
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

        if (originalType === 'income' || originalType === 'expense') {
            if (description !== undefined) transaction.description = description.trim();
            if (category !== undefined) transaction.category = category.trim();
            if (emoji !== undefined) transaction.emoji = emoji === null ? '' : emoji;
        }
        if (newAmountStr !== undefined) transaction.amount = newAmount;
        
        if (originalType === 'monthly_savings') { 
            const monthDate = new Date(transaction.date); 
            const displayMonth = monthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            transaction.description = `Total Savings for ${displayMonth}`;
            transaction.category = 'Monthly Summary'; 
        }

        if (goalToUpdate) {
            const changeInContribution = newAmount - originalAmount;
            goalToUpdate.savedAmount += changeInContribution;
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
        const originalType = transaction.type;
        const originalCategory = transaction.category;
        const originalDescription = transaction.description;
        const originalDate = transaction.date; 

        if (originalCategory === 'Goal Savings' && originalType === 'expense') {
            const descParts = originalDescription.split('Saving for: ');
            if (descParts.length > 1) {
                const goalDescriptionQuery = descParts[1].trim();
                goalToUpdate = await Goal.findOne({ description: goalDescriptionQuery, user: userId });
                if (!goalToUpdate) {
                     console.warn(`[deleteTransaction] Goal Savings expense deleted, but could not find matching goal for description: "${originalDescription}"`);
                }
            }
        }
        
        const allMonthlyDataRaw = await getMonthlySavingsInternal(userId, transactionId, 0, true); 
        let finalCumulative = 0;
        let cumulativeBreached = false;
        let breachMonth = "";
        
        for (const monthData of allMonthlyDataRaw) {
            finalCumulative += monthData.savings;
             if (finalCumulative < 0) {
                const transactionMonthKey = `${new Date(originalDate).getUTCFullYear()}-${(new Date(originalDate).getUTCMonth() + 1).toString().padStart(2, '0')}`;
                if (monthData.month >= transactionMonthKey) {
                    cumulativeBreached = true;
                    breachMonth = monthData.month;
                    break;
                }
            }
        }
        if (cumulativeBreached) {
            const displayBreachMonth = new Date(breachMonth + "-01T00:00:00.000Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            return res.status(400).json({ 
                message: `Deleting this transaction would make overall cumulative savings negative (${formatCurrencyLocal(finalCumulative)}) by ${displayBreachMonth}.`
            });
        }

        await Transaction.deleteOne({ _id: transactionId, user: userId });

        if (goalToUpdate) {
            goalToUpdate.savedAmount -= amountBeingDeleted; 
            goalToUpdate.savedAmount = Math.max(0, goalToUpdate.savedAmount); 

            if (goalToUpdate.status === 'achieved' && goalToUpdate.savedAmount < goalToUpdate.targetAmount) {
                goalToUpdate.status = 'active';
            }
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
    getExpenseSummary,
    getIncomeSummary,
};