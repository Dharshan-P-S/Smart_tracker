const Transaction = require('../models/Transaction');
const Limit = require('../models/Limit'); // Import Limit model
const User = require('../models/User'); // <-- Import User model
const mongoose = require('mongoose');

// --- INSECURE PLACEHOLDER ---
// Fetches the first user's ID to use in place of authenticated user.
// DO NOT USE IN PRODUCTION. Authentication should be properly handled.
// (Copied from limitController for consistency)
const getPlaceholderUserId = async () => {
    // Add error handling in case User model is missing or no users exist
    if (!User) {
        throw new Error("User model not available.");
    }
    const firstUser = await User.findOne().select('_id').lean(); // Use lean for performance
    if (!firstUser) {
        // It's better to throw an error here so the operation fails clearly
        throw new Error("No users found in the database to use as a placeholder.");
    }
    // console.log("Using Placeholder User ID:", firstUser._id); // Optional debug log
    return firstUser._id;
};
// --- END INSECURE PLACEHOLDER ---


// @desc    Add a new transaction
// @route   POST /api/transactions
// @access  Public (Temporarily)
const addTransaction = async (req, res) => { // <-- Make async
  try {
    // Destructure all expected fields, including recurrence and emoji
    const { type, amount, description, category, emoji, date, recurrence } = req.body;
    const userId = await getPlaceholderUserId(); // <-- Use placeholder function

    // Validation
    if (!type || !amount || !description || !category) {
      return res.status(400).json({ message: 'Please provide type, amount, description, and category' });
    }
    if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ message: 'Invalid transaction type' });
    }
     if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    // Optional: Validate recurrence if needed (should be handled by enum in model mostly)
    const validRecurrences = ['once', 'daily', 'weekly', 'monthly'];
    if (recurrence && !validRecurrences.includes(recurrence)) {
        return res.status(400).json({ message: 'Invalid recurrence value' });
    }

    // Check for expense limit before saving
    if (type === 'expense') {
        const limit = await Limit.findOne({ user: userId, category });

        if (limit) {
            // Calculate current spending for the category in the current month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            startOfMonth.setHours(0, 0, 0, 0);

            const spendingResult = await Transaction.aggregate([
                {
                    $match: {
                        user: userId,
                        type: 'expense',
                        category: { $regex: new RegExp(`^${category}$`, 'i') }, // Case-insensitive match
                        date: { $gte: startOfMonth } // Transactions from the start of the current month
                    }
                },
                { $group: { _id: null, totalSpending: { $sum: '$amount' } } }
            ]);

            const currentSpending = spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;
            const potentialSpending = currentSpending + parseFloat(amount);

            if (potentialSpending > limit.amount) {
                return res.status(400).json({
                    message: `Adding this transaction would exceed your monthly limit for '${category}'. Current spending: ₹${currentSpending.toFixed(2)}, Limit: ₹${limit.amount.toFixed(2)}`
                });
            }
        }
    }

    const newTransaction = new Transaction({
      user: userId, // <-- Use fetched placeholder ID
      type,
      amount: parseFloat(amount),
      description,
      category,
      emoji: emoji || '', // Add emoji, default to empty string if not provided
      date: date ? new Date(date) : new Date(),
      recurrence: recurrence || 'once', // Add recurrence, default to 'once' if not provided
    });

    const savedTransaction = await newTransaction.save();
    res.status(201).json(savedTransaction);

  } catch (error) {
    console.error('Error adding transaction:', error);
     if (error instanceof mongoose.Error.ValidationError) {
         return res.status(400).json({ message: error.message });
     }
     if (error.message.includes("No users found")) { // Catch error from getPlaceholderUserId
         return res.status(500).json({ message: error.message });
     }
    res.status(500).json({ message: 'Server error while adding transaction' });
  }
};

