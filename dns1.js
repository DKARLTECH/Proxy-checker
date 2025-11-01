// proper-dns-worker.js - Android Compatible DoH Server
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle DNS-over-HTTPS requests (Android Private DNS)
    if (url.pathname === '/dns-query' || request.headers.get('content-type') === 'application/dns-message') {
      return handleDnsQuery(request);
    }
    
    // Handle browser requests with info page
    return handleInfoPage(request);
  }
}

async function handleDnsQuery(request) {
  try {
    // Get the DNS query from the request
    let dnsQuery;
    
    if (request.method === 'POST') {
      dnsQuery = await request.arrayBuffer();
    } else if (request.method === 'GET') {
      const dnsParam = new URL(request.url).searchParams.get('dns');
      if (dnsParam) {
        dnsQuery = base64ToArrayBuffer(dnsParam.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
    
    if (!dnsQuery) {
      return new Response('Invalid DNS query', { status: 400 });
    }

    // Forward to Cloudflare's DNS (1.1.1.1)
    const dohResponse = await fetch('https://cloudflare-dns.com/dns-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/dns-message',
        'Accept': 'application/dns-message',
      },
      body: dnsQuery
    });

    if (dohResponse.ok) {
      const dnsResponse = await dohResponse.arrayBuffer();
      
      return new Response(dnsResponse, {
        headers: {
          'Content-Type': 'application/dns-message',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'content-type',
          'Cache-Control': 'public, max-age=300'
        }
      });
    } else {
      throw new Error('Upstream DNS failed');
    }
    
  } catch (error) {
    console.error('DNS error:', error);
    
    // Return a proper DNS error response
    return new Response('DNS resolution failed', {
      status: 500,
      headers: {
        'Content-Type': 'application/dns-message'
      }
    });
  }
}

function handleInfoPage(request) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>✅ Working DNS Server</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
        .success { color: #22c55e; font-size: 48px; margin-bottom: 20px; }
        .info { background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left; }
        code { background: #1e293b; color: white; padding: 10px; border-radius: 5px; display: block; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="success">✅</div>
    <h1>DNS Server is Working!</h1>
    
    <div class="info">
        <h3>📱 Android Private DNS Setup:</h3>
        <p><strong>Use this exact domain:</strong></p>
        <code>dns.dlvrgml.workers.dev</code>
        
        <p><strong>Steps:</strong></p>
        <ol>
            <li>Settings → Network & Internet → Private DNS</li>
            <li>Select "Private DNS provider hostname"</li>
            <li>Enter: <strong>dns.dlvrgml.workers.dev</strong></li>
            <li>Save</li>
        </ol>
        
        <p style="color: #22c55e; font-weight: bold;">✅ Status: Server is running correctly</p>
    </div>
    
    <p><em>This server uses Cloudflare's fast DNS infrastructure (1.1.1.1)</em></p>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}