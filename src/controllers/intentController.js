const dotenv = require('dotenv');
dotenv.config();
const pool = require('../config/db');

// (1) Yeh Actor ID hai. Aap Apify par apna khud ka Actor bhi use kar sakte hain.
const TIKTOK_ACTOR_ID = "clockworks/tiktok-scraper"; 
const APIFY_TOKEN = process.env.APIFY_TOKEN;

const getTikTokData = async (req, res) => {
    
    if (!APIFY_TOKEN) {
        console.error("Apify token missing. Check .env file.");
        return res.status(500).json({ message: "Server configuration error: API token missing." });
    }

    try {
        // (2) Frontend se search query lo (e.g., "travel")
        const searchQuery = req.query.query; 
        if (!searchQuery) {
            return res.status(400).json({ message: "Search query is required." });
        }

        console.log(`Starting Apify Actor run for query: ${searchQuery}...`);

        // (3) Apify ko bhejne ke liye Input (sirf 20 results, test ke liye)
        const actorInput = {
            "hashtags": [searchQuery], // Query ko yahaan daala
            "resultsPerPage": 20,
            "shouldDownloadVideos": false,
            "shouldDownloadCovers": false
        };

        // (4) Apify Actor ko RUN karo aur 2 minute tak intezaar (wait) karo
        // Yeh API call 2 minute tak ruki rahegi jab tak scrape poora na ho
        const runResponse = await fetch(
            `https://api.apify.com/v2/acts/${TIKTOK_ACTOR_ID}/runs?token=${APIFY_TOKEN}&wait_for_finish=120`, 
            {
                method: 'POST',
                body: JSON.stringify(actorInput),
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (!runResponse.ok) {
            throw new Error(`Apify Actor run failed: ${runResponse.statusText}`);
        }

        const runObject = await runResponse.json();

        // (5) Check karo ki run successful tha aur data bana
        if (!runObject.data || !runObject.data.defaultDatasetId) {
            throw new Error("Apify run failed or did not produce a dataset.");
        }

        const datasetId = runObject.data.defaultDatasetId;
        console.log(`Apify run finished. Fetching dataset: ${datasetId}`);

        // (6) Naye dataset se naya (LIVE) data fetch karo
        const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        
        if (!itemsResponse.ok) {
            throw new Error(`Failed to fetch dataset items: ${itemsResponse.statusText}`);
        }

        const items = await itemsResponse.json();
        
        console.log(`Successfully fetched ${items.length} live items.`);
        
        // (7) Frontend ko live data bhejo
        res.status(200).json(items);

    } catch (err) {
        console.error("Error in getTikTokData controller:", err.message);
        res.status(500).json({ message: "Server error fetching Apify data." });
    }
};

// Get search history from database
const getSearchHistory = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const platform = req.query.platform || null; // Optional platform filter (tiktok, instagram, etc.)
        const limit = parseInt(req.query.limit) || 10; // Default 10, max 50

        if (!userId || !tenantId) {
            return res.status(401).json({ message: "User authentication required." });
        }

        // Build query with optional platform filter
        // Get unique search terms, most recent first
        let query;
        const params = [userId, tenantId];

        if (platform) {
            query = `
                SELECT DISTINCT ON (search_term) 
                    search_term, 
                    platform, 
                    created_at
                FROM search_history
                WHERE user_id = $1 AND tenant_id = $2 AND platform = $3
                ORDER BY search_term, created_at DESC
                LIMIT $4
            `;
            params.push(platform.toLowerCase());
            params.push(Math.min(limit, 50));
        } else {
            query = `
                SELECT DISTINCT ON (search_term) 
                    search_term, 
                    platform, 
                    created_at
                FROM search_history
                WHERE user_id = $1 AND tenant_id = $2
                ORDER BY search_term, created_at DESC
                LIMIT $3
            `;
            params.push(Math.min(limit, 50));
        }

        const result = await pool.query(query, params);
        
        // Sort by most recent first
        result.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Format response
        const history = result.rows.map(row => ({
            search_term: row.search_term,
            platform: row.platform,
            created_at: row.created_at
        }));

        res.status(200).json({
            history: history,
            count: history.length
        });

    } catch (err) {
        console.error("Error fetching search history:", err.message);
        res.status(500).json({ message: "Server error fetching search history." });
    }
};

// Save search query to database
const saveSearchHistory = async (req, res) => {
    try {
        const { search_term, platform = 'tiktok' } = req.body;
        const userId = req.user?.userId; // From authMiddleware (JWT token contains 'userId')
        const tenantId = req.user?.tenantId; // From authMiddleware (JWT token contains 'tenantId')

        // Validation
        if (!search_term || !search_term.trim()) {
            return res.status(400).json({ message: "Search term is required." });
        }

        if (!userId || !tenantId) {
            return res.status(401).json({ message: "User authentication required." });
        }

        // Save to database
        const query = `
            INSERT INTO search_history (user_id, tenant_id, platform, search_term, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, search_term, platform, created_at
        `;

        const result = await pool.query(query, [
            userId,
            tenantId,
            platform.toLowerCase(),
            search_term.trim()
        ]);

        console.log(`Search saved: ${search_term} by user ${userId}`);

        res.status(201).json({
            message: "Search saved successfully",
            data: result.rows[0]
        });

    } catch (err) {
        console.error("Error saving search history:", err.message);
        res.status(500).json({ message: "Server error saving search history." });
    }
};

