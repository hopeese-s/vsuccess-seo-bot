const puppeteer = require('puppeteer');

async function postToWordPress(title, content, keyword, wpUrl, wpUser, wpPass) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        console.log("Logging into WordPress...");
        
        // Handle trailing slashes in URLs
        const baseUrl = wpUrl.replace(/\/wp-admin\/?$/, '').replace(/\/$/, '');
        
        await page.goto(`${baseUrl}/my/`, { waitUntil: 'networkidle2' });
        
        await page.type('input[name="username"], input[name="log"], #user_login', wpUser);
        await page.type('input[name="pwd"], #user_pass', wpPass);
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.keyboard.press('Enter')
        ]);
        
        console.log("Navigating to wp-admin to get REST API Nonce...");
        // Go to a post-new page to load wpApiSettings
        await page.goto(`${baseUrl}/wp-admin/post-new.php`, { waitUntil: 'networkidle2' });
        
        console.log("Posting article via REST API...");
        const result = await page.evaluate(async (postTitle, postContent, searchKeyword) => {
            try {
                const nonce = window.wpApiSettings ? window.wpApiSettings.nonce : null;
                if (!nonce) return { error: "No wpApiSettings nonce found. Login might have failed or user lacks capabilities." };
                
                // 1. Find a related product image
                let imageUrl = "https://www.vsuccessprint.co.th/wp-content/uploads/2026/06/VS1700_53_17-1.png"; // Default Lanyard Image
                let mediaId = 8240; // Default Lanyard Media ID

                try {
                    const searchRes = await fetch('/wp-json/wp/v2/products?search=' + encodeURIComponent(searchKeyword) + '&_embed=wp:featuredmedia&per_page=30');
                    const products = await searchRes.json();
                    
                    if (products && products.length > 0) {
                        const kw = searchKeyword.toLowerCase();
                        const hasYoyo = kw.includes("โยโย่") || kw.includes("yoyo");
                        const hasHolder = kw.includes("กรอบ") || kw.includes("ซอง") || kw.includes("cardholder") || kw.includes("ใส่บัตร") || kw.includes("ห้อยบัตร");
                        const hasCard = kw.includes("บัตร") || kw.includes("card") || kw.includes("pvc");
                        const hasLanyard = kw.includes("สาย") || kw.includes("สายคล้อง") || kw.includes("lanyard");
                        
                        let bestMatch = null;
                        let highestScore = -1;
                        
                        for (const product of products) {
                            const title = product.title.rendered.toLowerCase();
                            let score = 0;
                            
                            // Yoyo Match
                            const isProductYoyo = title.includes("โยโย่") || title.includes("yoyo");
                            if (hasYoyo && isProductYoyo) score += 15;
                            if (!hasYoyo && isProductYoyo) score -= 15; // Penalize yoyo if keyword doesn't ask for it
                            
                            // Holder Match
                            const isProductHolder = title.includes("กรอบ") || title.includes("ซอง") || title.includes("cardholder") || title.includes("ใส่บัตร");
                            if (hasHolder && isProductHolder) score += 15;
                            if (!hasHolder && isProductHolder) score -= 15;
                            
                            // Card Match
                            const isProductCard = (title.includes("บัตร") || title.includes("card")) && !isProductHolder && !isProductYoyo;
                            if (hasCard && isProductCard) score += 15;
                            if (!hasCard && isProductCard) score -= 15;
                            
                            // Lanyard Match
                            const isProductLanyard = title.includes("สาย") || title.includes("สายคล้อง") || title.includes("lanyard");
                            if (hasLanyard && isProductLanyard) score += 15;
                            if (!hasLanyard && isProductLanyard) score -= 15;
                            
                            // Exact word matches
                            if (kw.includes("บัตรพนักงาน") && title.includes("บัตรพนักงาน")) score += 20;
                            if (kw.includes("สายคล้องคอ") && title.includes("สายคล้องคอ")) score += 20;
                            if (kw.includes("บัตรพลาสติก") && title.includes("บัตรพลาสติก")) score += 20;
                            
                            if (score > highestScore) {
                                highestScore = score;
                                bestMatch = product;
                            }
                        }
                        
                        const selectedProduct = bestMatch || products[0];
                        if (selectedProduct.featured_media && selectedProduct._embedded && selectedProduct._embedded['wp:featuredmedia']) {
                            mediaId = selectedProduct.featured_media;
                            imageUrl = selectedProduct._embedded['wp:featuredmedia'][0].source_url;
                        }
                    }
                } catch(e) {
                    console.log("Error searching related image, using default");
                }
                
                const imageHtml = `<p style="text-align: center;"><img class="aligncenter size-large wp-image-${mediaId}" src="${imageUrl}" alt="${searchKeyword}" /></p>\n\n`;
                
                const finalContent = imageHtml + postContent;

                const response = await fetch('/wp-json/wp/v2/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': nonce
                    },
                    body: JSON.stringify({
                        title: postTitle,
                        content: finalContent,
                        status: 'publish',
                        featured_media: mediaId
                    })
                });
                
                const data = await response.json();
                if (!response.ok) {
                    return { error: data.message || "Failed to post" };
                }
                
                return { success: true, url: data.link, id: data.id };
            } catch(e) {
                return { error: e.toString() };
            }
        }, title, content, keyword);
        
        await browser.close();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        return result.url;
        
    } catch (error) {
        if (browser) await browser.close();
        console.error('Error posting to WordPress:', error);
        throw error;
    }
}

module.exports = { postToWordPress };
