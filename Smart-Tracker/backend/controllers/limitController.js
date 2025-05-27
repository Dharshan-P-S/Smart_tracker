// controllers/limitController.js
const Limit = require('../models/Limit');
const Transaction = require('../models/Transaction');
// const User = require('../models/User'); // Likely not needed directly anymore
const mongoose = require('mongoose');

// @desc    Get all limits for the logged-in user
// @route   GET /api/limits
exports.getLimits = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Not authorized, user information missing.' });
        }
        const userId = req.user._id;

        const limits = await Limit.find({ user: userId });

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const limitsWithSpending = await Promise.all(limits.map(async (limit) => {
            const spendingResult = await Transaction.aggregate([
                {
                    $match: {
                        user: userId,
                        type: 'expense',
                        category: { $regex: new RegExp(`^${limit.category}$`, 'i') },
                        date: { $gte: startOfMonth, $lte: endOfMonth }
                    }
                },
                { $group: { _id: null, totalSpending: { $sum: '$amount' } } }
            ]);
            const currentSpending = spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;
            return {
                ...limit.toObject(),
                currentSpending: currentSpending,
                remainingAmount: limit.amount - currentSpending,
                exceeded: currentSpending > limit.amount
            };
        }));

        res.json(limitsWithSpending);
    } catch (err) {
        console.error('Error fetching limits:', err.message, err.stack);
        res.status(500).send('Server Error fetching limits.');
    }
};

// @desc    Add a new limit for the logged-in user
// @route   POST /api/limits
exports.addLimit = async (req, res) => {
    const { category, amount } = req.body;

    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id;

    if (!category || amount === undefined) {
        return res.status(400).json({ message: 'Category and amount are required' });
    }
    if (typeof amount !== 'number' || amount < 0) {
        return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }

    try {
        const existingLimit = await Limit.findOne({ user: userId, category });
        if (existingLimit) {
            return res.status(400).json({ message: `Limit for category '${category}' already exists. You can update it instead.` });
        }

        const newLimit = new Limit({
            user: userId,
            category,
            amount,
        });
        const limit = await newLimit.save();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const spendingResult = await Transaction.aggregate([
            {
                $match: {
                    user: userId, type: 'expense',
                    category: { $regex: new RegExp(`^${limit.category}$`, 'i') },
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            { $group: { _id: null, totalSpending: { $sum: '$amount' } } }
        ]);
        const currentSpending = spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;

        res.status(201).json({
            ...limit.toObject(),
            currentSpending: currentSpending,
            remainingAmount: limit.amount - currentSpending,
            exceeded: currentSpending > limit.amount
        });

    } catch (err) {
        console.error('Error adding limit:', err.message, err.stack);
        if (err.code === 11000) {
            return res.status(400).json({ message: `Limit for category '${category}' already exists.` });
        }
        res.status(500).send('Server Error adding limit.');
    }
};

// @desc    Update an existing limit
// @route   PUT /api/limits/:id
exports.updateLimit = async (req, res) => {
    const { category, amount } = req.body;
    const limitId = req.params.id;

    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id;

    if (amount === undefined && category === undefined) {
        return res.status(400).json({ message: 'Provide at least category or amount to update.' });
    }
    if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
        return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }
    if (category !== undefined && (typeof category !== 'string' || category.trim() === '')) {
        return res.status(400).json({ message: 'Category must be a non-empty string' });
    }

    try {
        let limit = await Limit.findById(limitId);
        if (!limit) return res.status(404).json({ message: 'Limit not found' });
        if (limit.user.toString() !== userId.toString()) return res.status(401).json({ message: 'Not authorized to update this limit' });

        const updateFields = {};
        if (category !== undefined) updateFields.category = category.trim();
        if (amount !== undefined) updateFields.amount = amount;

        if (updateFields.category && updateFields.category !== limit.category) {
            const existingLimitForNewCategory = await Limit.findOne({
                user: userId, category: updateFields.category,
                _id: { $ne: limitId }
            });
            if (existingLimitForNewCategory) {
                existingLimitForNewCategory.amount += updateFields.amount !== undefined ? updateFields.amount : limit.amount;
                await existingLimitForNewCategory.save();
                await Limit.findByIdAndDelete(limitId); // Corrected: use findByIdAndDelete

                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                const spendingResult = await Transaction.aggregate([
                    { $match: { user: userId, type: 'expense', category: { $regex: new RegExp(`^${existingLimitForNewCategory.category}$`, 'i') }, date: { $gte: startOfMonth, $lte: endOfMonth } } },
                    { $group: { _id: null, totalSpending: { $sum: '$amount' } } }
                ]);
                const currentSpending = spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;
                return res.json({ ...existingLimitForNewCategory.toObject(), currentSpending: currentSpending, remainingAmount: existingLimitForNewCategory.amount - currentSpending, exceeded: currentSpending > existingLimitForNewCategory.amount });
            }
        }

        limit = await Limit.findByIdAndUpdate(limitId, { $set: updateFields }, { new: true, runValidators: true });
        if (!limit) return res.status(404).json({ message: 'Limit not found after update attempt.' }); // Should not happen if initial findById worked


        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const spendingResult = await Transaction.aggregate([
            { $match: { user: userId, type: 'expense', category: { $regex: new RegExp(`^${limit.category}$`, 'i') }, date: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, totalSpending: { $sum: '$amount' } } }
        ]);
        const currentSpending = spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;
        res.json({ ...limit.toObject(), currentSpending: currentSpending, remainingAmount: limit.amount - currentSpending, exceeded: currentSpending > limit.amount });

    } catch (err) {
        console.error('Error updating limit:', err.message, err.stack);
        if (err.code === 11000 && category !== undefined) {
            return res.status(400).json({ message: `A limit for category '${category}' already exists.` });
        }
        res.status(500).send('Server Error updating limit.');
    }
};

// @desc    Delete a limit
// @route   DELETE /api/limits/:id
exports.deleteLimit = async (req, res) => {
    const limitId = req.params.id;
    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id;

    try {
        const limit = await Limit.findOne({ _id: limitId, user: userId }); // Ensure it belongs to the user
        if (!limit) {
            return res.status(404).json({ message: 'Limit not found or not authorized' });
        }
        await Limit.findByIdAndDelete(limitId);
        res.json({ message: 'Limit removed successfully' });
    } catch (err) {
        console.error('Error deleting limit:', err.message, err.stack);
        res.status(500).send('Server Error deleting limit.');
    }
};