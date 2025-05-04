const Transaction = require('../models/Transaction');
// const User = require('../models/User'); // Keep if needed for other logic
const mongoose = require('mongoose');

// Placeholder for testing without authentication
// *** Replace this with actual user ID from req.user when auth is added ***
const TEMP_USER_ID = "605c72ef1e8d4e3e1c8b4567"; // Example valid 24-hex character ObjectId string

// @desc    Add a new transaction
// @route   POST /api/transactions
// @access  Public (Temporarily)
const addTransaction = async (req, res) => {
  try {
    const { type, amount, description, category, date } = req.body;
    const userId = TEMP_USER_ID; // <-- Use temporary ID

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

    const newTransaction = new Transaction({
      user: userId, // Use temp ID
      type,
      amount: parseFloat(amount),
      description,
      category,
      date: date ? new Date(date) : new Date(),
    });

    const savedTransaction = await newTransaction.save();
    res.status(201).json(savedTransaction);

  } catch (error) {
    console.error('Error adding transaction:', error);
     if (error instanceof mongoose.Error.ValidationError) {
         return res.status(400).json({ message: error.message });
     }
    res.status(500).json({ message: 'Server error while adding transaction' });
  }
};

// @desc    Get dashboard data (totals, recent transactions)
// @route   GET /api/dashboard
// @access  Public (Temporarily)
const getDashboardData = async (req, res) => {
  console.log("Attempting to fetch dashboard data for TEMP user:", TEMP_USER_ID);

  try {
    const userId = TEMP_USER_ID; // <-- Use temporary ID

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
         console.error("Temporary User ID is missing or invalid:", userId);
         return res.status(500).json({ message: 'Temporary User ID configuration error or invalid format.' });
     }

    console.log(`Fetching transactions for temp user ID: ${userId}`);

    const recentTransactions = await Transaction.find({ user: userId }) // Use temp ID
      .sort({ date: -1 })
      .limit(5)
      .lean();

     console.log("Recent transactions fetched:", recentTransactions.length);

    console.log("Calculating totals via aggregation...");
    const totals = await Transaction.aggregate([
      // Use 'new' to construct the ObjectId
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
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
    console.error('!!! Temp User ID:', TEMP_USER_ID);
    console.error('!!! Error Name:', error.name);
    console.error('!!! Error Message:', error.message);
    console.error('!!! Error Stack:');
    console.error(error.stack);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    res.status(500).json({ message: 'Server error while fetching dashboard data. Check backend logs.' });
  }
};

// @desc    Get ALL transactions for the temp user
// @route   GET /api/transactions/all
// @access  Public (Temporarily)
const getAllTransactions = async (req, res) => {
    console.log("Attempting to fetch ALL transactions for TEMP user:", TEMP_USER_ID);
    try {
        const userId = TEMP_USER_ID;

         if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            console.error("Temporary User ID is missing or invalid:", userId);
            return res.status(500).json({ message: 'Temporary User ID configuration error or invalid format.' });
        }

        // Fetch all transactions for the user, sorted by date descending
        const allTransactions = await Transaction.find({ user: userId })
            .sort({ date: -1 })
            .lean(); // Use lean for performance

        console.log(`Fetched ${allTransactions.length} total transactions.`);

        res.status(200).json(allTransactions);

    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error fetching ALL transactions in Controller:');
        console.error('!!! Temp User ID:', TEMP_USER_ID);
        console.error('!!! Error:', error);
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while fetching all transactions.' });
    }
};

// @desc    Update a transaction (description & category only)
// @route   PUT /api/transactions/:id
// @access  Public (Temporarily)
const updateTransaction = async (req, res) => {
  try {
    const userId = TEMP_USER_ID; // <-- Use temporary ID
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
      user: userId 
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
    console.error('!!! Temp User ID:', TEMP_USER_ID);
    console.error('!!! Transaction ID:', req.params.id);
    console.error('!!! Error:', error);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    if (error instanceof mongoose.Error.ValidationError) {
         return res.status(400).json({ message: error.message });
     }
    res.status(500).json({ message: 'Server error while updating transaction.' });
  }
};

module.exports = {
  addTransaction,
  getDashboardData,
  getAllTransactions,
  updateTransaction,
}; 