// @desc    Get dashboard data (totals, recent transactions)
// @route   GET /api/dashboard
// @access  Public (Temporarily)
const getDashboardData = async (req, res) => { // <-- Make async
  console.log("Attempting to fetch dashboard data...");

  try {
    const userId = await getPlaceholderUserId(); // <-- Use placeholder function
    console.log("Using placeholder User ID for dashboard:", userId);

    // We already check if userId is valid within getPlaceholderUserId now
    // if (!userId || !mongoose.Types.ObjectId.isValid(userId)) { ... } - Redundant

    console.log(`Fetching transactions for user ID: ${userId}`);

    // Calculate the start of the current month
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfCurrentMonth.setHours(0, 0, 0, 0); // Set to midnight

    console.log(`Filtering dashboard data from date: ${startOfCurrentMonth.toISOString()}`);

    // Fetch recent transactions *from the current month*
    const recentTransactions = await Transaction.find({
        user: userId, // Use fetched ID
        date: { $gte: startOfCurrentMonth } // Date is greater than or equal to start of current month
      })
      .sort({ date: -1 })
      .limit(5)
      .lean();

     console.log("Recent transactions fetched:", recentTransactions.length);

    console.log("Calculating totals via aggregation for the current month...");
    const totals = await Transaction.aggregate([
      // Match transactions for the user *within the current month*
      {
        $match: {
          user: userId, // Mongoose handles ObjectId conversion here
          date: { $gte: startOfCurrentMonth }
        }
      },
      {
        $group: {
          _id: '$type', // Group by income/expense
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    console.log("Aggregation result:", totals);

    let totalIncome = 0;
    let totalExpense = 0;
    totals.forEach(group => {
      if (group._id === 'income') totalIncome = group.totalAmount;
      else if (group._id === 'expense') totalExpense = group.totalAmount;
    });
    const balance = totalIncome - totalExpense;

    console.log("Dashboard data calculated successfully.");
    res.status(200).json({ totalIncome, totalExpense, balance, recentTransactions });

  } catch (error) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! Error fetching dashboard data in Controller:');
    console.error('!!! Error Name:', error.name);
    console.error('!!! Error Message:', error.message);
    if (error.message.includes("No users found")) { // Specific message for placeholder issue
        console.error('!!! Placeholder User ID issue.');
        return res.status(500).json({ message: error.message });
    }
    console.error('!!! Error Stack:');
    console.error(error.stack);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    res.status(500).json({ message: 'Server error while fetching dashboard data. Check backend logs.' });
  }
};

// @desc    Get ALL transactions for the temp user
// @route   GET /api/transactions/all
// @access  Public (Temporarily)
const getAllTransactions = async (req, res) => { // <-- Make async
    console.log("Attempting to fetch ALL transactions...");
    try {
        const userId = await getPlaceholderUserId(); // <-- Use placeholder function
        console.log("Using placeholder User ID for all transactions:", userId);

        // Fetch all transactions for the user, sorted by date descending
        const allTransactions = await Transaction.find({ user: userId }) // <-- Use fetched ID
            .sort({ date: -1 })
            .lean(); // Use lean for performance

        console.log(`Fetched ${allTransactions.length} total transactions.`);

        res.status(200).json(allTransactions);

    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error fetching ALL transactions in Controller:');
        console.error('!!! Error:', error);
         if (error.message.includes("No users found")) { // Catch error from getPlaceholderUserId
            console.error('!!! Placeholder User ID issue.');
            return res.status(500).json({ message: error.message });
         }
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while fetching all transactions.' });
    }
};

// @desc    Update a transaction (description & category only)
// @route   PUT /api/transactions/:id
// @access  Public (Temporarily)
const updateTransaction = async (req, res) => { // <-- Make async
  try {
    const userId = await getPlaceholderUserId(); // <-- Use placeholder function
    const transactionId = req.params.id;
    // Include emoji in the destructuring
    const { description, category, emoji } = req.body;

    // Basic validation - Allow emoji to be optional (empty string is valid)
    if (!description || !category) {
      return res.status(400).json({ message: 'Description and category are required' });
    }
     if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ message: 'Invalid transaction ID format' });
    }

    // Find the transaction by ID and ensure it belongs to the user
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId // <-- Use fetched ID
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or not authorized' });
    }

    // Update the fields, including emoji
    transaction.description = description;
    transaction.category = category;
    // Set emoji, defaulting to empty string if null/undefined is passed
    transaction.emoji = emoji !== undefined && emoji !== null ? emoji : '';
    // Optionally add validation for max length etc. here if needed

    const updatedTransaction = await transaction.save();

    console.log(`Transaction ${transactionId} updated successfully.`);
    res.status(200).json(updatedTransaction);

  } catch (error) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! Error updating transaction in Controller:');
    console.error('!!! Transaction ID:', req.params.id);
    console.error('!!! Error:', error);
    if (error.message.includes("No users found")) { // Catch error from getPlaceholderUserId
        console.error('!!! Placeholder User ID issue.');
        return res.status(500).json({ message: error.message });
    }
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    if (error instanceof mongoose.Error.ValidationError) {
         return res.status(400).json({ message: error.message });
     }
    res.status(500).json({ message: 'Server error while updating transaction.' });
  }
};

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Public (Temporarily)
const deleteTransaction = async (req, res) => { // <-- Make async
  try {
    const userId = await getPlaceholderUserId(); // <-- Use placeholder function
    const transactionId = req.params.id;

    // Validate Transaction ID format
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ message: 'Invalid transaction ID format' });
    }

    // Find the transaction by ID and ensure it belongs to the user before deleting
    // This findOne check is slightly redundant if deleteOne works, but good for clarity
    // and potentially catching auth issues before attempting delete.
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId // <-- Use fetched ID
    });

    // If transaction doesn't exist or doesn't belong to the user
    if (!transaction) {
      // Return 404 even if it exists but belongs to another user for security
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Use deleteOne for Mongoose v6+
    const deleteResult = await Transaction.deleteOne({ _id: transactionId, user: userId }); // <-- Use fetched ID

    // Although we found it earlier, double-check the result of deleteOne
    if (deleteResult.deletedCount === 0) {
        // This case might happen due to race conditions or other issues
        console.error(`Failed to delete transaction ${transactionId} even after finding it.`);
        return res.status(404).json({ message: 'Transaction not found or could not be deleted' });
    }

    console.log(`Transaction ${transactionId} deleted successfully.`);
    // Send back a success status, often with the ID of the deleted item
    res.status(200).json({ success: true, message: 'Transaction deleted successfully', id: transactionId });

  } catch (error) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! Error deleting transaction in Controller:');
    console.error('!!! Transaction ID:', req.params.id);
    console.error('!!! Error:', error);
    if (error.message.includes("No users found")) { // Catch error from getPlaceholderUserId
        console.error('!!! Placeholder User ID issue.');
        return res.status(500).json({ message: error.message });
    }
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    res.status(500).json({ message: 'Server error while deleting transaction.' });
  }
};

