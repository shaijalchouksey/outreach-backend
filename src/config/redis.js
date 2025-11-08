// src/config/redis.js
const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// 1. Pehle options ka object banao
const clientOptions = {
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
};

// --- DEBUGGING CHECK ---
const redisPassword = process.env.REDIS_PASSWORD;

// Yeh line humein sach batayegi:
console.log(`[DEBUG] REDIS_PASSWORD from .env is: "${redisPassword}"`);
// (Humne quotes daale hain taaki "space" jaisi cheezein dikh jaayein)
// --- END OF DEBUGGING ---

// 2. Check karo: Agar password hai (aur khaali string nahi hai), tabhi use add karo
if (redisPassword && redisPassword.trim() !== '') {
  console.log('[DEBUG] Password found, adding it to options.');
  clientOptions.password = redisPassword.trim();
} else {
  console.log('[DEBUG] No password found, connecting without password.');
}

// 3. Ab client ko options ke saath banao
const redisClient = createClient(clientOptions);

redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
  await redisClient.connect();
  console.log('✅ Redis connected successfully!');
})();

module.exports = redisClient;