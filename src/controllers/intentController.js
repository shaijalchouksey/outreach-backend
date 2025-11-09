const dotenv = require('dotenv');
dotenv.config();

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

module.exports = {
    getTikTokData,
};