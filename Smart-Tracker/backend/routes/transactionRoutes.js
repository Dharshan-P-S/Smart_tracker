// routes/transactionRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware'); // <<<< IMPORT PROTECT MIDDLEWARE
const {
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
    getIncomeSummary
} = require('../controllers/transactionController');

const router = express.Router();

// Apply 'protect' middleware to all routes that need authentication
router.post('/', protect, addTransaction);
router.post('/monthly-savings', protect, addMonthlySavings);

router.get('/dashboard', protect, getDashboardData);
router.get('/all', protect, getAllTransactions); // Consider if "all" should truly be all or all for the user

router.get('/expenses/summary', protect, getExpenseSummary);
router.get('/income/summary', protect, getIncomeSummary);

router.put('/:id', protect, updateTransaction);
router.delete('/:id', protect, deleteTransaction);
router.get('/old', protect, getOldTransactions);
router.get('/current-month/income', protect, getCurrentMonthIncome);
router.get('/current-month/expense', protect, getCurrentMonthExpense);
router.get('/savings/monthly', protect, getMonthlySavings);

module.exports = router;