// models/Transaction.js
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
        enum: ['income', 'expense', 'monthly_savings'], // Added 'monthly_savings'
    },
    amount: {
        type: Number,
        required: true,
        // min: [0.01, 'Amount must be positive'], // For income/expense. monthly_savings can be negative.
        validate: {
            validator: function(v) {
                if (this.type === 'income' || this.type === 'expense') {
                    return v > 0;
                }
                return true; // monthly_savings can be any number
            },
            message: props => `${props.path} must be positive for income/expense types.`
        }
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
    date: { // For 'monthly_savings', this will be the first day of the month
        type: Date,
        required: true,
        default: Date.now,
    },
    recurrence: { // 'monthly_savings' will always be 'once'
        type: String,
        required: true,
        enum: ['once', 'daily', 'weekly', 'monthly'],
        default: 'once',
    },
}, {
    timestamps: true,
});

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: 1 }); // For querying monthly_savings efficiently

module.exports = mongoose.model('Transaction', transactionSchema);