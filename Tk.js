// complete-enhanced-tiktok-bot.js
const BOT_TOKEN = '7725259368:AAE2eNXZTdGBsWxpqcQUm19oy95R28Z7ces';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const TIKTOK_APIS = [
    'https://www.tikwm.com/api/',
    'https://tikdown.org/api/', 
    'https://tikmate.online/api/',
    'https://api.tiklydown.com/api/'
];

// Storage for rate limiting and statistics
const userRequests = new Map();
const userHistory = new Map();
let totalDownloads = 0;
const botStartTime = Date.now();

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    if (request.method === 'POST') {
        try {
            const update = await request.json();
            return await handleUpdate(update);
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // Return basic info for GET requests
    return new Response(JSON.stringify({
        status: 'online',
        name: 'TikTok Downloader Bot',
        total_downloads: totalDownloads,
        uptime: Math.floor((Date.now() - botStartTime) / 1000)
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function handleUpdate(update) {
    if (!update.message) return new Response('OK');

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || '';
    const userId = message.from.id;

    // Rate limiting
    if (!checkRateLimit(userId)) {
        await sendMessage(chatId, '⚠️ *Too many requests!*\nPlease wait 1 minute before trying again.', true);
        return new Response('OK');
    }

    try {
        if (text.startsWith('/start')) {
            await showStartMenu(chatId);
        }
        else if (text.startsWith('/help')) {
            await showHelp(chatId);
        }
        else if (text.startsWith('/stats')) {
            await showStats(chatId, userId);
        }
        else if (text.startsWith('/history')) {
            await showHistory(chatId, userId);
        }
        else if (text.startsWith('/about')) {
            await showAbout(chatId);
        }
        else if (isTikTokUrl(text)) {
            await processTikTokUrl(chatId, userId, text);
        }
        else {
            await sendMessage(chatId, 
                '❌ *Invalid input!*\n\nPlease send a valid TikTok URL or use /help for instructions.',
                true
            );
        }
    } catch (error) {
        console.error('Error:', error);
        await sendMessage(chatId, 
            '❌ *An unexpected error occurred!*\nPlease try again in a few moments.', 
            true
        );
    }

    return new Response('OK');
}

function checkRateLimit(userId) {
    const now = Date.now();
    const userData = userRequests.get(userId) || { 
        count: 0, 
        firstRequest: now,
        lastRequest: now
    };
    
    // Reset counter if more than 1 minute passed
    if (now - userData.firstRequest > 60000) {
        userData.count = 0;
        userData.firstRequest = now;
    }
    
    // Allow max 10 requests per minute
    if (userData.count >= 10) {
        return false;
    }
    
    userData.count++;
    userData.lastRequest = now;
    userRequests.set(userId, userData);
    return true;
}

function updateUserHistory(userId, url, success = true) {
    if (!userHistory.has(userId)) {
        userHistory.set(userId, []);
    }
    
    const history = userHistory.get(userId);
    history.unshift({
        url: url,
        timestamp: Date.now(),
        success: success
    });
    
    // Keep only last 20 history items
    if (history.length > 20) {
        history.pop();
    }
    
    userHistory.set(userId, history);
}

async function showStartMenu(chatId) {
    const welcomeText = `
🎬 *TikTok Video Downloader Bot* 🎬

*I can download TikTok videos without watermarks!*

✨ *Features:*
• 🚫 No watermark videos
• 📹 HD quality
• ⚡ Fast processing
• 📊 Download history
• 🔒 Rate limiting
• 📈 Usage statistics

📝 *How to use:*
1. Copy TikTok video URL
2. Paste it here
3. Get your video!

🔗 *Supported URLs:*
• https://vm.tiktok.com/...
• https://www.tiktok.com/.../video/...
• https://tiktok.com/t/...

⚡ *Commands:*
/start - Show this welcome message
/help - Detailed instructions
/stats - Your usage statistics
/history - Your download history
/about - About this bot

*Try it now by sending a TikTok link!* 👇
    `.trim();

    await sendMessage(chatId, welcomeText, true);
}

async function showHelp(chatId) {
    const helpText = `
📖 *TikTok Downloader Bot - Help Guide*

🔍 *How to Get TikTok Video Links:*

1. *In TikTok App:*
   • Open the video you want to download
   • Tap the *"Share"* button (➤)
   • Tap *"Copy Link"*

2. *In TikTok Web:*
   • Copy the URL from your browser address bar

🔄 *Download Process:*
   • Send the copied TikTok URL to this bot
   • Wait a few seconds for processing
   • Receive your downloaded video without watermark!

🔗 *Supported URL Formats:*
• *Short URLs:* https://vm.tiktok.com/ABC123/
• *User Videos:* https://www.tiktok.com/@username/video/123456789
• *TikTok Links:* https://tiktok.com/t/abcdef123/

⚡ *Available Commands:*
/start - Show welcome message and features
/help - Show this detailed help guide
/stats - View your personal usage statistics
/history - View your recent download history
/about - Information about this bot

⚠️ *Important Notes:*
• Please respect creators' content rights
• Only download videos you have permission to save
• Maximum 10 downloads per minute per user
• Videos are processed through multiple reliable APIs

*Need more help? Just send me a TikTok link to test!* 🎯
    `.trim();

    await sendMessage(chatId, helpText, true);
}

async function showStats(chatId, userId) {
    const userData = userRequests.get(userId) || { count: 0, firstRequest: Date.now() };
    const userHistoryData = userHistory.get(userId) || [];
    
    const successfulDownloads = userHistoryData.filter(item => item.success).length;
    const totalUserDownloads = userHistoryData.length;
    
    const uptimeSeconds = Math.floor((Date.now() - botStartTime) / 1000);
    const uptimeString = formatUptime(uptimeSeconds);
    
    const statsText = `
📊 *Your Statistics*

👤 *Personal Stats:*
• 📥 Total Downloads: ${totalUserDownloads}
• ✅ Successful: ${successfulDownloads}
• 🔄 Requests This Minute: ${userData.count}/10

🌐 *Global Bot Stats:*
• 👥 Total Users: ${userRequests.size}
• 📥 Total Downloads: ${totalDownloads}
• ⏰ Uptime: ${uptimeString}

⚡ *Rate Limits:*
• 10 downloads per minute
• Resets automatically

*Thank you for using the bot!* ✨
    `.trim();

    await sendMessage(chatId, statsText, true);
}

async function showHistory(chatId, userId) {
    const userHistoryData = userHistory.get(userId) || [];
    
    if (userHistoryData.length === 0) {
        await sendMessage(chatId, 
            '📭 *No download history found!*\n\nYour download history will appear here after you download some videos.',
            true
        );
        return;
    }
    
    let historyText = '📋 *Your Recent Downloads*\n\n';
    
    userHistoryData.slice(0, 10).forEach((item, index) => {
        const timeAgo = formatTimeAgo(item.timestamp);
        const status = item.success ? '✅' : '❌';
        const shortUrl = item.url.substring(0, 30) + '...';
        
        historyText += `${index + 1}. ${status} ${shortUrl}\n   ⏰ ${timeAgo}\n\n`;
    });
    
    if (userHistoryData.length > 10) {
        historyText += `\n... and ${userHistoryData.length - 10} more downloads.`;
    }
    
    historyText += '\n*Use /stats to see your statistics*';
    
    await sendMessage(chatId, historyText, true);
}

async function showAbout(chatId) {
    const aboutText = `
🤖 *About TikTok Downloader Bot*

*Version:* 2.0 Enhanced
*Platform:* Cloudflare Workers
*Developer:* Telegram Bot Ecosystem

✨ *Features Included:*
• Multiple TikTok API fallbacks
• Rate limiting protection
• Download history tracking
• Real-time statistics
• Markdown formatting
• Error handling

🔧 *Technical Details:*
• Built on Cloudflare Workers
• Uses multiple TikTok API services
• Automatic failover between APIs
• No data storage (in-memory only)

⚖️ *Legal Notice:*
This bot is designed for educational purposes and personal use. Please respect TikTok's Terms of Service and only download content you have permission to access. The developers are not responsible for misuse.

*Thank you for using our service!* 🎉
    `.trim();

    await sendMessage(chatId, aboutText, true);
}

async function processTikTokUrl(chatId, userId, url) {
    const processingMsg = await sendMessage(chatId, '⏳ *Processing your TikTok video...*\n\nPlease wait while we download and process the video.', true);

    try {
        let videoData = null;
        let usedApi = '';
        
        // Try each API endpoint until one works
        for (const apiBase of TIKTOK_APIS) {
            try {
                videoData = await fetchTikTokData(apiBase, url);
                if (videoData && videoData.videoUrl) {
                    usedApi = new URL(apiBase).hostname;
                    break;
                }
            } catch (error) {
                console.log(`API ${apiBase} failed:`, error.message);
                continue;
            }
        }

        if (!videoData || !videoData.videoUrl) {
            await editMessage(chatId, processingMsg.result.message_id, 
                '❌ *Download Failed!*\n\nPossible reasons:\n• Invalid or private URL\n• Video was removed\n• Temporary API issues\n• Region restrictions\n\nPlease try a different URL or try again later.',
                true
            );
            updateUserHistory(userId, url, false);
            return;
        }

        await editMessage(chatId, processingMsg.result.message_id, 
            `✅ *Download Successful!*\n\n📹 Processing completed via ${usedApi}\n\n⚡ Sending video now...`,
            true
        );

        // Prepare caption
        const caption = videoData.title ? 
            `📹 ${videoData.title}\n\n✨ Downloaded via TikTok Bot\n🎯 Source: ${usedApi}` : 
            `✨ TikTok Video\n\nDownloaded via TikTok Bot\n🎯 Source: ${usedApi}`;

        // Send video
        const sendResult = await sendVideo(chatId, videoData.videoUrl, caption);
        
        if (sendResult.ok) {
            totalDownloads++;
            updateUserHistory(userId, url, true);
            
            // Send success confirmation
            await sendMessage(chatId,
                `🎉 *Video sent successfully!*\n\n📊 Stats updated:\n• Your total downloads: ${(userHistory.get(userId) || []).filter(item => item.success).length}\n• Global downloads: ${totalDownloads}\n\n*Want to download another?* Just send a new URL!`,
                true
            );
        } else {
            throw new Error('Failed to send video via Telegram');
        }

    } catch (error) {
        console.error('Processing error:', error);
        await editMessage(chatId, processingMsg.result.message_id, 
            '❌ *Processing Failed!*\n\nAn unexpected error occurred while processing the video. Please try again with a different URL.',
            true
        );
        updateUserHistory(userId, url, false);
    }
}

async function fetchTikTokData(apiBase, url) {
    let apiUrl, response;
    
    if (apiBase.includes('tikwm.com')) {
        apiUrl = `${apiBase}?url=${encodeURIComponent(url)}`;
        response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.data && data.data.play) {
            return {
                videoUrl: data.data.play,
                title: data.data.title || 'TikTok Video',
                duration: data.data.duration
            };
        }
    }
    else if (apiBase.includes('tikdown.org')) {
        apiUrl = `${apiBase}getVideo?url=${encodeURIComponent(url)}`;
        response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.videoUrl) {
            return {
                videoUrl: data.videoUrl,
                title: data.title || 'TikTok Video'
            };
        }
    }
    else if (apiBase.includes('tikmate.online')) {
        apiUrl = `${apiBase}getVideo?url=${encodeURIComponent(url)}`;
        response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.url) {
            return {
                videoUrl: data.url,
                title: data.title || 'TikTok Video'
            };
        }
    }
    else if (apiBase.includes('tiklydown.com')) {
        apiUrl = `${apiBase}download?url=${encodeURIComponent(url)}`;
        response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.videoUrl) {
            return {
                videoUrl: data.videoUrl,
                title: data.title || 'TikTok Video'
            };
        }
    }
    
    throw new Error('No video data found from this API');
}

// Telegram API methods
async function sendMessage(chatId, text, markdown = false) {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: markdown ? 'Markdown' : 'HTML',
            disable_web_page_preview: true
        })
    });
    return await response.json();
}

async function editMessage(chatId, messageId, text, markdown = false) {
    const response = await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: markdown ? 'Markdown' : 'HTML',
            disable_web_page_preview: true
        })
    });
    return await response.json();
}

async function sendVideo(chatId, videoUrl, caption = '') {
    const response = await fetch(`${TELEGRAM_API}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            video: videoUrl,
            caption: caption.substring(0, 1024),
            parse_mode: 'Markdown',
            supports_streaming: true
        })
    });
    return await response.json();
}

// Utility functions
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else {
        return `${minutes}m ${secs}s`;
    }
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
}

function isTikTokUrl(text) {
    const tiktokPatterns = [
        /https?:\/\/(vm|vt)\.tiktok\.com\/\S+/,
        /https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /https?:\/\/(www\.)?tiktok\.com\/t\/\w+\//,
        /https?:\/\/(www\.)?tiktok\.com\/\S*?\/video\/\d+/
    ];
    return tiktokPatterns.some(pattern => pattern.test(text));
}