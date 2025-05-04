const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming you have a User model
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['income', 'expense'], // Only allow these two values
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be positive'], // Ensure amount is positive
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
  date: {
    type: Date,
    required: true,
    default: Date.now, // Default to current date
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

// Optional: Indexing for faster queries based on user and date
transactionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema); 