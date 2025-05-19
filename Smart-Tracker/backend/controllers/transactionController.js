// controllers/transactionController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const mongoose = require('mongoose');

const OVERRIDE_DESCRIPTION = "Monthly Net Savings Override";
const OVERRIDE_CATEGORY = "Adjustment";
const OVERRIDE_EMOJI = "💾";


const getPlaceholderUserId = async () => {
    // ... (your existing function)
    if (!User) {
        throw new Error("User model not available.");
    }
    const firstUser = await User.findOne().select('_id').lean();
    if (!firstUser) {
        throw new Error("No users found in the database to use as a placeholder.");
    }
    return firstUser._id;
};

// @desc    Add a new transaction (NOT an override)
// @route   POST /api/transactions
// @access  Public (Temporarily)
const addTransaction = async (req, res) => {
  try {
    const { type, amount, description, category, emoji, date, recurrence } = req.body;
    const userId = await getPlaceholderUserId(); // Ensure this user exists

    if (!type || !amount || !description || !category) {
      return res.status(400).json({ message: 'Please provide type, amount, description, and category' });
    }
    if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ message: 'Invalid transaction type' });
    }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    const validRecurrences = ['once', 'daily', 'weekly', 'monthly'];
    if (recurrence && !validRecurrences.includes(recurrence)) {
        return res.status(400).json({ message: 'Invalid recurrence value' });
    }

    // Check if an override exists for this month
    const transactionDate = new Date(date);
    const monthYearKey = `${transactionDate.getUTCFullYear()}-${String(transactionDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const firstDayOfMonth = new Date(Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), 1));
    
    const existingOverride = await Transaction.findOne({
        user: userId,
        date: { $gte: firstDayOfMonth, $lt: new Date(Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth() + 1, 1)) },
        isOverride: true
    });

    if (existingOverride) {
        return res.status(400).json({ message: `Cannot add transaction. Month ${monthYearKey} has a Net Savings Override. Please remove it first.` });
    }

    const newTransaction = new Transaction({
      user: userId,
      type,
      amount: parseFloat(amount),
      description,
      category,
      emoji: emoji || '',
      date: date ? new Date(date) : new Date(),
      recurrence: recurrence || 'once',
      isOverride: false, // Explicitly false for regular transactions
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


// @desc    Get dashboard data (totals, recent transactions)
// @route   GET /api/dashboard
// @access  Public (Temporarily)
const getDashboardData = async (req, res) => {
  // ... (your existing function - ensure it correctly handles isOverride: false for current month totals)
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);

        const recentTransactions = await Transaction.find({
            user: userId,
            date: { $gte: startOfCurrentMonth },
            isOverride: false // Exclude overrides from recent list, or handle display differently
          })
          .sort({ date: -1 })
          .limit(5)
          .lean();

        const totals = await Transaction.aggregate([
          {
            $match: {
              user: userId,
              date: { $gte: startOfCurrentMonth },
              isOverride: false // Only sum regular transactions for dashboard totals
            }
          },
          {
            $group: {
              _id: '$type',
              totalAmount: { $sum: '$amount' },
            },
          },
        ]);
        
        // Check for override in current month to display it
        const currentMonthOverride = await Transaction.findOne({
            user: userId,
            date: { $gte: startOfCurrentMonth, $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
            isOverride: true
        }).lean();


        let totalIncome = 0;
        let totalExpense = 0;
        totals.forEach(group => {
          if (group._id === 'income') totalIncome = group.totalAmount;
          else if (group._id === 'expense') totalExpense = group.totalAmount;
        });
        
        let balance;
        if (currentMonthOverride) {
            balance = currentMonthOverride.actualAmount;
             // Optionally, adjust totalIncome/Expense if override exists, or show override separately
            if (currentMonthOverride.actualAmount >= 0) {
                totalIncome = currentMonthOverride.actualAmount; // Or add if you want to combine
                totalExpense = 0; // If override replaces all, expense becomes 0 for this calculation
            } else {
                totalExpense = Math.abs(currentMonthOverride.actualAmount);
                totalIncome = 0;
            }
        } else {
            balance = totalIncome - totalExpense;
        }


        res.status(200).json({ totalIncome, totalExpense, balance, recentTransactions, currentMonthOverride });
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
    // ... (your existing function)
    try {
        const userId = await getPlaceholderUserId();
        const allTransactions = await Transaction.find({ user: userId })
            .sort({ date: -1 }) // You might want to sort by isOverride first if displaying them mixed
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

// @desc    Update a transaction (NOT an override directly via this endpoint)
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

    // Prevent direct update of override transactions via this general endpoint
    if (transaction.isOverride) {
        return res.status(400).json({ message: 'Monthly overrides must be updated via the dedicated override endpoint.' });
    }

    // Validations for regular transactions
    if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
        return res.status(400).json({ message: 'Description, if provided, cannot be empty.' });
    }
    if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
        return res.status(400).json({ message: 'Category, if provided, cannot be empty.' });
    }
    if (amount !== undefined) {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: 'Amount, if provided, must be a positive number for regular transactions.' });
        }
        transaction.amount = numericAmount;
    }
    
    if (description !== undefined) transaction.description = description.trim();
    if (category !== undefined) transaction.category = category.trim();
    if (emoji !== undefined) transaction.emoji = emoji === null ? '' : emoji;

    const updatedTransaction = await transaction.save();
    res.status(200).json(updatedTransaction);

  } catch (error) {
    // ... (error handling)
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

// @desc    Delete a transaction (NOT an override directly via this endpoint)
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

    if (transaction.isOverride) {
        return res.status(400).json({ message: 'Monthly overrides must be deleted via the dedicated override endpoint.' });
    }

    const deleteResult = await Transaction.deleteOne({ _id: transactionId, user: userId });
    // ... (rest of your delete logic)
    if (deleteResult.deletedCount === 0) {
        console.error(`Failed to delete transaction ${transactionId}.`);
        return res.status(404).json({ message: 'Transaction not found or could not be deleted' });
    }
    console.log(`Transaction ${transactionId} deleted successfully.`);
    res.status(200).json({ success: true, message: 'Transaction deleted successfully', id: transactionId });
  } catch (error) {
    // ... (error handling)
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
    // ... (your existing function, should now return `isOverride` and `actualAmount` fields)
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        const oldTransactions = await Transaction.find({
            user: userId,
            date: { $lt: startOfCurrentMonth }
        })
        .sort({ date: -1 }) // Consider sorting by isOverride first if needed for display
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

// @desc    Get income transactions for the current month (excluding overrides)
// @route   GET /api/transactions/current-month/income
// @access  Public (Temporarily)
const getCurrentMonthIncome = async (req, res) => {
    // ... (your existing function, ensure `isOverride: false`)
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        const incomeTransactions = await Transaction.find({
            user: userId,
            type: 'income',
            date: { $gte: startOfCurrentMonth },
            isOverride: false
        })
        .sort({ date: -1 })
        .lean();
        res.status(200).json(incomeTransactions);
    } catch (error) { /* ... */ }
};

// @desc    Get expense transactions for the current month (excluding overrides)
// @route   GET /api/transactions/current-month/expense
// @access  Public (Temporarily)
const getCurrentMonthExpense = async (req, res) => {
    // ... (your existing function, ensure `isOverride: false`)
    try {
        const userId = await getPlaceholderUserId();
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        const expenseTransactions = await Transaction.find({
            user: userId,
            type: 'expense',
            date: { $gte: startOfCurrentMonth },
            isOverride: false
        })
        .sort({ date: -1 })
        .lean();
        res.status(200).json(expenseTransactions);
    } catch (error) { /* ... */ }
};

// @desc    Get monthly savings (income - expense) for all months
// @route   GET /api/transactions/savings/monthly
// @access  Public (Temporarily)
const getMonthlySavings = async (req, res) => {
    try {
        const userId = await getPlaceholderUserId();
        const monthlyData = await Transaction.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: { year: { $year: "$date" }, month: { $month: "$date" } },
                    totalIncome: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "income"] }, { $eq: ["$isOverride", false] }] }, "$amount", 0] } },
                    totalExpense: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "expense"] }, { $eq: ["$isOverride", false] }] }, "$amount", 0] } },
                    overrideAmount: { // Get the override amount if one exists for the month
                        $sum: { $cond: [{ $eq: ["$isOverride", true] }, "$actualAmount", 0] }
                    },
                    hasOverride: { // Check if an override exists
                        $max: { $cond: [{ $eq: ["$isOverride", true] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    month: {
                        $concat: [
                            { $toString: "$_id.year" }, "-",
                            { $cond: {
                                if: { $lt: ["$_id.month", 10] },
                                then: { $concat: ["0", { $toString: "$_id.month" }] },
                                else: { $toString: "$_id.month" }
                            }}
                        ]
                    },
                    // If override exists, savings is overrideAmount, else it's income - expense
                    savings: {
                        $cond: {
                            if: { $eq: ["$hasOverride", 1] },
                            then: "$overrideAmount",
                            else: { $subtract: ["$totalIncome", "$totalExpense"] }
                        }
                    }
                }
            },
            { $sort: { month: 1 } }
        ]);
        res.status(200).json(monthlyData);
    } catch (error) {
        console.error('Error fetching monthly savings:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching monthly savings.' });
    }
};


// =======================================================================
// NEW CONTROLLERS FOR MONTHLY OVERRIDE
// =======================================================================

// @desc    Add or Update a Monthly Net Savings Override
// @route   POST /api/transactions/monthly-override
// @access  Public (Temporarily)
const addOrUpdateMonthlyOverride = async (req, res) => {
    try {
        const { monthYear, amount: overrideAmount } = req.body; // monthYear should be "YYYY-MM"
        const userId = await getPlaceholderUserId();

        if (!monthYear || typeof overrideAmount === 'undefined') {
            return res.status(400).json({ message: 'Please provide monthYear (YYYY-MM) and amount for the override.' });
        }
        if (!/^\d{4}-\d{2}$/.test(monthYear)) {
            return res.status(400).json({ message: 'Invalid monthYear format. Expected YYYY-MM.' });
        }
        if (isNaN(parseFloat(overrideAmount))) {
            return res.status(400).json({ message: 'Override amount must be a valid number.' });
        }

        const year = parseInt(monthYear.split('-')[0]);
        const month = parseInt(monthYear.split('-')[1]); // 1-indexed month

        // Date for the override transaction (e.g., 1st of the month in UTC)
        const overrideDate = new Date(Date.UTC(year, month - 1, 1)); // month is 0-indexed for Date constructor

        // Check for existing regular transactions in that month before setting an override
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last moment of the month

        const regularTransactionsExist = await Transaction.exists({
            user: userId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
            isOverride: false
        });

        if (regularTransactionsExist) {
            return res.status(400).json({ message: `Cannot set override for ${monthYear}. Regular transactions exist. Please delete them first.` });
        }
        
        // Delete any existing override for this month before creating/updating
        await Transaction.deleteOne({
            user: userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }, // Match the month
            isOverride: true
        });

        const newOverrideTransaction = new Transaction({
            user: userId,
            type: parseFloat(overrideAmount) >= 0 ? 'income' : 'expense', // Determine type based on sign
            amount: Math.abs(parseFloat(overrideAmount)), // Store absolute value
            actualAmount: parseFloat(overrideAmount), // Store the actual signed value
            description: OVERRIDE_DESCRIPTION,
            category: OVERRIDE_CATEGORY,
            emoji: OVERRIDE_EMOJI,
            date: overrideDate,
            recurrence: 'once',
            isOverride: true,
        });

        const savedOverride = await newOverrideTransaction.save();
        res.status(201).json(savedOverride);

    } catch (error) {
        console.error('Error adding/updating monthly override:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: error.message });
        }
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while setting monthly override.' });
    }
};


// @desc    Delete a Monthly Net Savings Override
// @route   DELETE /api/transactions/monthly-override/:monthYear
// @access  Public (Temporarily)
const deleteMonthlyOverride = async (req, res) => {
    try {
        const { monthYear } = req.params; // monthYear should be "YYYY-MM"
        const userId = await getPlaceholderUserId();

        if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
            return res.status(400).json({ message: 'Invalid or missing monthYear parameter. Expected YYYY-MM.' });
        }

        const year = parseInt(monthYear.split('-')[0]);
        const month = parseInt(monthYear.split('-')[1]);

        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));


        const result = await Transaction.deleteOne({
            user: userId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
            isOverride: true,
            description: OVERRIDE_DESCRIPTION // Extra check
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: `No monthly override found for ${monthYear} to delete.` });
        }

        res.status(200).json({ success: true, message: `Monthly override for ${monthYear} deleted successfully.` });

    } catch (error) {
        console.error('Error deleting monthly override:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while deleting monthly override.' });
    }
};


module.exports = {
  addTransaction,
  getDashboardData,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  getOldTransactions,
  getCurrentMonthIncome,
  getCurrentMonthExpense,
  getMonthlySavings,
  // Export new controllers
  addOrUpdateMonthlyOverride,
  deleteMonthlyOverride,
};