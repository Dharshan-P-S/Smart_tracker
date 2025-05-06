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
  emoji: { // New field for storing the emoji
    type: String,
    trim: true,
    maxlength: [5, 'Emoji cannot be more than 5 characters'], // Emojis are usually 1-2 chars, but allow for variation
    default: '', // Default to empty string if no emoji is provided
  },
  date: {
    type: Date,
    required: true,
    default: Date.now, // Default to current date
  },
  recurrence: {
    type: String,
    required: true,
    enum: ['once', 'daily', 'weekly', 'monthly'],
    default: 'once',
  },
  // Optional fields for recurrence tracking (add later if implementing scheduler)
  // lastProcessedDate: { type: Date },
  // recurringEndDate: { type: Date },
  // originalRecurringTxId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' } // Links generated tx back to original
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

// Optional: Indexing for faster queries based on user and date
transactionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
