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

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- Add columns for password reset
ALTER TABLE users ADD COLUMN reset_token TEXT;
ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMPTZ;
CREATE INDEX idx_users_reset_token ON users(reset_token);


-- --- (YAHAA SE NAYA CODE ADD KARO) ---
-- --- NAYI TABLE TIKTOK DATA KE LIYE ---

CREATE TABLE tiktok_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Yeh TikTok post ki unique ID hai (taaki hum duplicates save na karein)
    post_id TEXT UNIQUE NOT NULL, 
    
    -- Humne kis keyword/hashtag ko search karke yeh post dhoondha (e.g., "travel")
    search_hashtag TEXT NOT NULL,
    
    -- Post kab banaya gaya tha (date filtering ke liye)
    post_created_at TIMESTAMPTZ,
    
    -- Sorting ke liye alag se columns (taaki fast sort ho)
    play_count BIGINT DEFAULT 0,
    digg_count BIGINT DEFAULT 0, -- (Likes)
    comment_count BIGINT DEFAULT 0,
    share_count BIGINT DEFAULT 0,
    
    -- Sabse zaroori: Poora ka poora JSON data jaisa Apify se aaya
    raw_data JSONB NOT NULL,
    
    -- Humne ise apne database mein kab save kiya
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nayi table ke liye Indexes (taaki search fast ho)
CREATE INDEX idx_tiktok_posts_search_hashtag ON tiktok_posts(search_hashtag);
CREATE INDEX idx_tiktok_posts_post_created_at ON tiktok_posts(post_created_at);
CREATE INDEX idx_tiktok_posts_play_count ON tiktok_posts(play_count);

-- --- NAYA CODE (Search History Table) ---

CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL, -- (e.g., 'tiktok', 'youtube')
    search_term TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- (User delete hone par history bhi delete kar do)
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, 
    -- (Tenant delete hone par history bhi delete kar do)
    FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE 
);

-- (Indexing taaki search fast ho)
CREATE INDEX IF NOT EXISTS idx_history_user_id ON search_history (user_id);
CREATE INDEX IF NOT EXISTS idx_history_tenant_id ON search_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_history_platform ON search_history (platform);

-- --- NAYA CODE (Instagram Posts Table) ---

CREATE TABLE IF NOT EXISTS instagram_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Yeh Instagram post ki unique ID hai (taaki hum duplicates save na karein)
    post_id TEXT UNIQUE NOT NULL, 
    
    -- Humne kis keyword/hashtag ko search karke yeh post dhoondha (e.g., "travel")
    search_hashtag TEXT NOT NULL,
    
    -- Post owner ka username
    owner_username TEXT,
    
    -- Post caption
    caption TEXT,
    
    -- Post kab banaya gaya tha (date filtering ke liye)
    post_created_at TIMESTAMPTZ,
    
    -- Engagement metrics (Instagram specific)
    likes_count BIGINT DEFAULT 0,
    comments_count BIGINT DEFAULT 0,
    saves_count BIGINT DEFAULT 0,
    shares_count BIGINT DEFAULT 0,
    views_count BIGINT DEFAULT 0,
    
    -- Sabse zaroori: Poora ka poora JSON data jaisa Apify se aaya
    raw_data JSONB NOT NULL,
    
    -- Humne ise apne database mein kab save kiya
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nayi table ke liye Indexes (taaki search fast ho)
CREATE INDEX IF NOT EXISTS idx_instagram_posts_search_hashtag ON instagram_posts(search_hashtag);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_post_created_at ON instagram_posts(post_created_at);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_owner_username ON instagram_posts(owner_username);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_likes_count ON instagram_posts(likes_count);
