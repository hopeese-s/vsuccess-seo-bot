const { OpenAI } = require('openai');

async function callGemini(systemPrompt, userPrompt, apiKey, preferredModel = 'gemini-3.5-flash-lite') {
    const candidateModels = [preferredModel, 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-pro-preview'];
    const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

    let lastError = null;
    for (const model of uniqueModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ parts: [{ text: userPrompt }] }]
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    return data.candidates[0].content.parts[0].text;
                }

                const errText = await res.text();
                lastError = new Error(`Gemini API [${model}] Error (HTTP ${res.status}): ${errText.substring(0, 150)}`);
                if (res.status === 503) {
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    break;
                }
            } catch (err) {
                lastError = err;
            }
        }
    }
    throw lastError || new Error('Failed to generate article with Gemini');
}

/**
 * Extracts Q&A pairs from HTML content for AEO / FAQPage Schema.org
 */
function extractFAQs(htmlContent) {
    const faqs = [];
    const regex = /<h3>([^<]+)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = regex.exec(htmlContent)) !== null) {
        const q = match[1].replace(/<[^>]*>/g, '').trim();
        const a = match[2].replace(/<[^>]*>/g, '').trim();
        if (q && a && (q.includes('?') || q.includes('คำถาม') || q.includes('ไหม') || q.includes('เท่าไหร่') || q.includes('อย่างไร') || q.includes('กี่วัน') || q.includes('อะไร') || q.includes('ดีไหม') || q.includes('ที่ไหน') || q.includes('ทำไม'))) {
            faqs.push({ question: q, answer: a });
        }
    }
    return faqs;
}

const PERSONAS = [
    {
        role: "เจ้าของโรงงาน V-Success Printing (ประสบการณ์กว่า 10 ปี)",
        style: "เป็นกันเอง จริงใจ พูดตรงประเด็น มั่นใจ เน้นเรื่องความคุ้มค่า คุณภาพเนื้อผ้าโพลีเอสเตอร์ 100% สกรีนสีคมชัดไม่ตก และความยืดหยุ่นที่ 1 ชิ้นก็ผลิตให้ได้ ไม่มีขั้นต่ำ สั่งง่ายผ่านออนไลน์"
    },
    {
        role: "ผู้เชี่ยวชาญด้านมาตรฐานงานพิมพ์และระบบบัตรองค์กร",
        style: "มืออาชีพ ชัดเจน อธิบายมาตรฐานระบบพิมพ์ซับลิเมชั่นที่สีฝังแน่นในเนื้อผ้า ขนาดสายมาตรฐาน 10, 15, 20, 25 มม. และบัตรพลาสติก PVC กันน้ำ แข็งแรงทนทาน เหมาะสำหรับองค์กร บริษัท และโรงเรียน"
    },
    {
        role: "ที่ปรึกษาฝ่ายจัดซื้อและผลิตสินค้าพรีเมี่ยมสำหรับ HR/ฝ่ายบริหาร",
        style: "เข้าใจความกังวลของคนทำงาน เรื่องงบประมาณ ความรวดเร็วในการจัดส่งถึงหน้าออฟฟิศใน 3-7 วันทำการ การสั่งชิ้นตัวอย่างเพื่อตรวจงานก่อน และบริการออกแบบฟรี"
    }
];

