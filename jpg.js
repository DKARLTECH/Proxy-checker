// cloudflare-worker-wallpaper-bot.js

const TELEGRAM_BOT_TOKEN = '8421978364:AAG6360iJQ-2Bn2No-48u8LI3hcGQnSZ2WU';
const TELEGRAM_CHANNEL_ID = '@wallpapers_webGram'; // Replace with your channel

const UNSPLASH_ACCESS_KEY = '6TCenRaAmPDFuoJkz1_jU4kxMLI0jkD6rBm2hkx_hQU';
const PEXELS_API_KEY = '3slUzL0PLhHNhwvIgTw3RbEQRy8n62wM7a5u0tHcZbGuZhcJt42NrJOj';

const CATEGORIES = [
    'nature', 'abstract', 'minimal', 'city', 'space',
    'car', 'anime', 'game', 'movie', 'art',
    'technology', 'architecture', 'wildlife', 'beach', 'mountain'
];

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
                const downloadUrl = data.urls.full;

                return {
                    image_url: wallpaperUrl,
                    download_url: downloadUrl,
                    caption: `🖼️ ${description}\n📷 Photo by ${photographer} on Unsplash\n#${category} #wallpaper #hd`,
                    source: 'Unsplash',
                    id: data.id,
                    photographer: photographer,
                    description: description
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
                    const wallpaperUrl = photo.src.large;
                    const downloadUrl = photo.src.original;
                    const photographer = photo.photographer;
                    const description = `${category.charAt(0).toUpperCase() + category.slice(1)} Wallpaper`;

                    return {
                        image_url: wallpaperUrl,
                        download_url: downloadUrl,
                        caption: `🖼️ ${description}\n📷 Photo by ${photographer} on Pexels\n#${category} #wallpaper #hd`,
                        source: 'Pexels',
                        id: `pexels_${photo.id}`,
                        photographer: photographer,
                        description: description
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
                return {
                    buffer: arrayBuffer,
                    size: arrayBuffer.byteLength,
                    filename: this.generateFilename(url)
                };
            }
        } catch (error) {
            console.error('Error downloading image:', error);
        }
        return null;
    }

    generateFilename(url) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        return `Wallpaper_${timestamp}_${randomId}.jpg`;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
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
}

class EnhancedWallpaperBot extends WallpaperBot {
    async postWallpaperAsThread() {
        console.log('🔄 Starting threaded wallpaper posting process...');

        await this.loadPostedWallpapers();

        const wallpaper = await this.getRandomWallpaper();
        
        if (!wallpaper) {
            console.error('❌ Could not fetch any wallpaper from APIs');
            return { success: false, error: 'No wallpaper found' };
        }

        if (await this.isWallpaperPosted(wallpaper.id)) {
            console.log(`🔄 Wallpaper ${wallpaper.id} already posted, skipping...`);
            return { success: false, error: 'Wallpaper already posted' };
        }

        console.log(`✅ Found wallpaper from ${wallpaper.source} - ID: ${wallpaper.id}`);

        // Download images
        const photoImageData = await this.downloadImage(wallpaper.image_url);
        const documentImageData = await this.downloadImage(wallpaper.download_url || wallpaper.image_url);
        
        if (!photoImageData || !documentImageData) {
            console.error('❌ Failed to download images');
            return { success: false, error: 'Image download failed' };
        }

        let photoMessageId = null;
        
        // 1. Post photo first
        try {
            const formData = new FormData();
            const blob = new Blob([photoImageData.buffer], { type: 'image/jpeg' });
            formData.append('photo', blob, photoImageData.filename);
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', wallpaper.caption);
            formData.append('parse_mode', 'HTML');

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.ok) {
                photoMessageId = result.result.message_id;
                console.log(`✅ Photo posted with message ID: ${photoMessageId}`);
            } else {
                console.error('Photo post failed:', result);
                throw new Error('Photo post failed');
            }
        } catch (error) {
            console.error('❌ Failed to post photo:', error);
            return { success: false, error: 'Photo post failed' };
        }

        // Wait before posting document
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. Post document as reply to photo
        let documentSuccess = false;
        let documentMessageId = null;
        try {
            const fileSize = this.formatFileSize(documentImageData.size);
            const documentCaption = `📄 ${documentImageData.filename}\n💾 ${fileSize} JPG\n\n⬇️ Download in full quality`;
            
            const formData = new FormData();
            const blob = new Blob([documentImageData.buffer], { type: 'image/jpeg' });
            formData.append('document', blob, documentImageData.filename);
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', documentCaption);
            formData.append('parse_mode', 'HTML');
            formData.append('reply_to_message_id', photoMessageId.toString());

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            documentSuccess = result.ok;
            if (result.ok) {
                documentMessageId = result.result.message_id;
            }
            console.log(`✅ Document posted as reply: ${documentSuccess}`);
        } catch (error) {
            console.error('❌ Failed to post document:', error);
        }

        // Wait before posting vibes message
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. Post vibes message as reply to document (or photo if document failed)
        let vibesSuccess = false;
        try {
            const vibesMessage = `✨ <b>WallpapersGram™ HD</b>\n\n🎯 <b>VIBES</b>\n\n💫 <i>Only Good Vibes</i>\n\n────────────\n\nJoin <b>WallpapersGram™ HD</b> for daily wallpapers! 🎨`;
            
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('text', vibesMessage);
            formData.append('parse_mode', 'HTML');
            
            // Reply to document if successful, otherwise reply to photo
            const replyToMessageId = documentMessageId || photoMessageId;
            if (replyToMessageId) {
                formData.append('reply_to_message_id', replyToMessageId.toString());
            }

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            vibesSuccess = result.ok;
            console.log(`✅ Vibes message posted: ${vibesSuccess}`);
        } catch (error) {
            console.error('❌ Failed to post vibes message:', error);
        }

