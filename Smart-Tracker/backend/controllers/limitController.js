const Limit = require('../models/Limit');
const Transaction = require('../models/Transaction'); // Needed to calculate current spending
const User = require('../models/User'); // Need User model for placeholder

// --- INSECURE PLACEHOLDER ---
// Fetches the first user's ID to use in place of authenticated user.
// DO NOT USE IN PRODUCTION. Authentication should be properly handled.
const getPlaceholderUserId = async () => {
    const firstUser = await User.findOne().select('_id');
    if (!firstUser) {
        throw new Error("No users found in the database to use as a placeholder.");
    }
    return firstUser._id;
};
// --- END INSECURE PLACEHOLDER ---

// @desc    Get all limits for the logged-in user (using placeholder)
// @route   GET /api/limits
// @access  Public (Effectively, due to removed middleware)
exports.getLimits = async (req, res) => {
    try {
        const placeholderUserId = await getPlaceholderUserId(); // Get placeholder ID
        const limits = await Limit.find({ user: placeholderUserId }); // Use placeholder ID

        // Get start and end of the current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // End of the last day

        // Calculate current spending for each category within the current month
        const limitsWithSpending = await Promise.all(limits.map(async (limit) => {
            const spendingResult = await Transaction.aggregate([
                {
                    $match: {
                        user: placeholderUserId, // Use placeholder ID
                        type: 'expense',
                        // Case-insensitive category match
                        category: { $regex: new RegExp(`^${limit.category}$`, 'i') },
                        date: { $gte: startOfMonth, $lte: endOfMonth } // Filter by current month
                    }
                },
                { $group: { _id: null, totalSpending: { $sum: '$amount' } } }
            ]);
            const currentSpending = spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;
            return {
                ...limit.toObject(), // Convert Mongoose doc to plain object
                currentSpending: currentSpending,
                remainingAmount: limit.amount - currentSpending,
                exceeded: currentSpending > limit.amount
            };
        }));

        res.json(limitsWithSpending);
    } catch (err) {
        console.error('Error fetching limits:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a new limit for the logged-in user (using placeholder)
// @route   POST /api/limits
// @access  Public (Effectively)
exports.addLimit = async (req, res) => {
    const { category, amount } = req.body;
    let placeholderUserId; // Define here to use in catch block if needed

    // Basic validation
    if (!category || amount === undefined) {
        return res.status(400).json({ message: 'Category and amount are required' });
    }
    if (typeof amount !== 'number' || amount < 0) {
        return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }

    try {
        placeholderUserId = await getPlaceholderUserId(); // Get placeholder ID
        // Check if limit for this category already exists for the user
        const existingLimit = await Limit.findOne({ user: placeholderUserId, category }); // Use placeholder ID
        if (existingLimit) {
            return res.status(400).json({ message: `Limit for category '${category}' already exists. You can update it instead.` });
        }

        const newLimit = new Limit({
            user: placeholderUserId, // Use placeholder ID
            category,
            amount,
        });

        const limit = await newLimit.save();

        // Also return spending info (for current month) for the newly added limit
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

         const spendingResult = await Transaction.aggregate([
             {
                 $match: {
                     user: placeholderUserId, // Use placeholder ID
                     type: 'expense',
                      // Case-insensitive category match
                     category: { $regex: new RegExp(`^${limit.category}$`, 'i') },
                     date: { $gte: startOfMonth, $lte: endOfMonth } // Filter by current month
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
        console.error('Error adding limit:', err.message);
        // Handle potential duplicate key error from the index
        if (err.code === 11000) {
             return res.status(400).json({ message: `Limit for category '${category}' already exists.` });
        }
        res.status(500).send('Server Error');
    }
};

// @desc    Update an existing limit (using placeholder)
// @route   PUT /api/limits/:id
// @access  Public (Effectively)
exports.updateLimit = async (req, res) => {
    const { category, amount } = req.body;
    const limitId = req.params.id;
    let placeholderUserId; // Define here to use in catch block if needed

    // Basic validation
    if (amount === undefined && category === undefined) {
         return res.status(400).json({ message: 'Provide at least category or amount to update.' });
    }
     if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
        return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }
     if (category !== undefined && typeof category !== 'string' || category.trim() === '') {
         return res.status(400).json({ message: 'Category must be a non-empty string' });
     }


    try {
        placeholderUserId = await getPlaceholderUserId(); // Get placeholder ID
        let limit = await Limit.findById(limitId);

        if (!limit) {
            return res.status(404).json({ message: 'Limit not found' });
        }

        // Ensure the limit belongs to the placeholder user (INSECURE CHECK)
        if (limit.user.toString() !== placeholderUserId.toString()) {
             console.warn(`Attempt to update limit ${limitId} not belonging to placeholder user ${placeholderUserId}`);
            // In a real scenario without auth, you might allow this or block it.
            // For testing, we'll block it to mimic ownership check.
            return res.status(401).json({ message: 'Not authorized (placeholder check)' });
        }

        // Prepare update fields
        const updateFields = {};
        if (category !== undefined) updateFields.category = category.trim();
        if (amount !== undefined) updateFields.amount = amount;


        // If category is being changed, check if a limit for the *new* category already exists
        if (updateFields.category && updateFields.category !== limit.category) {
            const existingLimitForNewCategory = await Limit.findOne({
                user: placeholderUserId, // Use placeholder ID
                category: updateFields.category,
                _id: { $ne: limitId } // Exclude the current limit being updated
            });
            if (existingLimitForNewCategory) {
                return res.status(400).json({ message: `A limit for category '${updateFields.category}' already exists.` });
            }
        }


        limit = await Limit.findByIdAndUpdate(
            limitId,
            { $set: updateFields },
            { new: true, runValidators: true } // Return updated doc, run schema validators
        );

         // Also return spending info (for current month) for the updated limit
         const now = new Date();
         const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
         const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

         const spendingResult = await Transaction.aggregate([
             {
                 $match: {
                     user: placeholderUserId, // Use placeholder ID
                     type: 'expense',
                      // Case-insensitive category match
                     category: { $regex: new RegExp(`^${limit.category}$`, 'i') },
                     date: { $gte: startOfMonth, $lte: endOfMonth } // Filter by current month
                 }
             },
            { $group: { _id: null, totalSpending: { $sum: '$amount' } } }
        ]);
        const currentSpending = spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;


        res.json({
             ...limit.toObject(),
             currentSpending: currentSpending,
             remainingAmount: limit.amount - currentSpending,
             exceeded: currentSpending > limit.amount
        });

    } catch (err) {
        console.error('Error updating limit:', err.message);
         // Handle potential duplicate key error from the index if category is changed
        if (err.code === 11000 && category !== undefined) {
             return res.status(400).json({ message: `A limit for category '${category}' already exists.` });
        }
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a limit (using placeholder)
// @route   DELETE /api/limits/:id
// @access  Public (Effectively)
exports.deleteLimit = async (req, res) => {
    const limitId = req.params.id;

    try {
        const placeholderUserId = await getPlaceholderUserId(); // Get placeholder ID
        const limit = await Limit.findById(limitId);

        if (!limit) {
            return res.status(404).json({ message: 'Limit not found' });
        }

        // Ensure the limit belongs to the placeholder user (INSECURE CHECK)
        if (limit.user.toString() !== placeholderUserId.toString()) {
            console.warn(`Attempt to delete limit ${limitId} not belonging to placeholder user ${placeholderUserId}`);
             // Block deletion for testing consistency
            return res.status(401).json({ message: 'Not authorized (placeholder check)' });
        }

        await Limit.findByIdAndDelete(limitId); // Use findByIdAndDelete

        res.json({ message: 'Limit removed successfully' });

    } catch (err) {
        console.error('Error deleting limit:', err.message);
        res.status(500).send('Server Error');
    }
};
