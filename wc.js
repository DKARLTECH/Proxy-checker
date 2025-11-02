// cloudflare-worker-wallpaper-bot.js

const TELEGRAM_BOT_TOKEN = '8421978364:AAG6360iJQ-2Bn2No-48u8LI3hcGQnSZ2WU';
const TELEGRAM_CHANNEL_ID = '@your_channel_username';

const UNSPLASH_ACCESS_KEY = '6TCenRaAmPDFuoJkz1_jU4kxMLI0jkD6rBm2hkx_hQU';
const PEXELS_API_KEY = '3slUzL0PLhHNhwvIgTw3RbEQRy8n62wM7a5u0tHcZbGuZhcJt42NrJOj';

const CATEGORIES = [
    'nature', 'abstract', 'minimal', 'city', 'space',
    'car', 'anime', 'game', 'movie', 'art',
    'technology', 'architecture', 'wildlife', 'beach', 'mountain'
];

// ... (Keep all the previous WallpaperBot class code exactly the same) ...

// Webhook handler
async function handleWebhook(request, env) {
    try {
        const update = await request.json();
        console.log('Webhook received:', JSON.stringify(update));
        
        // Handle different types of updates
        if (update.message) {
            await handleMessage(update.message);
        } else if (update.channel_post) {
            await handleChannelPost(update.channel_post);
        }
        
        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error', { status: 500 });
    }
}

async function handleMessage(message) {
    // Handle direct messages to the bot
    const chatId = message.chat.id;
    const text = message.text || '';
    
    if (text.startsWith('/')) {
        await handleCommand(text, chatId);
    }
}

async function handleChannelPost(channelPost) {
    // Handle channel posts if needed
    console.log('Channel post received:', channelPost);
}

async function handleCommand(command, chatId) {
    const bot = new EnhancedWallpaperBot();
    
    switch (command) {
        case '/start':
            await sendMessage(chatId, '🤖 <b>WallpapersGram Bot</b>\n\nUse /post to post a wallpaper manually\nUse /status to check bot status');
            break;
            
        case '/post':
            await sendMessage(chatId, '🔄 Posting wallpaper...');
            const result = await bot.postWallpaperAsThread();
            if (result.success) {
                await sendMessage(chatId, `✅ Wallpaper posted successfully from ${result.source}`);
            } else {
                await sendMessage(chatId, `❌ Failed to post: ${result.error}`);
            }
            break;
            
        case '/status':
            await bot.loadPostedWallpapers();
            await sendMessage(chatId, `📊 <b>Bot Status</b>\n\n✅ Online\n📨 Posted: ${bot.postedWallpapers.size} wallpapers\n⏰ Last check: ${new Date().toLocaleString()}`);
            break;
            
        case '/test':
            const wallpaper = await bot.getRandomWallpaper();
            if (wallpaper) {
                await sendMessage(chatId, `✅ APIs working! Found wallpaper from ${wallpaper.source}`);
            } else {
                await sendMessage(chatId, '❌ API test failed');
            }
            break;
            
        default:
            await sendMessage(chatId, '❌ Unknown command. Available: /start, /post, /status, /test');
    }
}

async function sendMessage(chatId, text) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Error sending message:', error);
        return false;
    }
}

// Enhanced fetch handler with webhook support
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
        
        // Handle webhook requests (POST to /webhook)
        if (request.method === 'POST' && path === '/webhook') {
            return await handleWebhook(request, env);
        }
        
        const bot = new EnhancedWallpaperBot();

        if (path === '/post' || path === '/') {
            // Manual post endpoint
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
            
        } else if (path === '/setwebhook') {
            // Easy webhook setup endpoint
            const webhookUrl = `${url.origin}/webhook`;
            const setupResult = await setupWebhook(webhookUrl);
            
            return new Response(JSON.stringify({
                success: setupResult.ok,
                url: webhookUrl,
                result: setupResult
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
            
        } else if (path === '/deletewebhook') {
            // Remove webhook
            const deleteResult = await deleteWebhook();
            
            return new Response(JSON.stringify({
                success: deleteResult.ok,
                result: deleteResult
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
                timestamp: new Date().toISOString(),
                endpoints: {
                    webhook: `${url.origin}/webhook`,
                    post: `${url.origin}/post`,
                    setwebhook: `${url.origin}/setwebhook`,
                    test: `${url.origin}/test`
                }
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

// Webhook management functions
async function setupWebhook(webhookUrl) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ['message', 'channel_post'],
                drop_pending_updates: true
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error setting webhook:', error);
        return { ok: false, error: error.message };
    }
}

async function deleteWebhook() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                drop_pending_updates: true
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error deleting webhook:', error);
        return { ok: false, error: error.message };
    }
}

async function getWebhookInfo() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
        return await response.json();
    } catch (error) {
        console.error('Error getting webhook info:', error);
        return { ok: false, error: error.message };
    }
}