// Save TikTok posts data to database
const saveTikTokPosts = async (req, res) => {
    try {
        const { posts, search_hashtag } = req.body;
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;

        // Validation
        if (!Array.isArray(posts) || posts.length === 0) {
            return res.status(400).json({ message: "Posts array is required and must not be empty." });
        }

        if (!search_hashtag || !search_hashtag.trim()) {
            return res.status(400).json({ message: "Search hashtag is required." });
        }

        if (!userId || !tenantId) {
            return res.status(401).json({ message: "User authentication required." });
        }

        const searchKeyword = search_hashtag.trim();
        let savedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Process each post
        for (const post of posts) {
            try {
                // Extract post ID (could be id, awemeId, or videoId depending on Apify response)
                const postId = post?.id || post?.awemeId || post?.videoId || post?.url || null;
                
                if (!postId) {
                    skippedCount++;
                    continue;
                }

                // Extract engagement metrics
                const playCount = post?.playCount || post?.views || post?.play_count || 0;
                const diggCount = post?.diggCount || post?.likes || post?.digg_count || 0;
                const commentCount = post?.commentCount || post?.comments || post?.comment_count || 0;
                const shareCount = post?.shareCount || post?.shares || post?.share_count || 0;

                // Extract created date
                let postCreatedAt = null;
                if (post?.createTime) {
                    // If createTime is in seconds, convert to timestamp
                    const timestamp = typeof post.createTime === 'number' 
                        ? (post.createTime < 10 ** 12 ? post.createTime * 1000 : post.createTime)
                        : new Date(post.createTime).getTime();
                    postCreatedAt = new Date(timestamp).toISOString();
                } else if (post?.createdAt || post?.uploadedAt) {
                    const dateValue = post.createdAt || post.uploadedAt;
                    const timestamp = typeof dateValue === 'number'
                        ? (dateValue < 10 ** 12 ? dateValue * 1000 : dateValue)
                        : new Date(dateValue).getTime();
                    postCreatedAt = new Date(timestamp).toISOString();
                }

                // Use ON CONFLICT to avoid duplicates (based on post_id)
                const insertQuery = `
                    INSERT INTO tiktok_posts (
                        post_id, 
                        search_hashtag, 
                        post_created_at, 
                        play_count, 
                        digg_count, 
                        comment_count, 
                        share_count, 
                        raw_data,
                        scraped_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    ON CONFLICT (post_id) 
                    DO UPDATE SET
                        search_hashtag = EXCLUDED.search_hashtag,
                        play_count = EXCLUDED.play_count,
                        digg_count = EXCLUDED.digg_count,
                        comment_count = EXCLUDED.comment_count,
                        share_count = EXCLUDED.share_count,
                        raw_data = EXCLUDED.raw_data,
                        scraped_at = NOW()
                    RETURNING id
                `;

                await pool.query(insertQuery, [
                    String(postId),
                    searchKeyword,
                    postCreatedAt,
                    parseInt(playCount) || 0,
                    parseInt(diggCount) || 0,
                    parseInt(commentCount) || 0,
                    parseInt(shareCount) || 0,
                    JSON.stringify(post) // Store full raw data as JSONB
                ]);

                savedCount++;

            } catch (postError) {
                console.error(`Error saving post ${post?.id || 'unknown'}:`, postError.message);
                errors.push({ postId: post?.id || 'unknown', error: postError.message });
                skippedCount++;
            }
        }

        console.log(`Saved ${savedCount} posts for search: ${searchKeyword} by user ${userId}`);

        res.status(200).json({
            message: "Posts saved successfully",
            saved: savedCount,
            skipped: skippedCount,
            total: posts.length,
            search_hashtag: searchKeyword,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error("Error saving TikTok posts:", err.message);
        res.status(500).json({ message: "Server error saving TikTok posts." });
    }
};

// Save Instagram posts data to database
const saveInstagramPosts = async (req, res) => {
    try {
        const { posts, search_hashtag } = req.body;
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;

        // Validation
        if (!Array.isArray(posts) || posts.length === 0) {
            return res.status(400).json({ message: "Posts array is required and must not be empty." });
        }

        if (!search_hashtag || !search_hashtag.trim()) {
            return res.status(400).json({ message: "Search hashtag is required." });
        }

        if (!userId || !tenantId) {
            return res.status(401).json({ message: "User authentication required." });
        }

        const searchKeyword = search_hashtag.trim();
        let savedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Process each post
        for (const post of posts) {
            try {
                // Extract post ID (could be id, shortcode, code, or url)
                const postId = post?.id || 
                post?.shortCode || 
                post?.shortcode || 
                post?.code || 
                post?.url || 
                post?.permalink || 
                null;
                
                if (!postId) {
                    skippedCount++;
                    continue;
                }

                // Extract engagement metrics (Instagram uses different field names)
                const likesCount = post?.likesCount || 
                post?.likes || 
                post?.edge_media_preview_like?.count || 
                post?.edge_liked_by?.count || 
                0;
                const commentsCount = post?.commentsCount || 
                post?.comments || 
                post?.edge_media_to_comment?.count || 
                post?.edge_media_to_parent_comment?.count || 
                0;
                const savesCount = post?.savesCount || 
                post?.saves || 
                post?.edge_media_to_saved?.count || 
                0;
                const sharesCount = post?.sharesCount || 
                post?.shares || 
                0;
                const viewsCount = post?.playsCount || 
                post?.views || 
                post?.video_view_count || 
                post?.edge_media_preview?.count || 
                0;

                // Extract created date
                let postCreatedAt = null;
                if (post?.timestamp) {
                    const timestamp = typeof post.timestamp === 'number' 
                        ? (post.timestamp < 10 ** 12 ? post.timestamp * 1000 : post.timestamp)
                        : new Date(post.timestamp).getTime();
                    postCreatedAt = new Date(timestamp).toISOString();
                } else if (post?.taken_at_timestamp) {
                    const timestamp = typeof post.taken_at_timestamp === 'number' 
                        ? (post.taken_at_timestamp < 10 ** 12 ? post.taken_at_timestamp * 1000 : post.taken_at_timestamp)
                        : new Date(post.taken_at_timestamp).getTime();
                    postCreatedAt = new Date(timestamp).toISOString();
                } else if (post?.createdAt || post?.uploadedAt) {
                    const dateValue = post.createdAt || post.uploadedAt;
                    const timestamp = typeof dateValue === 'number'
                        ? (dateValue < 10 ** 12 ? dateValue * 1000 : dateValue)
                        : new Date(dateValue).getTime();
                    postCreatedAt = new Date(timestamp).toISOString();
                }

                // Extract owner username
                const ownerUsername = post?.ownerUsername || 
                                     post?.username || 
                                     post?.owner?.username || 
                                     null;

                // Extract caption
                const caption = post?.caption || 
                               post?.edge_media_to_caption?.edges?.[0]?.node?.text || 
                               null;

                // Use ON CONFLICT to avoid duplicates (based on post_id)
                const insertQuery = `
                    INSERT INTO instagram_posts (
                        post_id, 
                        search_hashtag, 
                        owner_username,
                        caption,
                        post_created_at, 
                        likes_count, 
                        comments_count, 
                        saves_count,
                        shares_count,
                        views_count,
                        raw_data,
                        scraped_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                    ON CONFLICT (post_id) 
                    DO UPDATE SET
                        search_hashtag = EXCLUDED.search_hashtag,
                        owner_username = EXCLUDED.owner_username,
                        caption = EXCLUDED.caption,
                        likes_count = EXCLUDED.likes_count,
                        comments_count = EXCLUDED.comments_count,
                        saves_count = EXCLUDED.saves_count,
                        shares_count = EXCLUDED.shares_count,
                        views_count = EXCLUDED.views_count,
                        raw_data = EXCLUDED.raw_data,
                        scraped_at = NOW()
                    RETURNING id
                `;

                await pool.query(insertQuery, [
                    String(postId),
                    searchKeyword,
                    ownerUsername,
                    caption,
                    postCreatedAt,
                    parseInt(likesCount) || 0,
                    parseInt(commentsCount) || 0,
                    parseInt(savesCount) || 0,
                    parseInt(sharesCount) || 0,
                    parseInt(viewsCount) || 0,
                    JSON.stringify(post) // Store full raw data as JSONB
                ]);

                savedCount++;

            } catch (postError) {
                console.error(`Error saving Instagram post ${post?.id || 'unknown'}:`, postError.message);
                errors.push({ postId: post?.id || 'unknown', error: postError.message });
                skippedCount++;
            }
        }

        console.log(`Saved ${savedCount} Instagram posts for search: ${searchKeyword} by user ${userId}`);

        res.status(200).json({
            message: "Instagram posts saved successfully",
            saved: savedCount,
            skipped: skippedCount,
            total: posts.length,
            search_hashtag: searchKeyword,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error("Error saving Instagram posts:", err.message);
        res.status(500).json({ message: "Server error saving Instagram posts." });
    }
};

module.exports = {
    getTikTokData,
    getSearchHistory,
    saveSearchHistory,
    saveTikTokPosts,
    saveInstagramPosts,
};
