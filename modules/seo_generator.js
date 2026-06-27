const { OpenAI } = require('openai');

async function generateArticle(keyword, apiKey) {
    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    const systemPrompt = `คุณคือผู้เชี่ยวชาญด้าน SEO และนักเขียน Content ภาษาไทยมืออาชีพ สำหรับธุรกิจ "V-Success Printing" ผู้รับทำบัตรพนักงาน สายคล้องคอ บัตรพลาสติก และสินค้าพรีเมี่ยมครบวงจร หน้าที่ของคุณคือการเขียนบทความจาก Keyword ที่ได้รับมอบหมาย โดยมีข้อกำหนดดังนี้:
- โครงสร้างบทความต้องถูกต้องตามหลัก SEO (มี Title ที่น่าสนใจ, มีการใช้ Heading H2 และ H3 อย่างชัดเจนและจัดรูปแบบด้วย HTML มาให้ถูกต้อง)
- Title (<h1>) ต้องอยู่ในรูปแบบแบรนด์ "vsuccessprint.co.th | [keyword] — [จุดขายของร้าน เช่น ไม่มีขั้นต่ำ, ราคาถูก, ครบวงจร, บัตรนักเรียน/ข้าราชการ, 1 เส้นก็ทำได้, ออกแบบฟรี]" เลือกจุดขายให้เหมาะกับ keyword นั้นๆ
- กระจาย Keyword หลักและ Keyword รองอย่างเป็นธรรมชาติ ไม่ยัดเยียด
- ใช้ภาษาไทยที่สละสลวย อ่านง่าย เหมือนมนุษย์เขียน (ห้ามใช้ภาษาแปลกๆ แบบหุ่นยนต์)
- เนื้อหาในบทความให้เน้นจุดเด่นของ V-Success Printing: ไม่มีขั้นต่ำ, ออกแบบฟรี, ผลิตเร็ว, ราคาถูก, รับทุกประเภทบัตร (บัตรพนักงาน บัตรนักเรียน บัตรข้าราชการ), สายคล้องคอทุกแบบ
- มีบทสรุปเนื้อหา (Conclusion) ที่ช่วงท้ายของบทความเสมอ พร้อม Call-to-Action ให้ติดต่อ V-Success Printing
- ห้าม ดึงสไตล์การเขียนหรืออ้างอิงข้อมูลลอยๆ จากบทความเก่าๆ นอกเหนือจาก Keyword ที่ให้ไป เพื่อป้องกันอาการ Hallucination
- ผลลัพธ์ต้องเป็น HTML ล้วนๆ (ไม่ต้องมี Markdown code block หุ้ม) โดยแบ่งเป็นบรรทัดแรกคือ <h1> (Title) และบรรทัดต่อๆ ไปคือเนื้อหา (H2, H3, p)`;

    const userPrompt = `เขียนบทความ SEO สำหรับ Keyword: "${keyword}"

ตัวอย่างรูปแบบ Title ที่ต้องการ:
- vsuccessprint.co.th | รับทำบัตรพนักงาน ราคาถูก ไม่มีขั้นต่ำ ครบวงจร 1 เส้นก็ขาย
- vsuccessprint.co.th | สายคล้องคอราคาส่ง — รับทำทุกแบบ พิมพ์โลโก้ได้ ออกแบบฟรี
- vsuccessprint.co.th | บัตรพลาสติก บัตรนักเรียน บัตรข้าราชการ พิมพ์คมชัด ราคาโรงงาน
เลือกรูปแบบที่เหมาะกับ Keyword และปรับถ้อยคำให้เป็นธรรมชาติ`;

    try {
        const completion = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        });

        const rawOutput = completion.choices[0].message.content;
        
        // Extract Title from the first <h1> or fallback to the keyword
        let title = keyword;
        let content = rawOutput;
        
        const titleMatch = rawOutput.match(/<h1>(.*?)<\/h1>/i);
        if (titleMatch) {
            title = titleMatch[1];
            // Remove the h1 from content since WP title is separate
            content = rawOutput.replace(/<h1>.*?<\/h1>/i, '').trim();
        }

        return { title, content };
    } catch (error) {
        console.error('Error generating article with DeepSeek:', error);
        throw error;
    }
}

module.exports = { generateArticle };
