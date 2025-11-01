export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const realHost = url.searchParams.get('real_host');
    
    if (!realHost) {
      return new Response('Worker active. Add ?real_host=example.com', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    try {
      // Your original remote proxy
      const proxyUrl = 'http://ke-mob.watucredit.com:80';
      const targetUrl = `http://${realHost}${url.pathname}${url.search}`;
      
      // Create custom payload similar to your HTTP Custom setup
      const customHeaders = new Headers();
      customHeaders.set('Host', realHost);
      customHeaders.set('User-Agent', request.headers.get('user-agent') || 'Mozilla/5.0');
      customHeaders.set('X-Forwarded-Host', realHost);
      customHeaders.set('X-Proxy-Request', 'true');
      
      // Forward through your remote proxy
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: customHeaders,
        body: request.body,
        cf: {
          cacheEverything: false,
        }
      });
      
      return response;
      
    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
}