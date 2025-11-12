const dotenv = require('dotenv');
const pool = require('../config/db'); // (1) Database pool ko import kiya
dotenv.config();


const TIKTOK_ACTOR_ID = "clockworks~tiktok-scraper"; // (Ghalat / ko sahi ~ se badla)
const APIFY_TOKEN = process.env.APIFY_TOKEN;


// --- (3) NAYI FUNCTION (Database se fetch karne waali) ---
// Yeh fast hai aur aapka frontend ise call karega
const getStoredTikTokPosts = async (req, res) => {
    try {
        console.log("Fetching stored TikTok posts from database...");
        
        // Database se saare posts nikaalo (naye waale sabse pehle)
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


// --- Puraani "Live Search" waali function (Ab yeh bhi fix ho gayi hai) ---
const getTikTokData = async (req, res) => {
    
    if (!APIFY_TOKEN) {
        console.error("Apify token missing. Check .env file.");
        return res.status(500).json({ message: "Server configuration error: API token missing." });
    }

    try {
        // Frontend se search query lo (e.g., "travel")
        const searchQuery = req.query.query; 
        if (!searchQuery) {
            return res.status(400).json({ message: "Search query is required." });
        }

        console.log(`Starting Apify Actor run for query: ${searchQuery}...`);

        // Apify ko bhejne ke liye Input (sirf 20 results, test ke liye)
        const actorInput = {
            "hashtags": [searchQuery], // Query ko yahaan daala
            "resultsPerPage": 20,
            "shouldDownloadVideos": false,
            "shouldDownloadCovers": false
        };

        // Apify Actor ko RUN karo aur 2 minute tak intezaar (wait) karo
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

        // Check karo ki run successful tha aur data bana
        if (!runObject.data || !runObject.data.defaultDatasetId) {
            throw new Error("Apify run failed or did not produce a dataset.");
        }

        const datasetId = runObject.data.defaultDatasetId;
        console.log(`Apify run finished. Fetching dataset: ${datasetId}`);

        // Naye dataset se naya (LIVE) data fetch karo
        const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        
        if (!itemsResponse.ok) {
            throw new Error(`Failed to fetch dataset items: ${itemsResponse.statusText}`);
        }

        const items = await itemsResponse.json();
        
        console.log(`Successfully fetched ${items.length} live items.`);
        
        // Frontend ko live data bhejo
        res.status(200).json(items);

    } catch (err) {
        console.error("Error in getTikTokData controller:", err.message);
        res.status(500).json({ message: "Server error fetching Apify data." });
    }
};

// (4) Dono functions ko export karo
module.exports = {
    getTikTokData,
    getStoredTikTokPosts
};
