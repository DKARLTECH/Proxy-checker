// cloudflare-worker-wallpaper-bot.js

const TELEGRAM_BOT_TOKEN = '8421978364:AAG6360iJQ-2Bn2No-48u8LI3hcGQnSZ2WU';
const TELEGRAM_CHANNEL_ID = '@wallpapers_3DHD'; // Replace with your channel

const UNSPLASH_ACCESS_KEY = '6TCenRaAmPDFuoJkz1_jU4kxMLI0jkD6rBm2hkx_hQU';
const PEXELS_API_KEY = '3slUzL0PLhHNhwvIgTw3RbEQRy8n62wM7a5u0tHcZbGuZhcJt42NrJOj';

const CATEGORIES = [
    'nature', 'abstract', 'minimal', 'city', 'space',
    'car', 'anime', 'game', 'movie', 'art',
    'technology', 'architecture', 'wildlife', 'beach', 'mountain'
];

// KV namespace for storing posted wallpaper IDs
// You need to create a KV namespace called "WALLPAPER_BOT" in your Cloudflare dashboard

class WallpaperBot {
    constructor() {
        this.postedWallpapers = new Set();
    }

    async fetchWithTimeout(url, options = {}, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async getRandomCategory() {
        return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    }

    async getWallpaperFromUnsplash() {
        try {
            const category = await this.getRandomCategory();
            const url = new URL('https://api.unsplash.com/photos/random');
            url.searchParams.set('query', `${category} wallpaper`);
            url.searchParams.set('orientation', 'landscape');
            url.searchParams.set('content_filter', 'high');

            console.log(`Fetching from Unsplash - Category: ${category}`);

            const response = await this.fetchWithTimeout(url.toString(), {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
                    'Accept-Version': 'v1'
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                const wallpaperUrl = data.urls.regular;
                const photographer = data.user.name;
                const description = data.description || `${category.charAt(0).toUpperCase() + category.slice(1)} Wallpaper`;

                return {
                    image_url: wallpaperUrl,
                    caption: `📸 ${description}\n👤 Photo by ${photographer} on Unsplash\n#${category} #wallpaper #hd`,
                    source: 'Unsplash',
                    id: data.id
                };
            } else {
                console.error(`Unsplash API error: ${response.status} - ${await response.text()}`);
            }
        } catch (error) {
            console.error('Error fetching from Unsplash:', error);
        }
        return null;
    }

    async getWallpaperFromPexels() {
        try {
            const category = await this.getRandomCategory();
            const page = Math.floor(Math.random() * 50) + 1;
            const url = new URL('https://api.pexels.com/v1/search');
            url.searchParams.set('query', `${category} wallpaper`);
            url.searchParams.set('orientation', 'landscape');
            url.searchParams.set('per_page', '1');
            url.searchParams.set('page', page.toString());

            console.log(`Fetching from Pexels - Category: ${category}, Page: ${page}`);

            const response = await this.fetchWithTimeout(url.toString(), {
                headers: {
                    'Authorization': PEXELS_API_KEY
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                if (data.photos && data.photos.length > 0) {
                    const photo = data.photos[0];
                    const wallpaperUrl = photo.src.original;
                    const photographer = photo.photographer;
                    const description = `${category.charAt(0).toUpperCase() + category.slice(1)} Wallpaper`;

                    return {
                        image_url: wallpaperUrl,
                        caption: `📸 ${description}\n👤 Photo by ${photographer} on Pexels\n#${category} #wallpaper #hd`,
                        source: 'Pexels',
                        id: `pexels_${photo.id}`
                    };
                }
            } else {
                console.error(`Pexels API error: ${response.status} - ${await response.text()}`);
            }
        } catch (error) {
            console.error('Error fetching from Pexels:', error);
        }
        return null;
    }

    async getRandomWallpaper() {
        const sources = [this.getWallpaperFromUnsplash, this.getWallpaperFromPexels];
        // Shuffle sources
        for (let i = sources.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sources[i], sources[j]] = [sources[j], sources[i]];
        }

        for (const sourceFunc of sources) {
            const wallpaper = await sourceFunc.call(this);
            if (wallpaper) {
                return wallpaper;
            }
        }
        return null;
    }

    async downloadImage(url) {
        try {
            console.log(`Downloading image from: ${url}`);
            const response = await this.fetchWithTimeout(url);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                console.log(`Image downloaded successfully, size: ${arrayBuffer.byteLength} bytes`);
                return arrayBuffer;
            }
        } catch (error) {
            console.error('Error downloading image:', error);
        }
        return null;
    }

    async postToTelegram(imageBuffer, caption) {
        try {
            // Convert ArrayBuffer to base64 for Telegram API
            const base64Image = btoa(
                new Uint8Array(imageBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                )
            );

            const formData = new FormData();
            const blob = new Blob([imageBuffer]);
            formData.append('photo', blob, 'wallpaper.jpg');
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.ok) {
                console.log('✅ Wallpaper posted successfully to Telegram!');
                return true;
            } else {
                console.error('❌ Telegram API error:', result);
                return false;
            }
        } catch (error) {
            console.error('Error posting to Telegram:', error);
            return false;
        }
    }

    async loadPostedWallpapers() {
        try {
            const posted = await WALLPAPER_BOT.get('posted_wallpapers');
            if (posted) {
                this.postedWallpapers = new Set(JSON.parse(posted));
                console.log(`Loaded ${this.postedWallpapers.size} previously posted wallpapers`);
            }
        } catch (error) {
            console.error('Error loading posted wallpapers:', error);
            this.postedWallpapers = new Set();
        }
    }

    async savePostedWallpapers() {
        try {
            await WALLPAPER_BOT.put('posted_wallpapers', JSON.stringify([...this.postedWallpapers]));
            console.log(`Saved ${this.postedWallpapers.size} posted wallpapers`);
        } catch (error) {
            console.error('Error saving posted wallpapers:', error);
        }
    }

    async isWallpaperPosted(wallpaperId) {
        return this.postedWallpapers.has(wallpaperId);
    }

    async markWallpaperPosted(wallpaperId) {
        this.postedWallpapers.add(wallpaperId);
        await this.savePostedWallpapers();
    }

    async postWallpaper() {
        console.log('🔄 Starting wallpaper posting process...');

        // Load previously posted wallpapers
        await this.loadPostedWallpapers();

        const wallpaper = await this.getRandomWallpaper();
        
        if (!wallpaper) {
            console.error('❌ Could not fetch any wallpaper from APIs');
            return { success: false, error: 'No wallpaper found' };
        }

        console.log(`✅ Found wallpaper from ${wallpaper.source} - ID: ${wallpaper.id}`);

        // Check if already posted
        if (await this.isWallpaperPosted(wallpaper.id)) {
            console.log(`🔄 Wallpaper ${wallpaper.id} already posted, skipping...`);
            return { success: false, error: 'Wallpaper already posted' };
        }

        // Download image
        const imageBuffer = await this.downloadImage(wallpaper.image_url);
        if (!imageBuffer) {
            console.error('❌ Failed to download image');
            return { success: false, error: 'Image download failed' };
        }

        // Post to Telegram
        const postSuccess = await this.postToTelegram(imageBuffer, wallpaper.caption);
        
        if (postSuccess) {
            // Mark as posted
            await this.markWallpaperPosted(wallpaper.id);
            console.log(`✅ Successfully posted wallpaper from ${wallpaper.source}`);
            return { 
                success: true, 
                source: wallpaper.source, 
                id: wallpaper.id,
                category: wallpaper.caption.match(/#(\w+)/)?.[1] || 'unknown'
            };
        } else {
            console.error('❌ Failed to post wallpaper to Telegram');
            return { success: false, error: 'Telegram post failed' };
        }
    }
}

// Scheduled trigger (runs every 6 hours)
export default {
    async scheduled(event, env, ctx) {
        const bot = new WallpaperBot();
        const result = await bot.postWallpaper();
        
        return new Response(JSON.stringify({
            success: result.success,
            message: result.success ? 
                `Wallpaper posted successfully from ${result.source}` : 
                `Failed to post wallpaper: ${result.error}`,
            timestamp: new Date().toISOString()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    },

    // HTTP trigger for manual posting
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // Store KV namespace
        globalThis.WALLPAPER_BOT = env.WALLPAPER_BOT;
        
        const bot = new WallpaperBot();

        if (path === '/post' || path === '/') {
            // Manual post endpoint
            const result = await bot.postWallpaper();
            
            return new Response(JSON.stringify({
                success: result.success,
                message: result.success ? 
                    `✅ Wallpaper posted successfully from ${result.source} (ID: ${result.id})` : 
                    `❌ Failed to post wallpaper: ${result.error}`,
                data: result,
                timestamp: new Date().toISOString()
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
            
        } else if (path === '/test') {
            // Test endpoint to check APIs
            const wallpaper = await bot.getRandomWallpaper();
            
            return new Response(JSON.stringify({
                apis_working: !!wallpaper,
                wallpaper: wallpaper ? {
                    source: wallpaper.source,
                    id: wallpaper.id,
                    image_url: wallpaper.image_url,
                    caption: wallpaper.caption
                } : null,
                timestamp: new Date().toISOString()
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
            
        } else if (path === '/status') {
            // Status endpoint
            await bot.loadPostedWallpapers();
            
            return new Response(JSON.stringify({
                status: 'online',
                posted_count: bot.postedWallpapers.size,
                timestamp: new Date().toISOString()
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        return new Response('Not Found', { status: 404 });
    }
};