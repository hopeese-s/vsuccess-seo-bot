const path = require('path');

// Use Application Password for WordPress REST API (no browser needed)
async function postToWordPress(title, content, keyword, wpUrl, wpUser, wpPass) {
    try {
        const baseUrl = wpUrl.replace(/\/wp-admin\/?$/, '').replace(/\/$/, '');

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
                let scoredProducts = [];

                for (const product of products) {
                    const productTitle = product.title.rendered.toLowerCase();
                    let score = 0;

                    const isProductYoyo = productTitle.includes('โยโย่') || productTitle.includes('yoyo');
                    const isProductHolder = productTitle.includes('กรอบ') || productTitle.includes('ซอง') || productTitle.includes('cardholder');
                    const isProductCard = (productTitle.includes('บัตร') || productTitle.includes('card')) && !isProductHolder && !isProductYoyo;
                    const isProductLanyard = productTitle.includes('สาย') || productTitle.includes('สายคล้อง') || productTitle.includes('lanyard');

                    if (hasYoyo && isProductYoyo) score += 15;
                    if (!hasYoyo && isProductYoyo) score -= 15;
                    if (hasHolder && isProductHolder) score += 15;
                    if (!hasHolder && isProductHolder) score -= 15;
                    if (hasCard && isProductCard) score += 15;
                    if (!hasCard && isProductCard) score -= 15;
                    if (hasLanyard && isProductLanyard) score += 15;
                    if (!hasLanyard && isProductLanyard) score -= 15;

                    if (kw.includes('บัตรพนักงาน') && productTitle.includes('บัตรพนักงาน')) score += 20;
                    if (kw.includes('สายคล้องคอ') && productTitle.includes('สายคล้องคอ')) score += 20;
                    if (kw.includes('บัตรพลาสติก') && productTitle.includes('บัตรพลาสติก')) score += 20;

                    scoredProducts.push({ product, score });
                }

                // Sort by score descending
                scoredProducts.sort((a, b) => b.score - a.score);
                
                // Get the highest score
                const highestScore = scoredProducts[0].score;
                
                // Filter all products that have the highest score (or close to it) to add variety
                const topMatches = scoredProducts.filter(p => p.score >= highestScore - 5);
                
                // Randomly select one from the top matches
                const randomIndex = Math.floor(Math.random() * topMatches.length);
                const selected = topMatches[randomIndex].product;

                if (
                    selected.featured_media &&
                    selected._embedded &&
                    selected._embedded['wp:featuredmedia'] &&
                    selected._embedded['wp:featuredmedia'][0]
                ) {
                    mediaId = selected.featured_media;
                    imageUrl = selected._embedded['wp:featuredmedia'][0].source_url;
                }
            }
        } catch (imgErr) {
            console.log('Image search error (using default):', imgErr.message);
        }

        const imageHtml = `<p style="text-align: center;"><img class="aligncenter size-large wp-image-${mediaId}" src="${imageUrl}" alt="${keyword}" /></p>\n\n`;
        const finalContent = imageHtml + content;

        console.log(`Posting article via REST API with Application Password...`);

        // 2. Post directly via WordPress REST API using Application Password
        const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
        const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${credentials}`
            },
            body: JSON.stringify({
                title: title,
                content: finalContent,
                status: 'publish',
                featured_media: mediaId
            })
        });

        const data = await response.json();

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

module.exports = { postToWordPress, getLatestPost };
