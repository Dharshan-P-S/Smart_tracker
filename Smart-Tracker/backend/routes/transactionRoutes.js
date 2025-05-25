// routes/transactionRoutes.js
const express = require('express');
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

// Temporarily public routes
router.post('/', addTransaction); 
router.post('/monthly-savings', addMonthlySavings);

router.get('/dashboard', getDashboardData);
router.get('/all', getAllTransactions);

// --- NEW ROUTE for Expense Summaries ---
router.get('/expenses/summary', getExpenseSummary); 
router.get('/income/summary', getIncomeSummary);

router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);
router.get('/old', getOldTransactions);
router.get('/current-month/income', getCurrentMonthIncome);
router.get('/current-month/expense', getCurrentMonthExpense);
router.get('/savings/monthly', getMonthlySavings);

module.exports = router;