// Polyfill fetch for Node < 18
if (!globalThis.fetch) {
    const nodeFetch = require('node-fetch');
    globalThis.fetch = nodeFetch;
    globalThis.Headers = nodeFetch.Headers;
    globalThis.Request = nodeFetch.Request;
    globalThis.Response = nodeFetch.Response;
}

require('dotenv').config();
const cron = require('node-cron');
const { generateArticle } = require('./modules/seo_generator');
const { postToWordPress, getLatestPost } = require('./modules/wp_poster');
const { sendNotification, replyToLine } = require('./modules/line_notifier');
const { getNextPendingKeyword, markKeywordAsDone, markKeywordAsFailed, getQueueStatus, addKeywordsToQueue } = require('./modules/scheduler');
const http = require('http');

// Destructure from env — log on startup to confirm Railway has the vars
const {
    DEEPSEEK_API_KEY,
    LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET,
    WP_URL,
    WP_USER,
    WP_PASS
} = process.env;

// Startup check — will show in Railway logs
console.log('=== V-Success SEO Bot Starting ===');
console.log('Node version:', process.version);
console.log('ENV check:');
console.log('  DEEPSEEK_API_KEY:', DEEPSEEK_API_KEY ? '✅ SET' : '❌ MISSING');
console.log('  LINE_CHANNEL_ACCESS_TOKEN:', LINE_CHANNEL_ACCESS_TOKEN ? '✅ SET' : '❌ MISSING');
console.log('  LINE_CHANNEL_SECRET:', LINE_CHANNEL_SECRET ? '✅ SET' : '❌ MISSING');
console.log('  WP_URL:', WP_URL || '❌ MISSING');
console.log('  WP_USER:', WP_USER ? '✅ SET' : '❌ MISSING');
console.log('  WP_PASS:', WP_PASS ? '✅ SET' : '❌ MISSING');
console.log('==================================');

async function processKeywordDirect(keyword) {
    console.log(`[${new Date().toLocaleString()}] Starting direct post for: "${keyword}"`);
    try {
        const article = await generateArticle(keyword, DEEPSEEK_API_KEY);
        console.log(`Article generated: ${article.title}`);

        const postUrl = await postToWordPress(article.title, article.content, keyword, WP_URL, WP_USER, WP_PASS);
        console.log(`Posted: ${postUrl}`);

        const message = `✅ โพสต์บทความสำเร็จ!\n\nKeyword: ${keyword}\nหัวข้อ: ${article.title}\n\nอ่านได้ที่: ${postUrl}`;
        await sendNotification(message, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);

    } catch (error) {
        console.error('processKeywordDirect error:', error.message);
        try {
            await sendNotification(`❌ Error: ${error.message}`, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);
        } catch (_) {}
    }
}

async function processNextArticle() {
    console.log(`[${new Date().toLocaleString()}] Processing next article from queue...`);
    let pendingItem = null;
    try {
        pendingItem = await getNextPendingKeyword();

        if (!pendingItem) {
            console.log('No pending keywords.');
            await sendNotification('📭 ไม่มีคีย์เวิร์ดค้างในระบบแล้ว', LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);
            return;
        }

        const keyword = pendingItem.row.Keyword;
        console.log(`Keyword: "${keyword}"`);

        const article = await generateArticle(keyword, DEEPSEEK_API_KEY);
        console.log(`Generated: ${article.title}`);

        const postUrl = await postToWordPress(article.title, article.content, keyword, WP_URL, WP_USER, WP_PASS);
        console.log(`Posted: ${postUrl}`);

        const message = `✅ อัปเดตบทความใหม่สำเร็จ!\n\nKeyword: ${keyword}\nหัวข้อ: ${article.title}\n\nอ่านได้ที่: ${postUrl}`;
        await sendNotification(message, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);

        await markKeywordAsDone(pendingItem.allRows, pendingItem.index);
        console.log('Done.');

    } catch (error) {
        console.error('processNextArticle error:', error.message);
        let errorMsg = `❌ Error:\n`;
        if (pendingItem) errorMsg += `Keyword: ${pendingItem.row.Keyword}\n`;
        errorMsg += error.message;
        try {
            await sendNotification(errorMsg, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET);
        } catch (_) {}
        if (pendingItem) {
            try { await markKeywordAsFailed(pendingItem.allRows, pendingItem.index); } catch (_) {}
        }
    }
}

