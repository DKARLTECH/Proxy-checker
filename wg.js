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
                const downloadUrl = data.urls.full; // Higher quality for file download

                return {
                    image_url: wallpaperUrl,
                    download_url: downloadUrl,
                    caption: `馃摳 ${description}\n馃懁 Photo by ${photographer} on Unsplash\n#${category} #wallpaper #hd`,
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
                        caption: `馃摳 ${description}\n馃懁 Photo by ${photographer} on Pexels\n#${category} #wallpaper #hd`,
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

    async postPhotoToTelegram(imageData, caption) {
        try {
            const formData = new FormData();
            const blob = new Blob([imageData.buffer], { type: 'image/jpeg' });
            formData.append('photo', blob, imageData.filename);
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            return result.ok;
        } catch (error) {
            console.error('Error posting photo to Telegram:', error);
            return false;
        }
    }

    async postDocumentToTelegram(imageData, wallpaper, photoMessageId = null) {
        try {
            const fileSize = this.formatFileSize(imageData.size);
            const documentCaption = `馃搧 ${imageData.filename}\n馃捑 ${fileSize} JPG\n\n猬囷笍 Download in full quality`;
            
            const formData = new FormData();
            const blob = new Blob([imageData.buffer], { type: 'image/jpeg' });
            formData.append('document', blob, imageData.filename);
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('caption', documentCaption);
            formData.append('parse_mode', 'HTML');
            
            // If we have a photo message ID, reply to it
            if (photoMessageId) {
                formData.append('reply_to_message_id', photoMessageId.toString());
            }

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            return result.ok;
        } catch (error) {
            console.error('Error posting document to Telegram:', error);
            return false;
        }
    }

    async sendVibesMessage(photoMessageId = null) {
        try {
            const vibesMessage = `鉁� <b>WallpapersGram鈩� HD</b>\n\n馃幆 <b>VIBES</b>\n\n馃挮 <i>Only Good Vibes</i>`;
            
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('text', vibesMessage);
            formData.append('parse_mode', 'HTML');
            
            if (photoMessageId) {
                formData.append('reply_to_message_id', photoMessageId.toString());
            }

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            return result.ok ? result.result.message_id : null;
        } catch (error) {
            console.error('Error sending vibes message:', error);
            return null;
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
        console.log('馃攧 Starting wallpaper posting process...');

        // Load previously posted wallpapers
        await this.loadPostedWallpapers();

        const wallpaper = await this.getRandomWallpaper();
        
        if (!wallpaper) {
            console.error('鉂� Could not fetch any wallpaper from APIs');
            return { success: false, error: 'No wallpaper found' };
        }

        console.log(`鉁� Found wallpaper from ${wallpaper.source} - ID: ${wallpaper.id}`);

        // Check if already posted
        if (await this.isWallpaperPosted(wallpaper.id)) {
            console.log(`馃攧 Wallpaper ${wallpaper.id} already posted, skipping...`);
            return { success: false, error: 'Wallpaper already posted' };
        }

        // Download image for photo (optimized version)
        const photoImageData = await this.downloadImage(wallpaper.image_url);
        if (!photoImageData) {
            console.error('鉂� Failed to download photo image');
            return { success: false, error: 'Image download failed' };
        }

        // Download image for document (higher quality)
        const documentImageData = await this.downloadImage(wallpaper.download_url || wallpaper.image_url);
        if (!documentImageData) {
            console.error('鉂� Failed to download document image');
            return { success: false, error: 'Document image download failed' };
        }

        // Post photo to Telegram
        const photoSuccess = await this.postPhotoToTelegram(photoImageData, wallpaper.caption);
        
        if (!photoSuccess) {
            console.error('鉂� Failed to post photo to Telegram');
            return { success: false, error: 'Telegram photo post failed' };
        }

        // Get the last message ID (this would be the photo message)
        // Note: In a real implementation, you might want to use webhooks to get the actual message ID
        // For now, we'll post the document as a separate message
        
        // Wait a bit before posting document
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Post document (file) to Telegram
        const documentSuccess = await this.postDocumentToTelegram(documentImageData, wallpaper);
        
        if (!documentSuccess) {
            console.error('鉂� Failed to post document to Telegram');
            // Continue anyway as the photo was posted successfully
        }

        // Wait a bit before posting vibes message
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Post vibes message
        const vibesSuccess = await this.sendVibesMessage();
        
        if (vibesSuccess) {
            console.log('鉁� Vibes message posted successfully');
        }

        // Mark as posted
        await this.markWallpaperPosted(wallpaper.id);
        
        console.log(`鉁� Successfully posted wallpaper from ${wallpaper.source}`);
        return { 
            success: true, 
            source: wallpaper.source, 
            id: wallpaper.id,
            category: wallpaper.caption.match(/#(\w+)/)?.[1] || 'unknown',
            posted_photo: true,
            posted_document: documentSuccess,
            posted_vibes: !!vibesSuccess
        };
    }
}

// Enhanced version with message threading
class EnhancedWallpaperBot extends WallpaperBot {
    async postWallpaperAsThread() {
        console.log('馃攧 Starting threaded wallpaper posting process...');

        await this.loadPostedWallpapers();

        const wallpaper = await this.getRandomWallpaper();
        
        if (!wallpaper) {
            console.error('鉂� Could not fetch any wallpaper from APIs');
            return { success: false, error: 'No wallpaper found' };
        }

        if (await this.isWallpaperPosted(wallpaper.id)) {
            console.log(`馃攧 Wallpaper ${wallpaper.id} already posted, skipping...`);
            return { success: false, error: 'Wallpaper already posted' };
        }

        console.log(`鉁� Found wallpaper from ${wallpaper.source} - ID: ${wallpaper.id}`);

        // Download images
        const photoImageData = await this.downloadImage(wallpaper.image_url);
        const documentImageData = await this.downloadImage(wallpaper.download_url || wallpaper.image_url);
        
        if (!photoImageData || !documentImageData) {
            console.error('鉂� Failed to download images');
            return { success: false, error: 'Image download failed' };
        }

        let photoMessageId = null;
        
        // Post photo first
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
                console.log(`鉁� Photo posted with message ID: ${photoMessageId}`);
            } else {
                throw new Error('Photo post failed');
            }
        } catch (error) {
            console.error('鉂� Failed to post photo:', error);
            return { success: false, error: 'Photo post failed' };
        }

        // Post document as reply to photo
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        let documentSuccess = false;
        try {
            const fileSize = this.formatFileSize(documentImageData.size);
            const documentCaption = `馃搧 ${documentImageData.filename}\n馃捑 ${fileSize} JPG\n\n猬囷笍 Download in full quality`;
            
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
            console.log(`鉁� Document posted as reply: ${documentSuccess}`);
        } catch (error) {
            console.error('鉂� Failed to post document:', error);
        }

        // Post vibes message as reply to document
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        let vibesSuccess = false;
        try {
            const vibesMessage = `鉁� <b>WallpapersGram鈩� HD</b>\n\n馃幆 <b>VIBES</b>\n\n馃挮 <i>Only Good Vibes</i>\n\n鈹€ 鈹€ 鈹€\n\nJoin <b>WallpapersGram鈩� HD</b> for daily wallpapers! 馃帹`;
            
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            formData.append('text', vibesMessage);
            formData.append('parse_mode', 'HTML');
            formData.append('reply_to_message_id', photoMessageId.toString());

            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            vibesSuccess = result.ok;
            console.log(`鉁� Vibes message posted: ${vibesSuccess}`);
        } catch (error) {
            console.error('鉂� Failed to post vibes message:', error);
        }

        // Mark as posted
        await this.markWallpaperPosted(wallpaper.id);
        
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
}

// Scheduled trigger (runs every 6 hours)
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

    // HTTP trigger for manual posting
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // Store KV namespace
        globalThis.WALLPAPER_BOT = env.WALLPAPER_BOT;
        
        const bot = new EnhancedWallpaperBot();

        if (path === '/post' || path === '/') {
            // Manual post endpoint
            const result = await bot.postWallpaperAsThread();
            
            return new Response(JSON.stringify({
                success: result.success,
                message: result.success ? 
                    `鉁� Wallpaper posted successfully from ${result.source}` : 
                    `鉂� Failed to post wallpaper: ${result.error}`,
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
            
        } else if (path === '/simple') {
            // Simple post without threading (fallback)
            const result = await bot.postWallpaper();
            
            return new Response(JSON.stringify({
                success: result.success,
                message: result.success ? 
                    `鉁� Simple wallpaper posted from ${result.source}` : 
                    `鉂� Failed to post wallpaper: ${result.error}`,
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