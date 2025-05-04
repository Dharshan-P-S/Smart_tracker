const express = require('express');
const { addTransaction, getDashboardData, getAllTransactions, updateTransaction } = require('../controllers/transactionController');
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

module.exports = router; 