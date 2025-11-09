const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sgMail = require('../config/email');
const dotenv = require('dotenv');

dotenv.config();

// --- REGISTER (Koi Change Nahi) ---
const register = async (req, res) => {
    const { companyName, companyEmail, domain, password } = req.body;

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [companyEmail]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Email address is already in use.' });
        }

        const domainCheck = await pool.query('SELECT * FROM tenants WHERE domain = $1', [domain]);
        if (domainCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Domain is already in use.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await pool.query('BEGIN');

        const tenantResult = await pool.query(
            'INSERT INTO tenants (company_name, domain) VALUES ($1, $2) RETURNING id',
            [companyName, domain]
        );
        const newTenantId = tenantResult.rows[0].id;

        const userResult = await pool.query(
            'INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [newTenantId, companyEmail, passwordHash, 'admin']
        );
        const newUserId = userResult.rows[0].id;

        await pool.query('COMMIT');

        res.status(201).json({
            message: 'Tenant and Admin User created successfully!',
            tenantId: newTenantId,
            userEmail: companyEmail
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Registration Error:', error.message);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// --- LOGIN (Koi Change Nahi) ---
const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        let companyName = 'Your Company'; 
        try {
            const tenantResult = await pool.query(
                'SELECT company_name FROM tenants WHERE id = $1',
                [user.tenant_id]
            );
            if (tenantResult.rows.length > 0) {
                companyName = tenantResult.rows[0].company_name;
            }
        } catch (tenantError) {
            console.error("Error fetching tenant name:", tenantError);
        }
        
        const payload = {
            userId: user.id,
            tenantId: user.tenant_id,
            email: user.email,
            role: user.role,
            companyName: companyName
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Login successful!',
            token: token
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- FORGOT PASSWORD (Yeh function UPDATE hua hai) ---
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            console.log(`Password reset attempt for non-existent email: ${email}`);
            return res.status(200).json({ message: 'If your email is registered, you will receive a reset link.' });
        }
        
        const user = userResult.rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [resetToken, resetTokenExpires, user.id]
        );

        // --- (NAYA CHANGE YAHAA SE) ---
        // (1) .env se FRONTEND_URL uthao. Agar nahi mili, toh fallback localhost use karo.
        const frontendAppUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // (2) URL ko dynamic banao
        const resetUrl = `${frontendAppUrl}/reset?token=${resetToken}`;
        // --- (CHANGE ENDS) ---

        const msg = {
          to: user.email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL,
            name: 'Outreach App Support'
          },
          subject: 'Your Password Reset Link',
          text: `You requested a password reset. Click this link (valid for 1 hour): ${resetUrl}`,
            html: `
              <p>You requested a password reset. Click this link (valid for 1 hour):</p>
              <a href="${resetUrl}" target="_blank" style="color:#7c3aed;text-decoration:none;">
                ${resetUrl}
              </a>
            `,
        };

        await sgMail.send(msg);

        console.log(`Password reset email sent to: ${user.email} (via SendGrid)`);
        res.status(200).json({ message: 'If your email is registered, you will receive a reset link.' });

    } catch (error) {
        console.error('Forgot Password Error (SendGrid):', error);
        if (error.response) {
            console.error(error.response.body)
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// --- RESET PASSWORD (Koi Change Nahi) ---
const resetPassword = async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired password reset token.' });
        }
        
        const user = userResult.rows[0];
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(password, salt);

        await pool.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [newPasswordHash, user.id]
        );

        res.status(200).json({ message: 'Password reset successful. You can now login.' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword,
};