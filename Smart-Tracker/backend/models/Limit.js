const mongoose = require('mongoose');

const LimitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    // Consider adding unique constraint combined with user if needed
    // unique: true // Be careful: this makes category unique across ALL users
  },
  amount: {
    type: Number,
    required: [true, 'Limit amount is required'],
    min: [0, 'Limit amount cannot be negative'],
  },
  // Optional: Add createdAt/updatedAt timestamps
  // timestamps: true
});

// Optional: Add a compound index for user and category for efficient lookups
// and to potentially enforce uniqueness per user per category
LimitSchema.index({ user: 1, category: 1 }, { unique: true });


module.exports = mongoose.model('Limit', LimitSchema);
