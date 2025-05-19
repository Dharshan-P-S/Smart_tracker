// routes/transactionRoutes.js
const express = require('express');
const {
    addTransaction,
    getDashboardData,
    getAllTransactions,
    updateTransaction,
    deleteTransaction,
    getOldTransactions,
    getCurrentMonthIncome,
    getCurrentMonthExpense,
    getMonthlySavings,
    // Import new override controllers
    addOrUpdateMonthlyOverride,
    deleteMonthlyOverride,
} = require('../controllers/transactionController');
// const { protect } = require('../middleware/authMiddleware'); // <-- Commented out

const router = express.Router();

// router.use(protect); // <-- Commented out

// Regular Transaction Routes
router.post('/', addTransaction);
router.get('/dashboard', getDashboardData);
router.get('/all', getAllTransactions);
router.put('/:id', updateTransaction); // For regular transactions
router.delete('/:id', deleteTransaction); // For regular transactions
router.get('/old', getOldTransactions);
router.get('/current-month/income', getCurrentMonthIncome);
router.get('/current-month/expense', getCurrentMonthExpense);
router.get('/savings/monthly', getMonthlySavings);

// Monthly Override Routes
router.post('/monthly-override', addOrUpdateMonthlyOverride);
router.delete('/monthly-override/:monthYear', deleteMonthlyOverride); // :monthYear will be "YYYY-MM"

module.exports = router;