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

// 4. Allowed Origins
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
];

console.log("✅ Allowed Origins:", allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('❌ Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// 5. Middleware
app.use(cors(corsOptions));
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
