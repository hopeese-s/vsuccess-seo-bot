require('dotenv').config();
const cron = require('node-cron');
const { generateArticle } = require('./modules/seo_generator');
const { postToWordPress } = require('./modules/wp_poster');
const { sendNotification, replyToLine } = require('./modules/line_notifier');
const { getNextPendingKeyword, markKeywordAsDone, markKeywordAsFailed } = require('./modules/scheduler');
const http = require('http');

// Destructure from env
const {
    DEEPSEEK_API_KEY,
    LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET,
    WP_URL,
    WP_USER,
    WP_PASS
} = process.env;

async function processKeywordDirect(keyword) {
    console.log(`[${new Date().toLocaleString()}] Starting direct article generation for keyword: "${keyword}"`);
    try {
        // 1. Generate Article via DeepSeek
        const article = await generateArticle(keyword, DEEPSEEK_API_KEY);
        console.log(`Article generated! Title: ${article.title}`);

        // 2. Post to WordPress
        const postUrl = await postToWordPress(article.title, article.content, keyword, WP_URL, WP_USER, WP_PASS);
        console.log(`Successfully posted to WordPress: ${postUrl}`);

        // 3. Send LINE Notification
        const message = `✅ อัปเดตบทความใหม่สำเร็จ (สั่งผ่าน LINE)!\n\nKeyword: ${keyword}\nหัวข้อ: ${article.title}\n\nอ่านบทความได้ที่: ${postUrl}`;
        await sendNotification(message, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);

    } catch (error) {
        console.error("An error occurred during direct process:", error);
        const errorMsg = `❌ เกิดข้อผิดพลาดในการโพสต์บทความ (สั่งผ่าน LINE)\nKeyword: ${keyword}\nError: ${error.message}`;
        try {
            await sendNotification(errorMsg, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);
        } catch (lineErr) {
            console.error("Failed to send error notification to LINE:", lineErr.message);
        }
    }
}

async function processNextArticle() {
    console.log(`[${new Date().toLocaleString()}] Starting article generation process...`);
    
    let pendingItem = null;
    
    try {
        pendingItem = await getNextPendingKeyword();
        
        if (!pendingItem) {
            console.log("No pending keywords found for today.");
            // Notify LINE that queue is empty
            await sendNotification("📭 ไม่มีคีย์เวิร์ดค้างในระบบแล้วครับ กรุณาเพิ่มคีย์เวิร์ดในไฟล์ CSV", LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);
            return;
        }

        const keyword = pendingItem.row.Keyword;
        console.log(`Found pending keyword: "${keyword}"`);

        // 1. Generate Article via DeepSeek
        console.log("Generating article with DeepSeek API...");
        const article = await generateArticle(keyword, DEEPSEEK_API_KEY);
        console.log(`Article generated! Title: ${article.title}`);

        // 2. Post to WordPress
        console.log("Posting to WordPress...");
        const postUrl = await postToWordPress(article.title, article.content, keyword, WP_URL, WP_USER, WP_PASS);
        console.log(`Successfully posted to WordPress: ${postUrl}`);

        // 3. Send LINE Notification
        const message = `✅ อัปเดตบทความใหม่สำเร็จ!\n\nKeyword: ${keyword}\nหัวข้อ: ${article.title}\n\nอ่านบทความได้ที่: ${postUrl}`;
        await sendNotification(message, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);

        // 4. Mark as Done
        await markKeywordAsDone(pendingItem.allRows, pendingItem.index);
        console.log("Process completed successfully.");

    } catch (error) {
        console.error("An error occurred during the process:", error);
        
        // Notify via LINE about the error
        let errorMsg = `❌ เกิดข้อผิดพลาดในการโพสต์บทความ\n`;
        if (pendingItem) errorMsg += `Keyword: ${pendingItem.row.Keyword}\n`;
        errorMsg += `Error: ${error.message}`;
        
        try {
            await sendNotification(errorMsg, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);
        } catch (lineErr) {
            console.error("Failed to send error notification to LINE:", lineErr.message);
        }

        // Mark as failed if we picked one
        if (pendingItem) {
            try {
                await markKeywordAsFailed(pendingItem.allRows, pendingItem.index);
            } catch (csvErr) {
                console.error("Failed to mark CSV as failed:", csvErr.message);
            }
        }
    }
}

// Check if running manually
if (process.argv.includes('--manual')) {
    console.log("Running in manual mode for preview...");
    processNextArticle().then(() => {
        console.log("Manual run finished.");
        process.exit(0);
    });
} else {
    // 1. Schedule to run every day at 09:00 AM
    // Format: 'minute hour day month day-of-week'
    console.log("Starting SEO Auto-Posting Scheduler...");
    console.log("Cron job set to run at 09:00 AM every day.");
    
    cron.schedule('0 9 * * *', () => {
        processNextArticle();
    });

    // 2. Webhook Server (Listen for LINE commands)
    const PORT = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/webhook') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const events = data.events || [];
                    for (const event of events) {
                        if (event.type === 'message' && event.message.type === 'text') {
                            const text = event.message.text.trim();
                            const replyToken = event.replyToken;
                            
                            if (text === 'โพสต์คิวถัดไป') {
                                await replyToLine(replyToken, "⏳ กำลังดึงคีย์เวิร์ดคิวถัดไปจากตารางมาโพสต์... กรุณารอสักครู่ครับ", LINE_CHANNEL_ACCESS_TOKEN);
                                processNextArticle();
                            } else if (text.startsWith('เขียนบทความ:')) {
                                const customKeyword = text.replace('เขียนบทความ:', '').trim();
                                if (!customKeyword) {
                                    await replyToLine(replyToken, "❌ กรุณาระบุคีย์เวิร์ดด้วย เช่น เขียนบทความ: สายคล้องคอราคาถูก", LINE_CHANNEL_ACCESS_TOKEN);
                                } else {
                                    await replyToLine(replyToken, `⏳ กำลังเขียนและโพสต์บทความคีย์เวิร์ด: "${customKeyword}"... กรุณารอสักครู่ครับ`, LINE_CHANNEL_ACCESS_TOKEN);
                                    processKeywordDirect(customKeyword);
                                }
                            } else if (text === 'เมนู') {
                                const helpText = `📱 คำสั่งควบคุมบอท SEO:\n\n1️⃣ พิมพ์ "โพสต์คิวถัดไป" - ดึงคีย์เวิร์ดในตารางค้างอยู่มาโพสต์ทันที\n2️⃣ พิมพ์ "เขียนบทความ: [คีย์เวิร์ด]" - สั่งเขียนคีย์เวิร์ดด่วนนอกตารางทันที`;
                                await replyToLine(replyToken, helpText, LINE_CHANNEL_ACCESS_TOKEN);
                            }
                        }
                    }
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('OK');
                } catch (err) {
                    console.error("Webhook processing error:", err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error');
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    server.listen(PORT, () => {
        console.log(`Webhook server listening on port ${PORT}`);
        console.log(`LINE Webhook URL should be set to: [Your Public Domain]/webhook`);
    });
}
