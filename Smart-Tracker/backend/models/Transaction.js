// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: { // For regular transactions: 'income' or 'expense'. For override: could be 'income' if net positive, 'expense' if net negative.
    type: String,
    required: true,
    enum: ['income', 'expense'],
  },
  amount: { // For regular transactions: always positive. For override: absolute value of the net savings.
    type: Number,
    required: true,
    min: [0.00, 'Amount must be non-negative'], // Allow 0 for overrides that result in zero net savings
  },
  actualAmount: { // Specific for overrides: stores the actual net savings (can be negative)
    type: Number,
    required: function() { return this.isOverride === true; } // Required only if it's an override
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Description cannot be more than 100 characters'],
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Category cannot be more than 50 characters'],
  },
  emoji: {
    type: String,
    trim: true,
    maxlength: [5, 'Emoji cannot be more than 5 characters'],
    default: '',
  },
  date: { // For overrides, this will be the first day of the month
    type: Date,
    required: true,
    default: Date.now,
  },
  recurrence: { // Overrides will always be 'once'
    type: String,
    required: true,
    enum: ['once', 'daily', 'weekly', 'monthly'],
    default: 'once',
  },
  isOverride: { // New field to clearly mark override transactions
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, monthYearKey: 1, isOverride: 1 }); // For quick override checks

module.exports = mongoose.model('Transaction', transactionSchema);