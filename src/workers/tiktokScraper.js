const dotenv = require('dotenv');
const pool = require('../config/db'); 

dotenv.config();

const TIKTOK_ACTOR_ID = "apidojo~tiktok-scraper"; 
const APIFY_TOKEN = process.env.APIFY_TOKEN;

async function runScraper() {
    console.log(`[Worker] Starting TikTok scraper job (custom input mode)...`);

    if (!APIFY_TOKEN) {
        console.error("[Worker] ❌ Error: Apify token missing. Check .env file.");
        return;
    }
    if (!pool) {
        console.error("[Worker] ❌ Error: Database connection pool not found.");
        return;
    }

    try {
        // ✅ New Apify input structure
        const actorInput = {
            customMapFunction: "(object) => { return {...object} }",
            dateRange: "DEFAULT",
            includeSearchKeywords: false,
            keywords: ["Artificial Intelligence", "podcast"],
            location: "US",
            maxItems: 1000,
            sortType: "RELEVANCE",
            startUrls: [
                "https://www.tiktok.com/@billieeilish/video/7050551461734042926",
                "https://www.tiktok.com/@gordonramsayofficial",
                "https://www.tiktok.com/search?q=Recipes",
                "https://www.tiktok.com/tag/duet",
                "https://www.tiktok.com/music/original-sound-Newcastle-United-7297730198175402784",
                "https://www.tiktok.com/place/New-York-22535796481546927"
            ],
            proxy: { useApifyProxy: true }
        };

        console.log(`[Worker] 🚀 Running Apify Actor: ${TIKTOK_ACTOR_ID} (waiting up to 3 mins)...`);
        
        const runResponse = await fetch(
            `https://api.apify.com/v2/acts/${TIKTOK_ACTOR_ID}/runs?token=${APIFY_TOKEN}&wait_for_finish=180`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(actorInput)
            }
        );

        if (!runResponse.ok) {
            console.error(`[Worker] ❌ Apify Actor run failed: ${runResponse.status} ${runResponse.statusText}`);
            return;
        }

        const runData = await runResponse.json();
        if (!runData.data || !runData.data.defaultDatasetId) {
            console.error(`[Worker] ❌ Apify run did not return a dataset.`);
            return;
        }

        const datasetId = runData.data.defaultDatasetId;
        console.log(`[Worker] ✅ Run completed. Fetching dataset: ${datasetId} ...`);

        const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        if (!datasetResponse.ok) {
            console.error(`[Worker] ❌ Failed to fetch dataset items.`);
            return;
        }

        const items = await datasetResponse.json();
        console.log(`[Worker] 📦 Retrieved ${items.length} posts. Inserting into database...`);

        let savedCount = 0;
        for (const item of items) {
            if (!item.id) continue;

            try {
                const insertQuery = `
                    INSERT INTO tiktok_posts 
                        (post_id, search_hashtag, post_created_at, play_count, digg_count, comment_count, share_count, raw_data)
                    VALUES 
                        ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (post_id) DO NOTHING;
                `;

                const postDate = item.createTime ? new Date(item.createTime * 1000) : null;

                const values = [
                    item.id,
                    item.hashtagName || item.keyword || "unknown",
                    postDate,
                    item.stats?.playCount || 0,
                    item.stats?.diggCount || 0,
                    item.stats?.commentCount || 0,
                    item.stats?.shareCount || 0,
                    JSON.stringify(item)
                ];

                const result = await pool.query(insertQuery, values);
                if (result.rowCount > 0) savedCount++;

            } catch (dbErr) {
                console.error(`[Worker] ⚠️ DB Insert Error for post ${item.id}:`, dbErr.message);
            }
        }

        console.log(`[Worker] ✅ Finished. Saved ${savedCount} new posts. Skipped ${items.length - savedCount} duplicates.`);

    } catch (error) {
        console.error(`[Worker] 💥 Scraper execution error:`, error.message);
    }

    console.log("[Worker] 🏁 TikTok scraper job finished.");
}

runScraper().catch(err => {
    console.error("[Worker] CRITICAL ERROR:", err);
    process.exit(1);
});
