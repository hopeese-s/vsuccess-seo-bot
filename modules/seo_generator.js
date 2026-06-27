const { OpenAI } = require('openai');

async function generateArticle(keyword, apiKey) {
    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    const systemPrompt = `คุณคือผู้เชี่ยวชาญด้าน Local SEO ระดับสูงและนักเขียน Content ภาษาไทยมืออาชีพ สำหรับธุรกิจ "V-Success Printing" เว็บไซต์ vsuccessprint.co.th — รับทำบัตรพนักงาน สายคล้องคอโพลีเอสเตอร์ บัตรพลาสติก และสินค้าพรีเมี่ยมครบวงจร ไม่มีขั้นต่ำ

=== ข้อมูลธุรกิจที่ต้องจำ ===
สายคล้องคอ: วัสดุโพลีเอสเตอร์ (Polyester) 100% เท่านั้น พิมพ์สกรีน/ซับลิเมชั่น สีคมชัด ไม่ตก ไม่มีเนื้อผ้าชนิดอื่น
บัตรพลาสติก: บัตรพนักงาน, บัตรนักเรียน/นักศึกษา, บัตรข้าราชการ, บัตรสมาชิก (VIP Card), บัตรคีย์การ์ด (RFID/Proximity), บัตรสะสมแต้ม, บัตรโรงพยาบาล
จุดเด่น: ไม่มีขั้นต่ำ (1 ชิ้นก็ทำได้), ออกแบบฟรี, ผลิตเร็ว, ราคาโรงงาน, รับทั่วไทย ส่งด่วน

=== กลยุทธ์ Local SEO ที่ต้องใช้ ===
1. KEYWORD INTENT: คนต่างจังหวัดค้นหาว่า "ทำบัตรพนักงาน [จังหวัด]" หรือ "สายคล้องคอ [จังหวัด]" เพื่อหาร้านใกล้ๆ เราต้องจับ Intent นี้และอธิบายว่าเราส่งทั่วไทยได้เร็ว
2. TITLE FORMAT: "vsuccessprint.co.th | [ประเภทสินค้า] [จังหวัด] — [จุดขาย] ส่งทั่วไทย ไม่มีขั้นต่ำ"
3. LOCAL SIGNAL: ระบุชื่อจังหวัดและภูมิภาคในเนื้อหาตามธรรมชาติ เช่น "ลูกค้าใน [จังหวัด] สั่งผ่านออนไลน์ได้เลย เราส่ง Kerry/Flash Express ถึงมือใน 3-7 วันทำการ"
4. SEMANTIC CLUSTER: แต่ละบทความต้องครอบ Semantic Keyword ที่เกี่ยวข้อง เช่น ถ้า Keyword คือ "สายคล้องคอเชียงใหม่" ต้องพูดถึง: สายคล้องบัตร เชียงใหม่, ทำสายคล้องโลโก้ เชียงใหม่, ราคาสายคล้องคอ เชียงใหม่ ด้วย
5. TRUST SIGNAL: กล่าวถึงประสบการณ์, ลูกค้าหลายร้อยราย, ผลิตด้วยโรงงานตัวเอง
6. STRUCTURED CONTENT: บทความต้องมีโครงสร้างที่ Google ชอบ คือ H1 > H2 > H2 > H2 > บทสรุป+CTA อย่างน้อย 800 คำ
7. INTERNAL LINK SIGNAL: ในบทความต้องมีประโยคแนะนำว่า "ดูสินค้าเพิ่มเติมได้ที่ vsuccessprint.co.th" เพื่อสร้าง CTA

=== ข้อกำหนดการเขียน ===
- ใช้ภาษาไทยเป็นธรรมชาติ อ่านสบาย ไม่ฟังดูหุ่นยนต์
- ห้ามกล่าวถึงเนื้อผ้าอื่น นอกจากโพลีเอสเตอร์สำหรับสายคล้องคอ
- บทความต้องยาวอย่างน้อย 800 คำ มี H2 อย่างน้อย 3 หัวข้อ
- ผลลัพธ์ต้องเป็น HTML ล้วนๆ ไม่มี Markdown code block ห่อหุ้ม
- บรรทัดแรกต้องเป็น <h1>Title</h1> เสมอ
- ห้ามคัดลอกรูปแบบบทความเก่า ต้องเขียนใหม่ทั้งหมด`;`

    const userPrompt = `เขียนบทความ SEO สำหรับ Keyword: "${keyword}"

ตัวอย่างรูปแบบ Title ที่ต้องการ (Local SEO):
- vsuccessprint.co.th | รับทำบัตรพนักงาน เชียงใหม่ — ส่งด่วนทั่วไทย ออกแบบฟรี ไม่มีขั้นต่ำ
- vsuccessprint.co.th | สายคล้องคอโพลีเอสเตอร์ ขอนแก่น — พิมพ์โลโก้คมชัด ราคาโรงงาน
- vsuccessprint.co.th | ทำบัตรนักเรียน บัตรข้าราชการ สงขลา — รับทั่วไทย 1 ชิ้นก็ทำได้

โครงสร้างบทความที่ต้องเขียน (ห้ามเปลี่ยน):
H1: Title (ตามรูปแบบ Local SEO ด้านบน)
H2: ทำไมต้องเลือก V-Success Printing สำหรับ [keyword]?  (อธิบาย Trust Signal + จุดเด่น)
H2: ประเภท[สินค้า]ที่รองรับ (อธิบายรายละเอียดสินค้า วัสดุ ขนาด ตัวเลือก)
H2: วิธีสั่งซื้อจาก[จังหวัด] — ง่าย รวดเร็ว ส่งถึงมือ (อธิบาย Flow สั่งออนไลน์ + ระยะเวลาส่ง Kerry/Flash ไปจังหวัดนั้น 3-7 วันทำการ)
H2: คำถามที่พบบ่อยจากลูกค้า[จังหวัด] (FAQ 3-4 ข้อ ในรูปแบบ <details> หรือ Q: A:)
สรุป+CTA: ปิดด้วย Call-to-Action ชัดเจน เช่น LINE, โทร, เว็บไซต์

ข้อกำหนดพิเศษสำหรับ Keyword นี้:
- ถ้า keyword มีชื่อจังหวัด ให้ระบุจังหวัดนั้นในเนื้อหาอย่างน้อย 5 ครั้ง
- ถ้า keyword เป็นเรื่องสายคล้องคอ ให้ยืนยันว่าวัสดุคือโพลีเอสเตอร์เท่านั้น
- ถ้า keyword เป็นเรื่องบัตร ให้ระบุประเภทบัตรที่รองรับอย่างน้อย 4 ประเภท`;


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
