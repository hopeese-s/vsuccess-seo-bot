const path = require('path');
const { findRelatedPosts, buildRelatedPostsHtml } = require('./internal_linker');

/**
 * Builds Schema.org JSON-LD (Article + FAQPage + LocalBusiness)
 */
function generateSchema(title, keyword, faqs, permalink, imageUrl) {
    const nowIso = new Date().toISOString();
    const schemaGraph = [
        {
            "@type": "Article",
            "@id": `${permalink}#article`,
            "isPartOf": { "@id": permalink },
            "headline": title,
            "description": `${keyword} — V-Success Printing โรงงานผลิตสายคล้องคอโพลีเอสเตอร์และบัตรพนักงานคุณภาพสูง ส่งทั่วไทย ไม่มีขั้นต่ำ`,
            "image": imageUrl,
            "datePublished": nowIso,
            "dateModified": nowIso,
            "mainEntityOfPage": permalink,
            "author": {
                "@type": "Organization",
                "name": "V-Success Printing",
                "url": "https://www.vsuccessprint.co.th"
            },
            "publisher": {
                "@type": "Organization",
                "name": "V-Success Printing",
                "url": "https://www.vsuccessprint.co.th",
                "logo": {
                    "@type": "ImageObject",
                    "url": imageUrl
                }
            }
        },
        {
            "@type": "LocalBusiness",
            "@id": "https://www.vsuccessprint.co.th/#localbusiness",
            "name": "V-Success Printing (โรงงานผลิตสายคล้องคอ บัตรพนักงาน)",
            "url": "https://www.vsuccessprint.co.th",
            "telephone": "+66818483108",
            "priceRange": "฿฿",
            "address": {
                "@type": "PostalAddress",
                "addressCountry": "TH"
            },
            "areaServed": [
                { "@type": "Country", "name": "Thailand" }
            ],
            "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "opens": "08:30",
                "closes": "17:30"
            }
        }
    ];

    if (faqs && Array.isArray(faqs) && faqs.length > 0) {
        schemaGraph.push({
            "@type": "FAQPage",
            "@id": `${permalink}#faq`,
            "mainEntity": faqs.map(f => ({
                "@type": "Question",
                "name": f.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f.answer
                }
            }))
        });
    }

    return `\n\n<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@graph": schemaGraph }, null, 2)}\n</script>\n`;
}

/**
 * Matches relevant WordPress Tag IDs based on target keyword
 */
function matchWordPressTags(keyword) {
    const kw = keyword.toLowerCase();
    const tagIds = [];

    if (kw.includes('สาย') || kw.includes('สายคล้อง') || kw.includes('lanyard')) {
        tagIds.push(1013); // สายคล้องคอ
        tagIds.push(1015); // สายคล้องไม่มีขั้นต่ำ
        tagIds.push(1022); // สายห้อยบัตร
    }
    if (kw.includes('บัตรพนักงาน') || kw.includes('ป้ายพนักงาน') || kw.includes('ทำบัตร')) {
        tagIds.push(1014); // บัตรพนักงาน
        tagIds.push(1017); // บัตรพีวีซี
    }
    if (kw.includes('นักเรียน') || kw.includes('นักศึกษา')) {
        tagIds.push(1020); // บัตรนักเรียน
    }
    if (kw.includes('ข้าราชการ')) {
        tagIds.push(1021); // บัตรข้าราชการ
    }
    if (kw.includes('สะสมแต้ม')) {
        tagIds.push(1023); // บัตรสะสมแต้ม
    }
    if (kw.includes('จอดรถ')) {
        tagIds.push(1019); // บัตรจอดรถ
    }

    // Geo tags
    if (kw.includes('กรุงเทพ')) {
        tagIds.push(914); // ร้านทำบัตรพนักงานกรุงเทพ
        tagIds.push(950); // ทำบัตรพนักงานบริษัทกรุงเทพ
    }
    if (kw.includes('นนทบุรี')) tagIds.push(952);
    if (kw.includes('ปทุมธานี')) tagIds.push(951);
    if (kw.includes('สมุทรสาคร')) tagIds.push(953);
    if (kw.includes('นครปฐม')) tagIds.push(955);
    if (kw.includes('ใกล้ฉัน')) {
        tagIds.push(913); // ร้านทำบัตรพนักงานใกล้ฉัน
        tagIds.push(949); // ทำบัตรพนักงานบริษัทใกล้ฉัน
    }

    if (tagIds.length === 0) {
        tagIds.push(1013, 1014);
    }

    return [...new Set(tagIds)];
}

