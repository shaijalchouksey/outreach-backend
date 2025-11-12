const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');


// 1. DB Connections
require('./config/db');
require('./config/redis');

// 2. Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const intentRoutes = require('./routes/intentRoutes'); // <-- (1) NAYI LINE
const analyticsRoutes = require('./routes/analyticsRoutes');

// 3. App Setup
const app = express();
const PORT = process.env.PORT || 5000;

// 4. Allowed Origins
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
];

console.log("✅ Allowed Origins:", allowedOrigins);

const corsOptions  = {
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
// Increase body size limit to 50MB for TikTok posts data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 6. Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/intent', intentRoutes); // <-- (2) NAYI LINE
app.use('/api/v1/analytics', analyticsRoutes);

// 7. Test Route
app.get('/', (req, res) => {
  res.send('Outreach Backend API is running!');
});

// 8. Server Start
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
