/**
 * modules/internal_linker.js
 * Handles Internal Linking, Content Dedup, and WordPress Taxonomy
 */

/**
 * Searches existing published WordPress posts to find relevant internal link candidates.
 * Returns an array of { id, title, link }
 */
async function findRelatedPosts(keyword, wpUrl, currentPostTitle = '') {
    if (!wpUrl) return [];
    try {
        const baseUrl = wpUrl.replace(/\/wp-admin\/?$/, '').replace(/\/$/, '');
        
        // Clean keyword to extract core terms (e.g., 'สายคล้องคอ', 'บัตรพนักงาน')
        const searchTerms = keyword.replace(/(เชียงใหม่|ขอนแก่น|ภูเก็ต|ชลบุรี|สงขลา|โคราช|กรุงเทพ|ใกล้ฉัน|ราคาถูก|ที่ไหนดี)/g, '').trim() || keyword;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchTerms)}&per_page=6&status=publish`, {
            headers: { 'User-Agent': 'VSEOBot/1.0' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) return [];

        const posts = await res.json();
        if (!Array.isArray(posts)) return [];

        const currentNormalized = currentPostTitle.replace(/<[^>]*>/g, '').toLowerCase().trim();

        // Filter out current post if matching
        const related = posts
            .filter(p => {
                const titleText = (p.title?.rendered || '').replace(/<[^>]*>/g, '').toLowerCase().trim();
                return titleText && titleText !== currentNormalized;
            })
            .map(p => ({
                id: p.id,
                title: (p.title?.rendered || '').replace(/<[^>]*>/g, '').trim(),
                link: p.link
            }))
            .slice(0, 3);

        return related;
    } catch (err) {
        // Safe fallback - network, DNS, or timeout shouldn't crash article publishing
        console.log(`[InternalLinker] Note: Could not fetch related posts (${err.message}). Skipping internal links.`);
        return [];
    }
}

/**
 * Builds a styled HTML block for related internal posts
 */
function buildRelatedPostsHtml(relatedPosts) {
    if (!relatedPosts || relatedPosts.length === 0) return '';

    let html = `\n<div class="vsuccess-related-articles" style="margin: 28px 0; padding: 18px 24px; background: #f8fafc; border-left: 4px solid #0056b3; border-radius: 6px;">\n`;
    html += `  <h3 style="margin-top: 0; margin-bottom: 12px; color: #0056b3; font-size: 1.15rem;">📌 บริการและบทความที่เกี่ยวข้องจาก V-Success Printing</h3>\n`;
    html += `  <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">\n`;
    
    for (const post of relatedPosts) {
        html += `    <li><a href="${post.link}" title="${post.title}" style="color: #0f172a; text-decoration: underline; font-weight: 500;">${post.title}</a></li>\n`;
    }
    
    html += `  </ul>\n</div>\n`;
    return html;
}

/**
 * Checks whether a keyword or topic has already been published recently
 * to prevent keyword cannibalization and duplicated content.
 */
async function isDuplicateKeyword(keyword, wpUrl) {
    if (!wpUrl) return false;
    try {
        const baseUrl = wpUrl.replace(/\/wp-admin\/?$/, '').replace(/\/$/, '');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts?search=${encodeURIComponent(keyword)}&per_page=3&status=publish`, {
            headers: { 'User-Agent': 'VSEOBot/1.0' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) return false;

        const posts = await res.json();
        if (!Array.isArray(posts) || posts.length === 0) return false;

        const cleanKeyword = keyword.toLowerCase().trim();
        return posts.some(p => {
            const title = (p.title?.rendered || '').toLowerCase().replace(/<[^>]*>/g, '').trim();
            return title.includes(cleanKeyword) && title.length < cleanKeyword.length + 15;
        });
    } catch (_) {
        return false;
    }
}

module.exports = {
    findRelatedPosts,
    buildRelatedPostsHtml,
    isDuplicateKeyword
};
