const Transaction = require('../models/Transaction');
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
    // Destructure all expected fields, including recurrence
    const { type, amount, description, category, date, recurrence } = req.body;
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

    const newTransaction = new Transaction({
      user: userId, // <-- Use fetched placeholder ID
      type,
      amount: parseFloat(amount),
      description,
      category,
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

    const recentTransactions = await Transaction.find({ user: userId }) // Use fetched ID
      .sort({ date: -1 })
      .limit(5)
      .lean();

     console.log("Recent transactions fetched:", recentTransactions.length);

    console.log("Calculating totals via aggregation...");
    const totals = await Transaction.aggregate([
      // Match using the fetched ObjectId
      { $match: { user: userId } }, // Mongoose handles ObjectId conversion here
      {
        $group: {
          _id: '$type',
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
    const { description, category } = req.body;

    // Basic validation
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

    // Update the fields
    transaction.description = description;
    transaction.category = category;
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

module.exports = {
  addTransaction,
  getDashboardData,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
};