// === MAIN ===
if (process.argv.includes('--manual')) {
    processNextArticle().then(() => process.exit(0));
} else {
    // Cron: daily 09:00 Bangkok time (UTC+7 = 02:00 UTC)
    cron.schedule('0 2 * * *', () => {
        console.log('[CRON] 09:00 Bangkok — running auto post...');
        processNextArticle();
    });

    // Webhook server
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
                                await replyToLine(replyToken, '⏳ กำลังดึงคิวถัดไปมาโพสต์... รอสักครู่ครับ', LINE_CHANNEL_ACCESS_TOKEN);
                                processNextArticle();

                            } else if (text.startsWith('เขียนบทความ:')) {
                                const kw = text.replace('เขียนบทความ:', '').trim();
                                if (!kw) {
                                    await replyToLine(replyToken, '❌ กรุณาระบุคีย์เวิร์ด เช่น\nเขียนบทความ: สายคล้องคอ เชียงใหม่', LINE_CHANNEL_ACCESS_TOKEN);
                                } else {
                                    await replyToLine(replyToken, `⏳ กำลังเขียนบทความ:\n"${kw}"\nรอสักครู่ครับ (1-2 นาที)`, LINE_CHANNEL_ACCESS_TOKEN);
                                    processKeywordDirect(kw);
                                }

                            } else if (text === 'เช็คคิว') {
                                const status = await getQueueStatus();
                                let msg = `📊 สถานะคิวปัจจุบัน:\n- รอดำเนินการ: ${status.pending} บทความ\n- โพสต์สำเร็จ: ${status.done} บทความ\n- ล้มเหลว: ${status.failed} บทความ`;
                                if (status.nextKeyword) msg += `\n\n📌 คิวถัดไป: "${status.nextKeyword}"`;
                                await replyToLine(replyToken, msg, LINE_CHANNEL_ACCESS_TOKEN);

                            } else if (text.startsWith('เพิ่มคิว:')) {
                                const kwString = text.replace('เพิ่มคิว:', '').trim();
                                if (!kwString) {
                                    await replyToLine(replyToken, '❌ กรุณาระบุคีย์เวิร์ด เช่น\nเพิ่มคิว: บัตรพนักงาน ชลบุรี, สายคล้องคอ ภูเก็ต', LINE_CHANNEL_ACCESS_TOKEN);
                                } else {
                                    const kwList = kwString.split(',').map(k => k.trim());
                                    const count = await addKeywordsToQueue(kwList);
                                    await replyToLine(replyToken, `✅ เพิ่ม ${count} คีย์เวิร์ดลงในระบบเรียบร้อยแล้ว`, LINE_CHANNEL_ACCESS_TOKEN);
                                }

                            } else if (text === 'ล่าสุด') {
                                const latest = await getLatestPost(WP_URL);
                                if (latest) {
                                    await replyToLine(replyToken, `📰 บทความล่าสุด:\n${latest.title}\n${latest.link}`, LINE_CHANNEL_ACCESS_TOKEN);
                                } else {
                                    await replyToLine(replyToken, '❌ ไม่พบบทความล่าสุด หรือดึงข้อมูลไม่ได้', LINE_CHANNEL_ACCESS_TOKEN);
                                }

                            } else if (text === 'เมนู') {
                                const menu = `📱 คำสั่งบอท SEO:\n\n1️⃣ โพสต์คิวถัดไป\nดึง keyword ถัดไปมาโพสต์ทันที\n\n2️⃣ เขียนบทความ: [keyword]\nแทรกคิวด่วน เช่น เขียนบทความ: สายคล้องคอ\n\n3️⃣ เช็คคิว\nดูสถานะคิวทั้งหมด\n\n4️⃣ เพิ่มคิว: [kw1], [kw2]\nเติมคีย์เวิร์ดเข้าระบบ\n\n5️⃣ ล่าสุด\nดูลิงก์บทความล่าสุด`;
                                await replyToLine(replyToken, menu, LINE_CHANNEL_ACCESS_TOKEN);

                            } else {
                                await replyToLine(replyToken, `❓ ไม่เข้าใจคำสั่งครับ\nพิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมด`, LINE_CHANNEL_ACCESS_TOKEN);
                            }
                        }
                    }
                    res.writeHead(200);
                    res.end('OK');
                } catch (err) {
                    console.error('Webhook error:', err.message);
                    res.writeHead(500);
                    res.end('Error');
                }
            });
        } else if (req.method === 'GET' && req.url === '/') {
            // Health check endpoint for Railway
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', bot: 'V-Success SEO Bot', time: new Date().toISOString() }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Webhook server running on port ${PORT}`);
        console.log(`Health check: GET /`);
        console.log(`LINE Webhook: POST /webhook`);
    });
}