async function generateArticle(keyword, apiKey) {
    const effectiveApiKey = process.env.GEMINI_API_KEY || process.env.OPENCODE_API_KEY || process.env.DEEPSEEK_API_KEY || apiKey;
    const isGemini = (effectiveApiKey && effectiveApiKey.startsWith('AIzaSy')) || Boolean(process.env.GEMINI_API_KEY);
    const isOpencode = (effectiveApiKey && effectiveApiKey.startsWith('oc_')) || Boolean(process.env.OPENCODE_API_KEY);

    let defaultModel = 'deepseek-v4-pro';
    if (isGemini) defaultModel = 'gemini-3.5-flash-lite';
    const model = process.env.AI_MODEL || defaultModel;

    // Pick dynamic persona for semantic diversity
    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];

    const systemPrompt = `คุณคือผู้เชี่ยวชาญด้าน SEO/AEO (Answer Engine Optimization) ระดับสูง และนักเขียน Content ภาษาไทยมืออาชีพ สำหรับธุรกิจ "V-Success Printing" เว็บไซต์ vsuccessprint.co.th — โรงงานรับทำบัตรพนักงาน สายคล้องคอโพลีเอสเตอร์ บัตรพลาสติก และสินค้าพรีเมี่ยมครบวงจร ไม่มีขั้นต่ำ

=== บุคลิกการเขียน (Persona) ประจำบทความนี้ ===
คุณกำลังเขียนในฐานะ: ${persona.role}
แนวทางการสื่อสาร: ${persona.style}

=== ข้อมูลธุรกิจที่ต้องจำ ===
สายคล้องคอ: วัสดุโพลีเอสเตอร์ (Polyester) 100% เท่านั้น พิมพ์สกรีน/ซับลิเมชั่น สีคมชัด ไม่ตก ไม่มีเนื้อผ้าชนิดอื่น ขนาดสายมีตั้งแต่ 10, 15, 20, 25 มิลลิเมตร (10-25 มิล) เท่านั้น
บัตรพลาสติก: บัตรพนักงาน, บัตรนักเรียน/นักศึกษา, บัตรข้าราชการ, บัตรสมาชิก (VIP Card), บัตรคีย์การ์ด (RFID/Proximity), บัตรสะสมแต้ม, บัตรโรงพยาบาล
จุดเด่น: ไม่มีขั้นต่ำ (1 ชิ้นก็ทำได้), ออกแบบฟรี, ผลิตเร็ว, ราคาโรงงาน, รับงานทั่วไทย ส่ง Kerry/Flash Express 3-7 วันทำการ
ช่องทางติดต่อ: LINE Official: @vsuccessprint | โทรศัพท์: 0818483108 | เว็บไซต์: vsuccessprint.co.th

=== กลยุทธ์ SEO & AEO (Answer Engine Optimization) 2026 ===
1. KEYWORD INTENT: คนต่างจังหวัดค้นหาว่า "ทำบัตรพนักงาน [จังหวัด]" หรือ "[สินค้า] ใกล้ฉัน" เพื่อหาร้าน เราต้องอธิบายให้ชัดเจนว่าสั่งออนไลน์แล้วส่งตรงถึงที่ได้รวดเร็ว
2. TITLE FORMAT: "vsuccessprint.co.th | [ประเภทสินค้า] [จังหวัด/พื้นที่] — [จุดขาย เช่น ส่งทั่วไทย ไม่มีขั้นต่ำ ออกแบบฟรี]"
3. LOCAL SIGNAL: ระบุชื่อจังหวัดในเนื้อหาอย่างน้อย 5 ครั้ง เพื่อให้ Google จับ Local Signal
4. SEMANTIC CLUSTER: ครอบ Keyword รองที่เกี่ยวข้อง ต้องเน้นคำเหล่านี้ในบทความ: ร้านทำบัตรพนักงาน ใกล้ฉัน, ที่ห้อยบัตรพนักงาน, สายคล้องคอใส่บัตร, ผลิตสายคล้องคอ, รับทำสายคล้องคอ, ป้ายพนักงาน, กรอบใส่บัตรพนักงาน, ป้ายคล้องคอราคา, สายคล้องบัตรราคาถูก, ราคาสายคล้องบัตร
5. BLUF RULE (Bottom Line Up Front): ใต้ <h1> บรรทัดแรกสุดของเนื้อหา ต้องมีบทสรุปคำตอบหลักทันที 40-55 คำ เพื่อให้ Google AI Overview และ Perplexity ดึงไปแสดงผลได้ทันที ตอบให้ครบ: ใคร ผลิตอะไร ส่งที่ไหน เร็วกี่วัน สั่งขั้นต่ำเท่าไร สั่งทางไหน
6. STATISTICS & PROOF RULE: ใส่ตัวเลขและข้อเท็จจริงเชิงประจักษ์อย่างน้อย 3 จุด เช่น "ผลิตให้ลูกค้าองค์กรกว่า 500 แห่งทั่วประเทศ", "จัดส่งถึงมือใน 3-7 วันทำการ", "สายโพลีเอสเตอร์ 100% มี 4 ขนาดให้เลือก (10, 15, 20, 25 มม.)", "ไม่มีขั้นต่ำ 1 ชิ้นก็สั่งได้"
7. TABLE RULE: ต้องมีตารางเปรียบเทียบหรือตารางสเปกสินค้าอย่างน้อย 1 ตาราง โดยเขียนด้วย HTML tag <table>, <thead>, <tbody>, <th>, <td> อย่างถูกต้อง เช่น ตารางเปรียบเทียบขนาดสาย หรือตารางประเภทบัตรพนักงาน หรือตารางขั้นตอนสั่งผลิต
8. THAI INTENT KEYWORDS: แทรกคำค้นแสดงเจตนาซื้อของคนไทยลงในหัวข้อ H2/H3 และเนื้อหา เช่น "ที่ไหนดี", "แนะนำ", "ราคาเท่าไหร่", "รีวิว", "ใกล้ฉัน"
9. AEO FAQ FORMAT: ส่วนท้ายของบทความ ต้องมีหัวข้อ FAQ 3-4 ข้อ โดยใช้รูปแบบ:
   <h3>คำถาม?</h3>
   <p>คำตอบตรงประเด็น ชัดเจน 45-75 คำ ที่สมบูรณ์ในตัวเอง</p>
   **บังคับสำหรับ FAQ ข้อแรก:** ต้องถามเจาะจงเรื่อง "ราคาเท่าไหร่" และ "มีขั้นต่ำไหม" เช่น:
   <h3>สั่งทำ${keyword} ราคาเท่าไหร่ มีขั้นต่ำไหม สั่ง 1 ชิ้นได้หรือเปล่า?</h3>
   และตอบว่าไม่มีขั้นต่ำ ทำเท่าไหร่ก็ได้ ราคาขึ้นอยู่กับจำนวน ยิ่งสั่งเยอะยิ่งคุ้มค่าในราคาระดับโรงงาน
10. CALL-TO-ACTION: ปิดท้ายด้วย CTA ชัดเจน ให้ทัก LINE: @vsuccessprint หรือโทร: 0818483108

=== ข้อกำหนดการเขียน (Anti-AI Tone & Fact Check) ===
- **ห้ามใช้คำขึ้นต้นหรือคำเชื่อมแบบ AI เด็ดขาด** เช่น "ในยุคปัจจุบันที่...", "ปฏิเสธไม่ได้ว่า...", "อย่างไรก็ตาม...", "นอกจากนี้...", "สรุปได้ว่า...", "ในโลกที่...", "ทั้งนี้..."
- เขียนด้วยภาษาพูดกึ่งทางการ (Conversational Tone) เหมือนคนที่มีประสบการณ์กำลังแนะนำลูกค้าจริงๆ เป็นกันเอง มั่นใจ ไม่อ้อมค้อม
- ไม่ต้องเกริ่นนำน้ำท่วมทุ่ง ให้เข้าประเด็นทันทีว่าเราคือใคร ช่วยแก้ปัญหาอะไรให้ลูกค้าได้บ้าง
- แทนที่จะใช้คำว่า "สรุปได้ว่า" ในตอนท้าย ให้ใช้คำที่เป็นธรรมชาติแทน เช่น "ถ้าคุณกำลังมองหา...", "สั่งง่ายๆ แค่ทักไลน์..."
- **กฎเหล็กเรื่องราคา:** ห้ามระบุจำนวนตัวเลขแปลกๆ หรือเขียนว่า "ตั้งแต่ 1 ใบไปจนถึง 10,000 ใบ ราคาเท่ากัน" เด็ดขาด ให้เขียนแค่ว่า "ไม่มีขั้นต่ำ ทำเท่าไหร่ก็ได้ ราคาขึ้นอยู่กับจำนวน" (ยิ่งสั่งเยอะ ราคายิ่งถูกลง)
- ห้ามกล่าวถึงเนื้อผ้าอื่นสำหรับสายคล้องคอ นอกจากโพลีเอสเตอร์ 100% เท่านั้น
- บทความต้องยาวอย่างน้อย 800 คำ มี H2 อย่างน้อย 3 หัวข้อ
- ผลลัพธ์ต้องเป็น HTML ล้วนๆ ห้ามมี Markdown code block ห่อหุ้ม
- **ห้ามใช้สัญลักษณ์ Markdown ดอกจันเด็ดขาด** (เช่น ห้ามใช้ **ข้อความ** เพื่อทำตัวหนา) ให้ใช้ HTML Tag เช่น <strong>ข้อความ</strong> หรือ <b>ข้อความ</b> แทนเท่านั้น
- บรรทัดแรกต้องเป็น <h1>Title</h1> เสมอ
- ห้ามคัดลอกรูปแบบบทความเก่า ต้องเขียนใหม่ทั้งหมด`;

    const userPrompt = `เขียนบทความ SEO/AEO สำหรับ Keyword: "${keyword}"

ตัวอย่างรูปแบบ Title ที่ต้องการ (Local SEO):
- vsuccessprint.co.th | รับทำบัตรพนักงาน เชียงใหม่ — สายคล้องบัตรใกล้ฉัน ส่งทั่วประเทศ ไม่มีขั้นต่ำ ออกแบบฟรี
- vsuccessprint.co.th | สายคล้องคอโพลีเอสเตอร์ ขอนแก่น — ส่งทั่วประเทศ ราคาโรงงาน ออกแบบฟรี
- vsuccessprint.co.th | ทำบัตรนักเรียน บัตรข้าราชการ สงขลา — สายคล้องบัตรใกล้ฉัน ส่งทั่วประเทศ 1 ชิ้นก็ทำได้

โครงสร้างบทความที่ต้องเขียน:
<h1>Title ตามรูปแบบด้านบน</h1>
<p><strong>[BLUF Quick Answer 40-55 คำ]</strong> สรุปคำตอบหลักทันที: V-Success Printing รับผลิต... ส่งถึง[จังหวัด/พื้นที่] ภายใน 3-7 วันทำการ ไม่มีขั้นต่ำ ออกแบบฟรี สั่งง่ายผ่าน LINE: @vsuccessprint โทร 0818483108</p>
<h2>[แทรก Keyword เช่น ร้านทำบัตรพนักงาน ใกล้ฉัน ที่ไหนดี] ทำไมองค์กรถึงเลือก V-Success Printing?</h2>
(เนื้อหาอธิบายจุดเด่น พร้อมตัวเลขสถิติลูกค้า 500+ แห่ง)
<h2>[แทรก Keyword เช่น สายคล้องคอใส่บัตร / สเปกสินค้า] เปรียบเทียบสินค้าและขนาดมาตรฐาน</h2>
(มีตาราง HTML <table> <thead> <tbody> เปรียบเทียบขนาด 10, 15, 20, 25 มม. หรือประเภทบัตร)
<h2>[แทรก Keyword] ขั้นตอนการสั่งผลิต — ส่งตรงถึงมือใน 3-7 วันทำการ</h2>
(อธิบายขั้นตอนสั่งออนไลน์ง่ายๆ 4 ขั้นตอน)
<h2>คำถามที่พบบ่อย (FAQ) เกี่ยวกับ${keyword}</h2>
(คำถาม-คำตอบ AEO 3-4 ข้อ รูปแบบ <h3>คำถาม?</h3><p>คำตอบ 45-75 คำ</p> โดยข้อแรกบังคับถาม: "สั่งทำ${keyword} ราคาเท่าไหร่ มีขั้นต่ำไหม สั่ง 1 ชิ้นได้หรือเปล่า?")
<h2>สั่งทำ${keyword} กับ V-Success Printing วันนี้</h2>
(บทสรุปเป็นธรรมชาติ + Call to Action สั่งผ่าน LINE: @vsuccessprint หรือโทร: 0818483108)

ข้อกำหนดพิเศษ:
- ถ้า keyword มีชื่อจังหวัด ให้ระบุจังหวัดนั้นในเนื้อหาอย่างน้อย 5 ครั้ง
- ถ้า keyword มีคำว่า "ภาค" (เช่น ภาคเหนือ, ภาคใต้, ภาคกลาง, ภาคอีสาน, ภาคตะวันออก, ภาคตะวันตก) **บังคับให้สร้างหัวข้อย่อยใหม่ (H2 หรือ H3)** และใช้รูปแบบรายการ Bullet Points (<ul><li>) ลิสต์รายชื่อจังหวัดในภาคนั้นๆ ให้ครบทุกจังหวัด ห้ามเขียนต่อกันเป็นบรรทัดเดียวเด็ดขาด
- ต้องมีคำว่า "สายคล้องบัตรใกล้ฉัน" และ "ส่งทั่วประเทศ" แทรกอยู่ในหัวข้อ H1 หรือ H2 อย่างเป็นธรรมชาติ
- **บังคับ:** ต้องนำ Keyword สำคัญ (เช่น ร้านทำบัตรพนักงาน ใกล้ฉัน, ที่ห้อยบัตรพนักงาน, สายคล้องคอใส่บัตร, กรอบใส่บัตรพนักงาน, ป้ายพนักงาน, ป้ายคล้องคอราคา, สายคล้องบัตรราคาถูก) ไปประกอบเป็นส่วนหนึ่งของหัวข้อ H2 หรือ H3 ทุกหัวข้อ
- ถ้า keyword เป็นเรื่องสายคล้องคอ ให้ยืนยันว่าวัสดุคือโพลีเอสเตอร์เท่านั้น และ **ห้ามเขียนอธิบายรายละเอียดของสายแต่ละขนาด** (เช่น ห้ามเขียนว่า 10 มม. ใส่สบาย, 25 มม. แข็งแรง) ให้ระบุสั้นๆ แค่ว่า "มีขนาดให้เลือกตั้งแต่ 10, 15, 20, 25 มม." เท่านั้น
- ถ้า keyword เป็นเรื่องบัตร ให้ระบุประเภทบัตรที่รองรับอย่างน้อย 4 ประเภท`;

    try {
        // === Stage 1: Strategy & Outline Synthesis ===
        let outlineContext = '';
        try {
            const outlinePrompt = `สำหรับ Keyword: "${keyword}"
ช่วยสรุปประเด็นหลัก 3-4 บรรทัด สำหรับการเขียนบทความ:
1. Pain point ของลูกค้าในพื้นที่เป้าหมาย
2. สถิติ 3 ข้อที่ต้องเน้น (ลูกค้าองค์กร 500+ แห่ง, ขนส่ง 3-7 วัน, สาย 10, 15, 20, 25 มม.)
3. คำถาม FAQ หลักที่คนค้นหาบ่อยที่สุด`;

            if (isGemini) {
                outlineContext = await callGemini('คุณคือที่ปรึกษาวางโครงสร้างเนื้อหา SEO', outlinePrompt, effectiveApiKey, model);
            }
            console.log(`[Stage 1] Outline strategy generated for "${keyword}". Persona: ${persona.role}`);
        } catch (stage1Err) {
            console.log(`[Stage 1] Outline skipped (${stage1Err.message}), proceeding to full article.`);
        }

        // === Stage 2: Deep Content Generation ===
        let enrichedUserPrompt = userPrompt;
        if (outlineContext) {
            enrichedUserPrompt += `\n\n=== บริบทเพิ่มเติมจากโครงร่างกลยุทธ์ ===\n${outlineContext}`;
        }

        let rawOutput = '';
        if (isGemini) {
            rawOutput = await callGemini(systemPrompt, enrichedUserPrompt, effectiveApiKey, model);
        } else {
            const defaultBaseURL = isOpencode ? 'https://opencode.ai/zen/go/v1' : 'https://api.deepseek.com';
            const baseURL = process.env.AI_BASE_URL || defaultBaseURL;
            const openai = new OpenAI({
                baseURL: baseURL,
                apiKey: effectiveApiKey,
                fetch: globalThis.fetch,
                defaultHeaders: isOpencode ? { 'x-opencode-session': 'vsuccess-seo-bot' } : {}
            });
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: enrichedUserPrompt }
                ]
            });
            rawOutput = completion.choices[0].message.content;
        }

        // Clean any code block tags if present
        rawOutput = rawOutput.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

        let title = keyword;
        let content = rawOutput;

        const titleMatch = rawOutput.match(/<h1>(.*?)<\/h1>/i);
        if (titleMatch) {
            title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
            content = rawOutput.replace(/<h1>.*?<\/h1>/i, '').trim();
        }

        // Clean out any lingering markdown asterisks if the AI accidentally generated them
        content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Extract FAQs for Schema.org FAQPage JSON-LD
        const faqs = extractFAQs(content);

        // Generate SEO meta title and description
        const seoTitle = title;
        const metaDescription = `${keyword} — V-Success Printing โรงงานผลิตสายคล้องคอ บัตรพนักงาน คุณภาพสูง ไม่มีขั้นต่ำ ออกแบบฟรี ผลิตเร็ว ส่งทั่วไทย ทัก LINE @vsuccessprint โทร 0818483108`;

        return {
            title,
            content,
            faqs,
            seoTitle,
            metaDescription
        };
    } catch (error) {
        console.error('SEO Generator error:', error.message);
        throw error;
    }
}

module.exports = { generateArticle, extractFAQs, PERSONAS };
