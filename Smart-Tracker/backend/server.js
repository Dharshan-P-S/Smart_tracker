require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');

// Connect to Database
connectDB();

// Initialize Express app
const app = express();

// Init Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ extended: false })); // Allow app to accept JSON data

console.log('Backend server starting...');

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/limits', require('./routes/limitRoutes')); // Add limit routes

// Basic route
app.get('/', (req, res) => res.send('API Running'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