// Use Application Password for WordPress REST API (no browser needed)
async function postToWordPress(title, content, keyword, wpUrl, wpUser, wpPass, extraOptions = {}) {
    try {
        const baseUrl = wpUrl.replace(/\/wp-admin\/?$/, '').replace(/\/$/, '');

        // Extract optional parameters
        let faqs = [];
        let seoTitle = title;
        let metaDescription = '';

        if (Array.isArray(extraOptions)) {
            faqs = extraOptions;
            if (arguments.length > 7) seoTitle = arguments[7] || title;
            if (arguments.length > 8) metaDescription = arguments[8] || '';
        } else if (extraOptions && typeof extraOptions === 'object') {
            faqs = extraOptions.faqs || [];
            seoTitle = extraOptions.seoTitle || title;
            metaDescription = extraOptions.metaDescription || '';
        }

        console.log('Searching for related product image...');

        // 1. Find related product image from WooCommerce
        let mediaId = 8240; // Default Lanyard image
        let imageUrl = 'https://www.vsuccessprint.co.th/wp-content/uploads/2026/06/VS1700_53_17-1.png';

        try {
            const kw = keyword.toLowerCase();
            const hasYoyo = kw.includes('โยโย่') || kw.includes('yoyo');
            const hasHolder = kw.includes('กรอบ') || kw.includes('ซอง') || kw.includes('cardholder') || kw.includes('ใส่บัตร');
            const hasCard = kw.includes('บัตร') || kw.includes('card') || kw.includes('pvc');
            const hasLanyard = kw.includes('สาย') || kw.includes('สายคล้อง') || kw.includes('lanyard');
            
            // Search with the full keyword first
            let searchRes = await fetch(
                `${baseUrl}/wp-json/wp/v2/products?search=${encodeURIComponent(keyword)}&_embed=wp:featuredmedia&per_page=30`,
                { headers: { 'User-Agent': 'VSEOBot/1.0' } }
            );
            
            let products = await searchRes.json();
            
            // Fallback: If no products found, search with a generic term
            if (!products || products.length === 0) {
                let fallbackTerm = 'สินค้า';
                if (hasLanyard) fallbackTerm = 'สายคล้อง';
                else if (hasCard) fallbackTerm = 'บัตร';
                else if (hasHolder) fallbackTerm = 'กรอบ';
                else if (hasYoyo) fallbackTerm = 'โยโย่';
                
                searchRes = await fetch(
                    `${baseUrl}/wp-json/wp/v2/products?search=${encodeURIComponent(fallbackTerm)}&_embed=wp:featuredmedia&per_page=30`,
                    { headers: { 'User-Agent': 'VSEOBot/1.0' } }
                );
                products = await searchRes.json();
            }

            if (products && products.length > 0) {
                const productsWithImages = products.filter(p => 
                    p.featured_media &&
                    p._embedded &&
                    p._embedded['wp:featuredmedia'] &&
                    p._embedded['wp:featuredmedia'][0]
                );

                if (productsWithImages.length > 0) {
                    const randomIndex = Math.floor(Math.random() * productsWithImages.length);
                    const selected = productsWithImages[randomIndex];

                    mediaId = selected.featured_media;
                    imageUrl = selected._embedded['wp:featuredmedia'][0].source_url;
                    
                    console.log(`Selected random image from ${productsWithImages.length} available products. Product: ${selected.title.rendered}`);
                } else {
                    console.log('Found products but none had featured images. Using default.');
                }
            }
        } catch (imgErr) {
            console.log('Image search error (using default):', imgErr.message);
        }

        // Semantic Thai Alt Text for Image SEO
        const altText = `ภาพตัวอย่าง ${keyword} — โรงงานผลิต V-Success Printing ส่งทั่วไทย ไม่มีขั้นต่ำ`;
        const imageHtml = `<p style="text-align: center;"><img class="aligncenter size-large wp-image-${mediaId}" src="${imageUrl}" alt="${altText}" /></p>\n\n`;

        // 2. Fetch related posts for Internal Linking
        let internalLinksHtml = '';
        try {
            const related = await findRelatedPosts(keyword, baseUrl, title);
            if (related && related.length > 0) {
                internalLinksHtml = buildRelatedPostsHtml(related);
                console.log(`[InternalLinker] Injected ${related.length} internal links.`);
            }
        } catch (linkErr) {
            console.log('[InternalLinker] Internal link check failed, continuing without:', linkErr.message);
        }

        // 3. Generate Schema JSON-LD
        const schemaHtml = generateSchema(seoTitle || title, keyword, faqs, `${baseUrl}/`, imageUrl);

        // Combine all components into final content
        const finalContent = imageHtml + content + internalLinksHtml + schemaHtml;

        console.log(`Posting article via REST API with Application Password...`);

        // 4. Post directly via WordPress REST API using Application Password
        const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
        
        const matchedTags = matchWordPressTags(keyword);
        console.log(`Matched tags for "${keyword}":`, matchedTags);

        const postPayload = {
            title: title,
            content: finalContent,
            status: 'publish',
            featured_media: mediaId,
            categories: [32], // Category 32 = "บทความ" (seo)
            tags: matchedTags,
            meta: {
                rank_math_title: seoTitle || title,
                rank_math_description: metaDescription || `${keyword} — V-Success Printing โรงงานผลิตสายคล้องคอ บัตรพนักงาน ส่งทั่วไทย ไม่มีขั้นต่ำ`,
                rank_math_focus_keyword: keyword
            }
        };

        let response = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${credentials}`
            },
            body: JSON.stringify(postPayload)
        });

        // Self-healing: If WP returns 400, inspect error and retry cleanly
        if (response.status === 400) {
            const errorClone = await response.clone().text();
            let retried = false;
            if (errorClone.includes('meta') || errorClone.includes('rank_math')) {
                console.log('WordPress REST API does not support direct meta fields. Retrying without meta payload...');
                delete postPayload.meta;
                retried = true;
            }
            if (errorClone.includes('tags') || errorClone.includes('categories')) {
                console.log('WordPress REST API taxonomy error. Retrying without taxonomy...');
                delete postPayload.tags;
                delete postPayload.categories;
                retried = true;
            }
            if (retried) {
                response = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${credentials}`
                    },
                    body: JSON.stringify(postPayload)
                });
            }
        }

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`WP Server Error (HTTP ${response.status}). Expected JSON but got HTML. This usually means the website is down or blocking requests (e.g., Cloudflare/DNS). Snapshot: ${responseText.substring(0, 150)}...`);
        }

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}: Failed to post`);
        }

        console.log(`Article posted successfully! URL: ${data.link}`);
        return data.link;

    } catch (error) {
        console.error('Error posting to WordPress:', error.message);
        throw error;
    }
}

async function getLatestPost(wpUrl) {
    try {
        const baseUrl = wpUrl.replace(/\/wp-admin\/?$/, '').replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=1&status=publish`, {
            headers: { 'User-Agent': 'VSEOBot/1.0' }
        });
        
        if (response.ok) {
            const posts = await response.json();
            if (posts && posts.length > 0) {
                return {
                    title: posts[0].title.rendered,
                    link: posts[0].link
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching latest post:', error.message);
        return null;
    }
}

module.exports = { postToWordPress, getLatestPost, generateSchema, matchWordPressTags };
