addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Your server IP (HTTP or HTTPS - choose one)
  const targetUrl = 'http://51.91.97.39'; // or https:// if SSL is configured
  
  // Preserve original request path and query
  const url = new URL(request.url);
  const path = url.pathname;
  const query = url.search;
  
  // Construct new URL while hiding the IP from clients
  const newUrl = `${targetUrl}${path}${query}`;
  
  // Clone and clean headers
  const headers = new Headers(request.headers);
  
  // Remove Cloudflare-specific headers
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  
  // Add proper forwarding headers
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP'));
  headers.set('X-Forwarded-Host', request.headers.get('Host'));
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1)); // Remove trailing ':'
  
  // Forward the request
  const newRequest = new Request(newUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'manual'
  });
  
  try {
    const response = await fetch(newRequest);
    
    // Return response while hiding server details
    const newResponse = new Response(response.body, response);
    
    // Remove server-identifying headers
    newResponse.headers.delete('server');
    newResponse.headers.delete('x-powered-by');
    
    return newResponse;
  } catch (error) {
    return new Response('Service unavailable', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}