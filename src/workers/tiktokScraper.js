const dotenv = require('dotenv');
const pool = require('../config/db'); 

dotenv.config();

// (1) Actor ID ko fix kar diya hai (tilde '~' ke saath)
const TIKTOK_ACTOR_ID = "clockworks~tiktok-scraper"; 
const APIFY_TOKEN = process.env.APIFY_TOKEN;

const HASHTAGS_TO_SCRAPE = ['saas', 'b2bmarketing', 'ai', 'tech', 'startup'];

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

    for (const hashtag of HASHTAGS_TO_SCRAPE) {
        console.log(`[Worker] --- Scraping hashtag: #${hashtag} ---`);
        
        try {
            const actorInput = {
                "hashtags": [hashtag],
                "resultsPerPage": 25, 
                "shouldDownloadVideos": false,
                "shouldDownloadCovers": false
            };

            console.log(`[Worker] Calling Apify Actor: ${TIKTOK_ACTOR_ID}... (Waiting up to 2 mins)`);
            const runResponse = await fetch(
                `https://api.apify.com/v2/acts/${TIKTOK_ACTOR_ID}/runs?token=${APIFY_TOKEN}&wait_for_finish=120`, 
                {
                    method: 'POST',
                    body: JSON.stringify(actorInput),
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!runResponse.ok) {
                console.error(`[Worker] Apify Actor run failed for #${hashtag}. Status: ${runResponse.status} ${runResponse.statusText}`);
                continue; 
            }

            const runObject = await runResponse.json();

            if (!runObject.data || !runObject.data.defaultDatasetId) {
                console.error(`[Worker] Apify run for #${hashtag} did not produce a dataset.`);
                continue;
            }

            const datasetId = runObject.data.defaultDatasetId;
            console.log(`[Worker] Apify run finished. Fetching dataset: ${datasetId}`);

            const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
            if (!itemsResponse.ok) {
                console.error(`[Worker] Failed to fetch dataset items for #${hashtag}.`);
                continue;
            }

            const items = await itemsResponse.json();
            console.log(`[Worker] Fetched ${items.length} new posts for #${hashtag}. Saving to database...`);

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
                    
                    const createDate = item.createTimeISO 
                        ? new Date(item.createTimeISO) 
                        : (item.createTime ? new Date(item.createTime * 1000) : null);
                    
                    const values = [
                        item.id,
                        hashtag,
                        createDate,
                        item.playCount || 0,
                        item.diggCount || 0,
                        item.commentCount || 0,
                        item.shareCount || 0,
                        // (2) --- YEH HAI FIX ---
                        // Ghalat 'D' ko yahaan se hata diya hai
                        JSON.stringify(item) // Poora data JSONB column mein daalo
                    ];
                    
                    const result = await pool.query(insertQuery, values);
                    if (result.rowCount > 0) {
                        postsSaved++; 
                    }

                } catch (dbError) {
                    console.error(`[Worker] Error saving post ${item.id} to DB:`, dbError.message);
                }
            }
            console.log(`[Worker] --- Finished #${hashtag}. Saved ${postsSaved} new posts. (Skipped ${items.length - postsSaved} duplicates) ---`);

        } catch (error) {
            console.error(`[Worker] Major error during scrape for #${hashtag}:`, error.message);
        }
    }

    console.log("[Worker] TikTok scraper job finished successfully.");
}

// Script ko chalaao
runScraper().catch(err => {
    console.error("[Worker] CRITICAL ERROR: Scraper process failed.", err);
    process.exit(1); 
});