// @desc    Get transactions older than the current month
// @route   GET /api/transactions/old
// @access  Public (Temporarily)
const getOldTransactions = async (req, res) => {
    console.log("Attempting to fetch old transactions...");
    try {
        const userId = await getPlaceholderUserId(); // Use placeholder function
        console.log("Using placeholder User ID for old transactions:", userId);

        // Calculate the start of the current month
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0); // Set to midnight

        console.log(`Fetching transactions for user ${userId} before ${startOfCurrentMonth.toISOString()}`);

        // Fetch transactions for the user dated *before* the start of the current month
        const oldTransactions = await Transaction.find({
            user: userId, // Use fetched ID
            date: { $lt: startOfCurrentMonth } // Date is less than the start of the current month
        })
        .sort({ date: -1 }) // Sort by date descending (most recent of the old ones first)
        .lean(); // Use lean for performance

        console.log(`Fetched ${oldTransactions.length} old transactions.`);

        res.status(200).json(oldTransactions);

    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error fetching OLD transactions in Controller:');
        console.error('!!! Error:', error);
         if (error.message.includes("No users found")) { // Catch error from getPlaceholderUserId
            console.error('!!! Placeholder User ID issue.');
            return res.status(500).json({ message: error.message });
         }
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while fetching old transactions.' });
    }
};

// @desc    Get income transactions for the current month
// @route   GET /api/transactions/current-month/income
// @access  Public (Temporarily)
const getCurrentMonthIncome = async (req, res) => {
    console.log("Attempting to fetch current month income...");
    try {
        const userId = await getPlaceholderUserId();
        console.log("Using placeholder User ID for current month income:", userId);

        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);

        console.log(`Fetching income for user ${userId} from ${startOfCurrentMonth.toISOString()}`);

        const incomeTransactions = await Transaction.find({
            user: userId,
            type: 'income', // Filter by type
            date: { $gte: startOfCurrentMonth }
        })
        .sort({ date: -1 })
        .lean();

        console.log(`Fetched ${incomeTransactions.length} current month income transactions.`);
        res.status(200).json(incomeTransactions);

    } catch (error) {
        console.error('!!! Error fetching current month income:', error);
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
    console.log("Attempting to fetch current month expense...");
    try {
        const userId = await getPlaceholderUserId();
        console.log("Using placeholder User ID for current month expense:", userId);

        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);

        console.log(`Fetching expense for user ${userId} from ${startOfCurrentMonth.toISOString()}`);

        const expenseTransactions = await Transaction.find({
            user: userId,
            type: 'expense', // Filter by type
            date: { $gte: startOfCurrentMonth }
        })
        .sort({ date: -1 })
        .lean();

        console.log(`Fetched ${expenseTransactions.length} current month expense transactions.`);
        res.status(200).json(expenseTransactions);

    } catch (error) {
        console.error('!!! Error fetching current month expense:', error);
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
    console.log("Attempting to fetch monthly savings data...");
    try {
        const userId = await getPlaceholderUserId();
        console.log("Using placeholder User ID for monthly savings:", userId);

        // Use aggregation pipeline to calculate monthly savings
        const monthlySavings = await Transaction.aggregate([
            {
                $match: { user: userId } // Match transactions for the user
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$date" },
                        month: { $month: "$date" }
                    },
                    totalIncome: {
                        $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] }
                    },
                    totalExpense: {
                        $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0, // Exclude the default _id
                    month: {
                        // Format month as YYYY-MM string
                        $concat: [
                            { $toString: "$_id.year" },
                            "-",
                            // Pad month with leading zero if needed
                            { $cond: {
                                if: { $lt: ["$_id.month", 10] },
                                then: { $concat: ["0", { $toString: "$_id.month" }] },
                                else: { $toString: "$_id.month" }
                            }}
                        ]
                    },
                    savings: { $subtract: ["$totalIncome", "$totalExpense"] } // Calculate savings
                }
            },
            {
                $sort: { month: 1 } // Sort by month ascending
            }
        ]);

        console.log(`Calculated monthly savings for ${monthlySavings.length} months.`);
        res.status(200).json(monthlySavings);

    } catch (error) {
        console.error('!!! Error fetching monthly savings:', error);
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
  getCurrentMonthIncome,  // Export new function
  getCurrentMonthExpense, // Export new function
  getMonthlySavings, // Export the new savings function
};
