const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  description: {
    type: String,
    required: [true, 'Please add a description for your goal'],
    trim: true,
  },
  targetAmount: {
    type: Number,
    required: [true, 'Please add a target amount'],
    min: [0.01, 'Target amount must be greater than 0'],
  },
  savedAmount: { // This will be updated based on linked transactions or manual updates
    type: Number,
    default: 0,
    min: [0, 'Saved amount cannot be negative'],
  },
  targetDate: {
    type: Date,
    required: [true, 'Please set a target date'],
  },
  // Optional: Add an icon or color for visual representation
  icon: {
    type: String,
    default: '🎯' // Default goal icon
  },
  // Optional: status of the goal (e.g., 'active', 'achieved', 'archived')
  status: {
    type: String,
    enum: ['active', 'achieved', 'archived'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Middleware to update `updatedAt` on save
GoalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware to update `updatedAt` on findOneAndUpdate
GoalSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});


module.exports = mongoose.model('Goal', GoalSchema);