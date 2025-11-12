const dotenv = require('dotenv');
const pool = require('../config/db');

dotenv.config();

const TIKTOK_ACTOR_ID = "apidojo~tiktok-scraper";
const APIFY_TOKEN = process.env.APIFY_TOKEN;

async function runDynamicScraper(config) {
    console.log(`[Worker] 🚀 Running TikTok scraper with new config...`);

    if (!APIFY_TOKEN) throw new Error("Missing Apify Token");

    const actorInput = {
        customMapFunction: config.custom_map_function || "(object) => { return {...object} }",
        dateRange: config.date_range || "DEFAULT",
        includeSearchKeywords: config.include_search_keywords || false,
        keywords: config.keywords || [],
        location: config.location || "US",
        maxItems: config.max_items || 200,
        sortType: config.sort_type || "RELEVANCE",
        startUrls: config.start_urls || [],
        proxy: { useApifyProxy: true },
    };

    try {
        // 1️⃣ Run the Apify actor
        const runResponse = await fetch(
            `https://api.apify.com/v2/acts/${TIKTOK_ACTOR_ID}/runs?token=${APIFY_TOKEN}&wait_for_finish=180`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(actorInput)
            }
        );

        if (!runResponse.ok) throw new Error(`Apify failed: ${runResponse.statusText}`);

        const runData = await runResponse.json();
        const datasetId = runData?.data?.defaultDatasetId;
        if (!datasetId) throw new Error("No dataset ID found in Apify response");

        // 2️⃣ Fetch dataset items
        const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        const items = await datasetRes.json();

        console.log(`[Worker] 📦 Retrieved ${items.length} TikTok posts`);

        // 3️⃣ Save to DB
        let saved = 0;
        for (const item of items) {
            if (!item.id) continue;

            const query = `
                INSERT INTO tiktok_posts 
                (post_id, search_hashtag, post_created_at, play_count, digg_count, comment_count, share_count, raw_data)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (post_id) DO NOTHING;
            `;
            const values = [
                item.id,
                item.hashtagName || item.keyword || 'unknown',
                item.createTime ? new Date(item.createTime * 1000) : null,
                item.stats?.playCount || 0,
                item.stats?.diggCount || 0,
                item.stats?.commentCount || 0,
                item.stats?.shareCount || 0,
                JSON.stringify(item),
            ];

            const res = await pool.query(query, values);
            if (res.rowCount > 0) saved++;
        }

        console.log(`[Worker] ✅ Saved ${saved}/${items.length} posts.`);
        return { saved, total: items.length };

    } catch (err) {
        console.error(`[Worker] 💥 Scraper error:`, err.message);
        throw err;
    }
}

module.exports = { runDynamicScraper };
