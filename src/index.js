// src/index.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

// 1. DB Connections
require('./config/db');
require('./config/redis');

// 2. Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

// 3. App Setup
const app = express();
const PORT = process.env.PORT || 5000;

// 4. Naya CORS Options
const allowedOrigins = [
  'http://localhost:3000', // Development ke liye
  process.env.FRONTEND_URL  // Production (Vercel) ke liye
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// 5. Middleware
app.use(cors(corsOptions)); // Naya corsOptions yahaan daalo
app.use(express.json());

// 6. Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

// 7. Test Route
app.get('/', (req, res) => {
  res.send('Outreach Backend API is running!');
});

// 8. Server Start
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});