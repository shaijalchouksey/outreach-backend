-- Yeh line UUIDs generate karne ke liye extension enable karti hai (unique IDs ke liye)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. tenants (organizations) table
-- Yeh table company ki main info rakhegi
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL, -- Har company ka domain unique hona chahiye
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. users table
-- Yeh table login karne waale users ki info rakhegi
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Yeh 'tenants' table se link karega
    email VARCHAR(255) UNIQUE NOT NULL, -- Har user ka email unique hona chahiye
    password_hash VARCHAR(255) NOT NULL, -- Hum yahaan bcrypt hash save karenge
    
    -- Hum role define kar sakte hain, jaise 'admin' ya 'member'
    role VARCHAR(50) NOT NULL DEFAULT 'admin', 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_tenant
    FOREIGN KEY(tenant_id)
	REFERENCES tenants(id)
    ON DELETE CASCADE -- Agar tenant delete hota hai, toh uske users bhi delete ho jaayein
);

-- Index (optional but good)
-- Database search ko fast karne ke liye
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);

-- Add columns for password reset
ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMPTZ NULL;

-- Index banao token par taaki usse dhoondhna fast ho
CREATE INDEX idx_users_reset_token ON users(reset_token);