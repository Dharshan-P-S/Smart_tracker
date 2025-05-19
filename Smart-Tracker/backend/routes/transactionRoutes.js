const express = require('express');
// Import the newly added controller functions
const {
    addTransaction,
    getDashboardData,
    getAllTransactions,
    updateTransaction,
    deleteTransaction,
    getOldTransactions,
    getCurrentMonthIncome,  // Import needed function
    getCurrentMonthExpense, // Import needed function
    getMonthlySavings // Add this import
} = require('../controllers/transactionController');
// const { protect } = require('../middleware/authMiddleware'); // <-- Commented out

const router = express.Router();

// router.use(protect); // <-- Commented out

// Routes are now temporarily public
router.post('/', addTransaction); // POST /api/transactions

// Route for getting dashboard data
router.get('/dashboard', getDashboardData); // GET /api/transactions/dashboard

// GET /api/transactions/all (New Route)
router.get('/all', getAllTransactions); // Add the route for the new controller

router.put('/:id', updateTransaction); // Add the PUT route for updates

router.delete('/:id', deleteTransaction); // Add the DELETE route

// GET /api/transactions/old (New Route for old transactions)
router.get('/old', getOldTransactions);

// GET /api/transactions/current-month/income (New Route for current month income)
router.get('/current-month/income', getCurrentMonthIncome);

// GET /api/transactions/current-month/expense (New Route for current month expense)
router.get('/current-month/expense', getCurrentMonthExpense);

// GET /api/transactions/savings/monthly (New Route for monthly savings)
router.get('/savings/monthly', getMonthlySavings);


module.exports = router;
