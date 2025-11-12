const dotenv = require('dotenv');
const pool = require('../config/db'); 

dotenv.config();

const TIKTOK_ACTOR_ID = "clockworks~tiktok-scraper";
const APIFY_TOKEN = process.env.APIFY_TOKEN;

const getStoredTikTokPosts = async (req, res) => {
    try {
        console.log("Fetching stored TikTok posts from database...");
        
        const { rows } = await pool.query(
            `SELECT * FROM tiktok_posts ORDER BY post_created_at DESC LIMIT 500`
        );

        // Data 'raw_data' column mein JSON ki tarah save hai, use waapas nikaalo
        const allPosts = rows.map(post => post.raw_data);

        console.log(`Successfully fetched ${allPosts.length} posts from DB.`);
        res.status(200).json(allPosts);

    } catch (err) {
        console.error("Error fetching stored TikTok data:", err.message);
        res.status(500).json({ message: "Server error fetching stored data." });
    }
};


// --- "Live Search" waali function (Yeh bhi ab fix ho gayi hai) ---
const getTikTokData = async (req, res) => {
    
    if (!APIFY_TOKEN) {
        console.error("Apify token missing. Check .env file.");
        return res.status(500).json({ message: "Server configuration error: API token missing." });
    }

    try {
        const searchQuery = req.query.query; 
        if (!searchQuery) {
            return res.status(400).json({ message: "Search query is required." });
        }

        console.log(`Starting Apify Actor run for query: ${searchQuery}...`);

        // (2) --- Naye Actor ka INPUT FORMAT alag hai ---
        const actorInput = {
            "search": [searchQuery], // 'hashtags' ko 'search' se badla
            "resultsPerPage": 20,
            "shouldDownloadVideos": false,
            "videoLanguage": "en"
        };

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

        if (!runObject.data || !runObject.data.defaultDatasetId) {
            throw new Error("Apify run failed or did not produce a dataset.");
        }

        const datasetId = runObject.data.defaultDatasetId;
        console.log(`Apify run finished. Fetching dataset: ${datasetId}`);

        const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        
        if (!itemsResponse.ok) {
            throw new Error(`Failed to fetch dataset items: ${itemsResponse.statusText}`);
        }

        const items = await itemsResponse.json();
        
        console.log(`Successfully fetched ${items.length} live items.`);
        res.status(200).json(items);

    } catch (err) {
        console.error("Error in getTikTokData controller:", err.message);
        res.status(500).json({ message: "Server error fetching Apify data." });
    }
};

module.exports = {
    getTikTokData,
    getStoredTikTokPosts
};