        // Mark as posted
        await this.markWallpaperPosted(wallpaper.id);
        
        console.log(`✅ Successfully posted wallpaper from ${wallpaper.source}`);
        return { 
            success: true, 
            source: wallpaper.source, 
            id: wallpaper.id,
            posted_photo: true,
            posted_document: documentSuccess,
            posted_vibes: vibesSuccess,
            thread_start_id: photoMessageId
        };
    }

    // Fallback method without threading
    async postWallpaperSimple() {
        console.log('🔄 Starting simple wallpaper posting process...');

        await this.loadPostedWallpapers();

        const wallpaper = await this.getRandomWallpaper();
        
        if (!wallpaper) {
            console.error('❌ Could not fetch any wallpaper from APIs');
            return { success: false, error: 'No wallpaper found' };
        }

        if (await this.isWallpaperPosted(wallpaper.id)) {
            console.log(`🔄 Wallpaper ${wallpaper.id} already posted, skipping...`);
            return { success: false, error: 'Wallpaper already posted' };
        }

        console.log(`✅ Found wallpaper from ${wallpaper.source} - ID: ${wallpaper.id}`);

        // Download images
        const photoImageData = await this.downloadImage(wallpaper.image_url);
        const documentImageData = await this.downloadImage(wallpaper.download_url || wallpaper.image_url);
        
        if (!photoImageData || !documentImageData) {
            console.error('❌ Failed to download images');
            return { success: false, error: 'Image download failed' };
        }

        // Post photo
        let photoSuccess = false;
        try {
            const formData = new FormData();
            const blob = new Blob([photoImageData.buffer], { type: 'image/jpeg' });
            formData.append('photo', blob, photoImageData.filename);
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', wallpaper.caption);
            formData.append('parse_mode', 'HTML');

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            photoSuccess = result.ok;
            console.log(`✅ Photo posted: ${photoSuccess}`);
        } catch (error) {
            console.error('❌ Failed to post photo:', error);
        }

        // Wait before posting document
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Post document
        let documentSuccess = false;
        try {
            const fileSize = this.formatFileSize(documentImageData.size);
            const documentCaption = `📄 ${documentImageData.filename}\n💾 ${fileSize} JPG\n\n⬇️ Download in full quality`;
            
            const formData = new FormData();
            const blob = new Blob([documentImageData.buffer], { type: 'image/jpeg' });
            formData.append('document', blob, documentImageData.filename);
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', documentCaption);
            formData.append('parse_mode', 'HTML');

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            documentSuccess = result.ok;
            console.log(`✅ Document posted: ${documentSuccess}`);
        } catch (error) {
            console.error('❌ Failed to post document:', error);
        }

        // Wait before posting vibes message
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Post vibes message
        let vibesSuccess = false;
        try {
            const vibesMessage = `✨ <b>WallpapersGram™ HD</b>\n\n🎯 <b>VIBES</b>\n\n💫 <i>Only Good Vibes</i>\n\n────────────\n\nJoin <b>WallpapersGram™ HD</b> for daily wallpapers! 🎨`;
            
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('text', vibesMessage);
            formData.append('parse_mode', 'HTML');

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            vibesSuccess = result.ok;
            console.log(`✅ Vibes message posted: ${vibesSuccess}`);
        } catch (error) {
            console.error('❌ Failed to post vibes message:', error);
        }

        // Mark as posted
        await this.markWallpaperPosted(wallpaper.id);
        
        return { 
            success: photoSuccess || documentSuccess,
            source: wallpaper.source, 
            id: wallpaper.id,
            posted_photo: photoSuccess,
            posted_document: documentSuccess,
            posted_vibes: vibesSuccess
        };
    }
}

// Main worker handler
export default {
    async scheduled(event, env, ctx) {
        globalThis.WALLPAPER_BOT = env.WALLPAPER_BOT;
        const bot = new EnhancedWallpaperBot();
        const result = await bot.postWallpaperAsThread();
        
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

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // Store KV namespace
        globalThis.WALLPAPER_BOT = env.WALLPAPER_BOT;
        
        const bot = new EnhancedWallpaperBot();

        if (path === '/post' || path === '/') {
            const result = await bot.postWallpaperAsThread();
            
            return new Response(JSON.stringify({
                success: result.success,
                message: result.success ? 
                    `✅ Wallpaper posted successfully from ${result.source}` : 
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
            const wallpaper = await bot.getRandomWallpaper();
            
            return new Response(JSON.stringify({
                apis_working: !!wallpaper,
                wallpaper: wallpaper ? {
                    source: wallpaper.source,
                    id: wallpaper.id,
                    image_url: wallpaper.image_url,
                    download_url: wallpaper.download_url,
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
            
        } else if (path === '/simple') {
            const result = await bot.postWallpaperSimple();
            
            return new Response(JSON.stringify({
                success: result.success,
                message: result.success ? 
                    `✅ Simple wallpaper posted from ${result.source}` : 
                    `❌ Failed to post wallpaper: ${result.error}`,
                data: result,
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