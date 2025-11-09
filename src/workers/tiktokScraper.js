const dotenv = require('dotenv');
const pool = require('../config/db'); // (1) Hum Apify se laakar data yahaan (Postgres) save karenge

dotenv.config();

// (2) Yeh Actor ID hai. Aap Apify par apna khud ka Actor bhi use kar sakte hain.
const TIKTOK_ACTOR_ID = "clockworks/tiktok-scraper"; 
const APIFY_TOKEN = process.env.APIFY_TOKEN;

// (3) Yeh woh hashtags hain jinhe hum scrape karna chahte hain.
// Aap is list ko jitna chahein, bada kar sakte hain.
const HASHTAGS_TO_SCRAPE = ['saas', 'b2bmarketing', 'ai', 'tech', 'startup'];

// (4) Yeh main function hai jo saara kaam karega
async function runScraper() {
    console.log(`[Worker] Starting TikTok scraper job for ${HASHTAGS_TO_SCRAPE.length} hashtags...`);

    if (!APIFY_TOKEN) {
        console.error("[Worker] Error: Apify token missing. Check .env file.");
        return; // Bina token ke script band kar do
    }
    if (!pool) {
        console.error("[Worker] Error: Database connection pool is not available.");
        return; // Bina DB ke script band kar do
    }

    // (5) Har hashtag ke liye ek-ek karke scrape chalaao
    for (const hashtag of HASHTAGS_TO_SCRAPE) {
        console.log(`[Worker] --- Scraping hashtag: #${hashtag} ---`);
        
        try {
            // (6) Apify ko bhejne ke liye Input (sirf 25 results, taaki jaldi ho)
            const actorInput = {
                "hashtags": [hashtag],
                "resultsPerPage": 25, // (Aap ise 100 tak badha sakte hain)
                "shouldDownloadVideos": false,
                "shouldDownloadCovers": false
            };

            // (7) Apify Actor ko RUN karo aur 2 minute tak intezaar (wait) karo
            console.log(`[Worker] Calling Apify Actor... (Waiting up to 2 mins)`);
            const runResponse = await fetch(
                `https://api.apify.com/v2/acts/${TIKTOK_ACTOR_ID}/runs?token=${APIFY_TOKEN}&wait_for_finish=120`, 
                {
                    method: 'POST',
                    body: JSON.stringify(actorInput),
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!runResponse.ok) {
                console.error(`[Worker] Apify Actor run failed for #${hashtag}. Status: ${runResponse.statusText}`);
                continue; // Is hashtag ko chhod kar agle par jaao
            }

            const runObject = await runResponse.json();

            if (!runObject.data || !runObject.data.defaultDatasetId) {
                console.error(`[Worker] Apify run for #${hashtag} did not produce a dataset.`);
                continue;
            }

            const datasetId = runObject.data.defaultDatasetId;
            console.log(`[Worker] Apify run finished. Fetching dataset: ${datasetId}`);

            // (8) Naye dataset se naya (LIVE) data fetch karo
            const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
            if (!itemsResponse.ok) {
                console.error(`[Worker] Failed to fetch dataset items for #${hashtag}.`);
                continue;
            }

            const items = await itemsResponse.json();
            console.log(`[Worker] Fetched ${items.length} new posts for #${hashtag}. Saving to database...`);

            // (9) Saare naye posts ko database mein save karo
            let postsSaved = 0;
            for (const item of items) {
                if (!item.id) continue; // Agar post ki ID nahi hai toh skip karo

                try {
                    // (10) Yahaan hum 'ON CONFLICT' ka istemal kar rahe hain
                    // Iska matlab hai: Agar post_id pehle se table mein hai, toh 'DO NOTHING' (skip karo)
                    // Isse hum duplicate data save nahi karenge
                    const insertQuery = `
                        INSERT INTO tiktok_posts 
                            (post_id, search_hashtag, post_created_at, play_count, digg_count, comment_count, share_count, raw_data)
                        VALUES 
                            ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (post_id) 
                        DO NOTHING;
                    `;
                    
                    // (11) Data ko prepare karo
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
                        JSON.stringify(item) // Poora data JSONB column mein daalo
                    ];
                    
                    const result = await pool.query(insertQuery, values);
                    if (result.rowCount > 0) {
                        postsSaved++; // (rowCount > 0 matlab naya post save hua)
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

// (12) Script ko chalaao
runScraper().catch(err => {
    console.error("[Worker] CRITICAL ERROR: Scraper process failed.", err);
    process.exit(1); // Error ke saath exit karo
});