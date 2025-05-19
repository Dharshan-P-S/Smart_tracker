// transactionController.jsx

const Transaction = require('../models/Transaction');
const Limit = require('../models/Limit'); // Assuming you might use this elsewhere
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

// @desc    Add a new transaction
// @route   POST /api/transactions
// @access  Public (Temporarily)
const addTransaction = async (req, res) => {
  try {
    const { type, amount, description, category, emoji, date, recurrence } = req.body;
    const userId = await getPlaceholderUserId();

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

    const newTransaction = new Transaction({
      user: userId,
      type,
      amount: parseFloat(amount),
      description,
      category,
      emoji: emoji || '',
      date: date ? new Date(date) : new Date(),
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

// @desc    Get dashboard data (totals, recent transactions)
// @route   GET /api/dashboard
// @access  Public (Temporarily)
const getDashboardData = async (req, res) => {
  // console.log("Attempting to fetch dashboard data..."); // Kept for debugging if needed
  try {
    const userId = await getPlaceholderUserId();
    // console.log("Using placeholder User ID for dashboard:", userId);

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfCurrentMonth.setHours(0, 0, 0, 0);

    // console.log(`Filtering dashboard data from date: ${startOfCurrentMonth.toISOString()}`);

    const recentTransactions = await Transaction.find({
        user: userId,
        date: { $gte: startOfCurrentMonth }
      })
      .sort({ date: -1 })
      .limit(5)
      .lean();
    //  console.log("Recent transactions fetched:", recentTransactions.length);

    // console.log("Calculating totals via aggregation for the current month...");
    const totals = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfCurrentMonth }
        }
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);
    // console.log("Aggregation result:", totals);

    let totalIncome = 0;
    let totalExpense = 0;
    totals.forEach(group => {
      if (group._id === 'income') totalIncome = group.totalAmount;
      else if (group._id === 'expense') totalExpense = group.totalAmount;
    });
    const balance = totalIncome - totalExpense;

    // console.log("Dashboard data calculated successfully.");
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
    // console.log("Attempting to fetch ALL transactions...");
    try {
        const userId = await getPlaceholderUserId();
        // console.log("Using placeholder User ID for all transactions:", userId);
        const allTransactions = await Transaction.find({ user: userId })
            .sort({ date: -1 })
            .lean();
        // console.log(`Fetched ${allTransactions.length} total transactions.`);
        res.status(200).json(allTransactions);
    } catch (error) {
        console.error('Error fetching ALL transactions in Controller:', error);
         if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
         }
        res.status(500).json({ message: 'Server error while fetching all transactions.' });
    }
};

// =======================================================================
// MODIFIED updateTransaction function
// =======================================================================
// @desc    Update a transaction
// @route   PUT /api/transactions/:id
// @access  Public (Temporarily)
const updateTransaction = async (req, res) => {
  try {
    const userId = await getPlaceholderUserId();
    const transactionId = req.params.id;
    // Destructure all fields that can be updated from the frontend
    const { description, category, emoji, amount /*, type */ } = req.body; // `type` is sent but we won't allow changing it here for simplicity

    // Validate transaction ID format
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ message: 'Invalid transaction ID format' });
    }

    // At least one field must be provided for an update
    if (description === undefined && category === undefined && emoji === undefined && amount === undefined) {
      return res.status(400).json({ message: 'No fields provided for update. At least one of description, category, emoji, or amount is required.' });
    }
    
    // Validate individual fields if they are present in the request
    if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
        return res.status(400).json({ message: 'Description, if provided, cannot be empty.' });
    }
    if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
        return res.status(400).json({ message: 'Category, if provided, cannot be empty.' });
    }
    if (amount !== undefined) {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: 'Amount, if provided, must be a positive number.' });
        }
    }
    // Emoji can be an empty string to clear it

    // Find the transaction
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or not authorized for this user.' });
    }

    // Update fields that were actually sent in the request body
    if (description !== undefined) {
        transaction.description = description.trim();
    }
    if (category !== undefined) {
        transaction.category = category.trim();
    }
    if (emoji !== undefined) {
        // Allows setting emoji to an empty string to remove it
        transaction.emoji = emoji === null ? '' : emoji;
    }
    if (amount !== undefined) {
        transaction.amount = parseFloat(amount);
    }
    // Note: We are intentionally NOT updating transaction.type here.
    // Changing a transaction's type (e.g., income to expense) has significant
    // implications for financial summaries and should be handled carefully,
    // possibly as a separate, more complex operation or disallowed.

    const updatedTransaction = await transaction.save();

    console.log(`Transaction ${transactionId} updated successfully. New amount: ${updatedTransaction.amount}`);
    res.status(200).json(updatedTransaction);

  } catch (error) {
    console.error('Error updating transaction in Controller:', error);
    if (error.message.includes("No users found")) {
        return res.status(500).json({ message: error.message });
    }
    if (error instanceof mongoose.Error.ValidationError) {
         return res.status(400).json({ message: error.message, errors: error.errors }); // Send detailed validation errors
     }
    res.status(500).json({ message: 'Server error while updating transaction.' });
  }
};
// =======================================================================
// END MODIFIED updateTransaction function
// =======================================================================

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
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    const deleteResult = await Transaction.deleteOne({ _id: transactionId, user: userId });
    if (deleteResult.deletedCount === 0) {
        console.error(`Failed to delete transaction ${transactionId}.`);
        return res.status(404).json({ message: 'Transaction not found or could not be deleted' });
    }
    console.log(`Transaction ${transactionId} deleted successfully.`);
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
    // console.log("Attempting to fetch old transactions...");
    try {
        const userId = await getPlaceholderUserId();
        // console.log("Using placeholder User ID for old transactions:", userId);
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        // console.log(`Fetching transactions for user ${userId} before ${startOfCurrentMonth.toISOString()}`);
        const oldTransactions = await Transaction.find({
            user: userId,
            date: { $lt: startOfCurrentMonth }
        })
        .sort({ date: -1 })
        .lean();
        // console.log(`Fetched ${oldTransactions.length} old transactions.`);
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
    // console.log("Attempting to fetch current month income...");
    try {
        const userId = await getPlaceholderUserId();
        // console.log("Using placeholder User ID for current month income:", userId);
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        // console.log(`Fetching income for user ${userId} from ${startOfCurrentMonth.toISOString()}`);
        const incomeTransactions = await Transaction.find({
            user: userId,
            type: 'income',
            date: { $gte: startOfCurrentMonth }
        })
        .sort({ date: -1 })
        .lean();
        // console.log(`Fetched ${incomeTransactions.length} current month income transactions.`);
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
    // console.log("Attempting to fetch current month expense...");
    try {
        const userId = await getPlaceholderUserId();
        // console.log("Using placeholder User ID for current month expense:", userId);
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        // console.log(`Fetching expense for user ${userId} from ${startOfCurrentMonth.toISOString()}`);
        const expenseTransactions = await Transaction.find({
            user: userId,
            type: 'expense',
            date: { $gte: startOfCurrentMonth }
        })
        .sort({ date: -1 })
        .lean();
        // console.log(`Fetched ${expenseTransactions.length} current month expense transactions.`);
        res.status(200).json(expenseTransactions);
    } catch (error) {
        console.error('Error fetching current month expense:', error);
        if (error.message.includes("No users found")) {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while fetching current month expense.' });
    }
};

// @desc    Get monthly savings (income - expense) for all months
// @route   GET /api/transactions/savings/monthly
// @access  Public (Temporarily)
const getMonthlySavings = async (req, res) => {
    // console.log("Attempting to fetch monthly savings data...");
    try {
        const userId = await getPlaceholderUserId();
        // console.log("Using placeholder User ID for monthly savings:", userId);
        const monthlySavings = await Transaction.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: { year: { $year: "$date" }, month: { $month: "$date" } },
                    totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
                    totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } }
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
                    savings: { $subtract: ["$totalIncome", "$totalExpense"] }
                }
            },
            { $sort: { month: 1 } }
        ]);
        // console.log(`Calculated monthly savings for ${monthlySavings.length} months.`);
        res.status(200).json(monthlySavings);
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
  getDashboardData,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  getOldTransactions,
  getCurrentMonthIncome,
  getCurrentMonthExpense,
  getMonthlySavings,
};