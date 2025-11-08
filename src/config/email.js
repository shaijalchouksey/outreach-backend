// src/config/email.js
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

dotenv.config();

// (1) .env file se API Key ko set karo
const apiKey = process.env.SENDGRID_API_KEY;

if (apiKey) {
  sgMail.setApiKey(apiKey);
  console.log('✅ SendGrid (Official) Email Transporter is ready.');
} else {
  console.error('*** SendGrid API Key nahi mili. .env file check karo. ***');
}

// (2) Seedha sgMail object ko export karo
module.exports = sgMail;