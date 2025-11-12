const dotenv = require('dotenv');
const pool = require('../config/db'); 

dotenv.config();

// Actor ID sahi hai (apidojo~)
const TIKTOK_ACTOR_ID = "apidojo~tiktok-scraper"; 
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const HASHTAGS_TO_SCRAPE = ['funny', 'dance', 'music', 'art', 'comedy'];

async function runScraper() {
    console.log(`[Worker] Starting TikTok scraper job for ${HASHTAGS_TO_SCRAPE.length} hashtags...`);

    if (!APIFY_TOKEN) {
        console.error("[Worker] Error: Apify token missing. Check .env file.");
        return; 
    }
    if (!pool) {
        console.error("[Worker] Error: Database connection pool is not available.");
        return; 
    }
    
    try {
        // (Input format waisa hi hai)
        const actorInput = {
            "hashtags": HASHTAGS_TO_SCRAPE,
            "results_per_hashtag": 25, 
            "proxy": { "useApifyProxy": true } 
        };

        console.log(`[Worker] Calling Apify Actor: ${TIKTOK_ACTOR_ID}... (Waiting up to 3 mins)`);
        
        const runResponse = await fetch(
            `https://api.apify.com/v2/acts/${TIKTOK_ACTOR_ID}/runs?token=${APIFY_TOKEN}&wait_for_finish=180`, 
            {
                method: 'POST',
                body: JSON.stringify(actorInput),
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (!runResponse.ok) {
            console.error(`[Worker] Apify Actor run failed. Status: ${runResponse.status} ${runResponse.statusText}`);
            return; 
        }

        const runObject = await runResponse.json();

        if (!runObject.data || !runObject.data.defaultDatasetId) {
            console.error(`[Worker] Apify run did not produce a dataset.`);
            return;
        }

        const datasetId = runObject.data.defaultDatasetId;
        console.log(`[Worker] Apify run finished. Fetching dataset: ${datasetId}`);

        const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        if (!itemsResponse.ok) {
            console.error(`[Worker] Failed to fetch dataset items.`);
            return;
        }

        const items = await itemsResponse.json();
        console.log(`[Worker] Fetched ${items.length} new posts. Saving to database...`);

        // (Baaki ka database code waisa hi hai)
        let postsSaved = 0;
        for (const item of items) {
            if (!item.id) continue; 

            try {
                const insertQuery = `
                    INSERT INTO tiktok_posts 
                        (post_id, search_hashtag, post_created_at, play_count, digg_count, comment_count, share_count, raw_data)
                    VALUES 
                        ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (post_id) 
                    DO NOTHING;
                `;
                
                const createDate = item.createTime ? new Date(item.createTime * 1000) : null;
                
                const values = [
                    item.id,
                    item.hashtagName || 'unknown', 
                    createDate,
                    item.stats?.playCount || 0,
                    item.stats?.diggCount || 0,
                    item.stats?.commentCount || 0,
                    item.stats?.shareCount || 0,
                    JSON.stringify(item) 
                ];
                
                const result = await pool.query(insertQuery, values);
                if (result.rowCount > 0) {
                    postsSaved++; 
                }

            } catch (dbError) {
                console.error(`[Worker] Error saving post ${item.id} to DB:`, dbError.message);
            }
        }
        console.log(`[Worker] --- Finished. Saved ${postsSaved} new posts. (Skipped ${items.length - postsSaved} duplicates) ---`);

    } catch (error) {
        console.error(`[Worker] Major error during scrape:`, error.message);
    }

    console.log("[Worker] TikTok scraper job finished successfully.");
}

runScraper().catch(err => {
    console.error("[Worker] CRITICAL ERROR: Scraper process failed.", err);
    process.exit(1); 
});
