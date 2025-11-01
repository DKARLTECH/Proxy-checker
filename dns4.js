// Advanced DNS Logger with better parsing
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'POST' && 
        request.headers.get('content-type')?.includes('application/dns-message')) {
      return handleDoHRequest(request, env);
    }
    
    // Show recent logs (if using KV storage)
    return showLogsPage(request, env);
  },
};

async function handleDoHRequest(request, env) {
  try {
    const dnsData = await request.arrayBuffer();
    const queryInfo = await parseDnsQuery(request, dnsData);
    
    // Log the query
    await logQueryDetails(queryInfo, env);
    
    // Forward to upstream DNS
    return await forwardDnsQuery(dnsData);
    
  } catch (error) {
    console.error('DNS Processing Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function parseDnsQuery(request, dnsData) {
  const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
  const timestamp = new Date().toISOString();
  
  // Basic DNS header parsing (simplified)
  const view = new DataView(dnsData);
  const queryId = view.getUint16(0);
  const flags = view.getUint16(2);
  const questionCount = view.getUint16(4);
  
  const isQuery = (flags & 0x8000) === 0;
  
  return {
    timestamp,
    clientIP,
    queryId: queryId.toString(16),
    isQuery: isQuery ? 'Query' : 'Response',
    questionCount,
    rawData: Array.from(new Uint8Array(dnsData)).slice(0, 512), // First 512 bytes
  };
}

async function logQueryDetails(queryInfo, env) {
  // Log to console
  console.log('📡 DNS Query:', {
    time: queryInfo.timestamp,
    client: queryInfo.clientIP,
    type: queryInfo.isQuery,
    questions: queryInfo.questionCount,
  });
  
  // Store in KV if configured
  if (env.DNS_LOGS) {
    const logKey = `dns-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await env.DNS_LOGS.put(logKey, JSON.stringify(queryInfo), {
      expirationTtl: 86400, // 24 hours
    });
  }
}

async function forwardDnsQuery(dnsData) {
  const upstreamResponse = await fetch('https://cloudflare-dns.com/dns-query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/dns-message',
      'Accept': 'application/dns-message',
    },
    body: dnsData,
  });
  
  return upstreamResponse;
}

async function showLogsPage(request, env) {
  let logs = [];
  
  // Try to retrieve logs from KV
  if (env.DNS_LOGS) {
    try {
      const keysList = await env.DNS_LOGS.list();
      const recentLogs = await Promise.all(
        keysList.keys.slice(-50).map(async (key) => {
          const value = await env.DNS_LOGS.get(key.name);
          return value ? JSON.parse(value) : null;
        })
      );
      logs = recentLogs.filter(log => log !== null);
    } catch (error) {
      console.error('Error retrieving logs:', error);
    }
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>DNS Query Logger</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          .log-entry { padding: 15px; border-bottom: 1px solid #eee; margin: 10px 0; }
          .timestamp { color: #666; font-size: 0.9em; }
          .client { color: #3366cc; font-weight: bold; }
          .query-type { background: #e6f3ff; padding: 2px 6px; border-radius: 4px; }
          .stats { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📡 DNS Query Logger</h1>
          <div class="stats">
            <h3>Statistics</h3>
            <p>Total Queries Logged: ${logs.length}</p>
            <p>Worker URL: ${new URL(request.url).origin}</p>
          </div>
          <h3>Recent DNS Queries:</h3>
          <div id="logs">
            ${logs.reverse().map(log => `
              <div class="log-entry">
                <div class="timestamp">${log.timestamp}</div>
                <div>
                  <span class="client">${log.clientIP}</span> - 
                  <span class="query-type">${log.isQuery}</span> - 
                  Questions: ${log.questionCount}
                </div>
              </div>
            `).join('')}
            ${logs.length === 0 ? '<p>No logs available. Make some DNS queries first!</p>' : ''}
          </div>
        </div>
      </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}