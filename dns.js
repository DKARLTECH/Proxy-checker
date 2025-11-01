// fast-dns-worker.js - Ultra Fast DNS-over-HTTPS
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    
    // Set CORS headers for wide compatibility
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/dns-message'
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle DNS-over-HTTPS requests
    if (request.method === 'GET' || request.method === 'POST') {
      try {
        let dnsRequest;
        
        if (request.method === 'GET') {
          // Handle GET requests with dns parameter
          const url = new URL(request.url);
          const dnsParam = url.searchParams.get('dns');
          if (dnsParam) {
            dnsRequest = base64ToUint8Array(dnsParam);
          }
        } else if (request.method === 'POST') {
          // Handle POST requests with DNS message in body
          const contentType = request.headers.get('content-type');
          if (contentType === 'application/dns-message') {
            dnsRequest = await request.arrayBuffer();
          }
        }

        if (!dnsRequest) {
          return new Response('Invalid DNS request', { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Use Cloudflare's DNS as backend (ultra-fast)
        const dohResponse = await fetch('https://cloudflare-dns.com/dns-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/dns-message',
            'Accept': 'application/dns-message'
          },
          body: dnsRequest
        });

        if (dohResponse.ok) {
          const responseData = await dohResponse.arrayBuffer();
          const responseTime = Date.now() - startTime;
          
          // Log performance (visible in Workers dashboard)
          console.log(`⚡ DNS resolved in ${responseTime}ms`);
          
          return new Response(responseData, { 
            headers: corsHeaders 
          });
        } else {
          throw new Error('Backend DNS failed');
        }
        
      } catch (error) {
        console.error('DNS Error:', error);
        return new Response('DNS resolution failed', { 
          status: 500,
          headers: corsHeaders 
        });
      }
    }

    // Return simple HTML info page for browser requests
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>⚡ Ultra Fast DNS Server</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .info { background: #f0f8ff; padding: 20px; border-radius: 10px; margin: 20px 0; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>⚡ Ultra Fast DNS Server</h1>
    <div class="info">
        <h3>Your Private DNS Server is Running!</h3>
        <p>This is a high-performance DNS-over-HTTPS server powered by Cloudflare Workers.</p>
        <p><strong>Server Status:</strong> 🟢 Online</p>
        <p><strong>Protocol:</strong> DNS-over-HTTPS (DoH)</p>
        <p><strong>Backend:</strong> Cloudflare DNS (1.1.1.1)</p>
    </div>
    
    <h3>📱 How to Use on Android:</h3>
    <ol>
        <li>Go to <strong>Settings > Network & Internet</strong></li>
        <li>Tap on <strong>Private DNS</strong></li>
        <li>Select <strong>Private DNS provider hostname</strong></li>
        <li>Enter: <code>your-subdomain.workers.dev</code></li>
        <li>Tap <strong>Save</strong></li>
    </ol>

    <h3>🖥️ How to Use on Windows/Mac/Linux:</h3>
    <p>Use this DNS-over-HTTPS endpoint in your browser or system settings:</p>
    <code>https://your-subdomain.workers.dev/dns-query</code>

    <footer>
        <p><em>This DNS server provides enhanced privacy and performance using Cloudflare's global network.</em></p>
    </footer>
</body>
</html>`;
    
    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html; charset=UTF-8',
        ...corsHeaders 
      }
    });
  }
};

// Helper function to decode base64 DNS queries
function base64ToUint8Array(base64) {
  const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}