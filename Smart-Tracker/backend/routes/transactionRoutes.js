// routes/transactionRoutes.js
const express = require('express');
const {
    addTransaction,
    addMonthlySavings, // Import new controller
    getDashboardData,
    getAllTransactions,
    updateTransaction,
    deleteTransaction,
    getOldTransactions,
    getCurrentMonthIncome,
    getCurrentMonthExpense,
    getMonthlySavings
} = require('../controllers/transactionController');

const router = express.Router();

// Temporarily public routes
router.post('/', addTransaction); 
router.post('/monthly-savings', addMonthlySavings); // New route for adding monthly total savings

router.get('/dashboard', getDashboardData);
router.get('/all', getAllTransactions);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);
router.get('/old', getOldTransactions);
router.get('/current-month/income', getCurrentMonthIncome);
router.get('/current-month/expense', getCurrentMonthExpense);
router.get('/savings/monthly', getMonthlySavings);

module.exports = router;