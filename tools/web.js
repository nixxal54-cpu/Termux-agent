import https from 'https';
import http from 'http';
import { URL } from 'url';

// Simple HTTP/HTTPS fetch without external dependencies
function httpGet(urlStr, maxBytes = 50000, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 4) return reject(new Error('Too many redirects'));
    try {
      const parsedUrl = new URL(urlStr);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CodingAgent/1.0)',
          'Accept': 'text/html,application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000
      };
      const req = client.request(options, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          // Handle relative redirects
          let loc = res.headers.location;
          if (loc.startsWith('/')) loc = `${parsedUrl.protocol}//${parsedUrl.hostname}${loc}`;
          else if (!loc.startsWith('http')) loc = `${parsedUrl.protocol}//${parsedUrl.hostname}/${loc}`;
          return httpGet(loc, maxBytes, redirectCount + 1).then(resolve).catch(reject);
        }
        let data = '';
        let bytes = 0;
        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes < maxBytes) data += chunk.toString();
        });
        res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Decode DDG redirect URLs like //duckduckgo.com/l/?uddg=https%3A%2F%2F...
function decodeDDGUrl(raw) {
  try {
    // Handle protocol-relative URLs
    if (raw.startsWith('//')) raw = 'https:' + raw;
    const u = new URL(raw);
    if (u.hostname.includes('duckduckgo.com')) {
      const uddg = u.searchParams.get('uddg');
      if (uddg) return decodeURIComponent(uddg);
    }
    return raw;
  } catch {
    return raw;
  }
}

// Strip HTML to readable text, aggressively capped
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 1500); // Keep short — this goes into LLM context
}

// DuckDuckGo HTML search — no API key needed
async function duckDuckGoSearch(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`;
  const res = await httpGet(url, 150000);
  if (res.status !== 200) throw new Error(`Search failed with status ${res.status}`);

  const results = [];
  const linkPattern = /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetPattern = /class="result__snippet"[^>]*>([\s\S]*?)<\/span>/g;

  const links = [...res.body.matchAll(linkPattern)].slice(0, 5);
  const snippets = [...res.body.matchAll(snippetPattern)].slice(0, 5);

  for (let i = 0; i < links.length; i++) {
    const realUrl = decodeDDGUrl(links[i][1]);
    results.push({
      title: links[i][2].trim(),
      url: realUrl,
      snippet: snippets[i] ? stripHtml(snippets[i][1]).slice(0, 200) : '' // Short snippets only
    });
  }

  if (results.length === 0) {
    return [{ title: 'No results parsed', url: '', snippet: stripHtml(res.body).slice(0, 500) }];
  }

  return results;
}

export const webTool = {
  name: "web",
  description: "Search the web or fetch a URL. action='search' for web search (returns titles+urls+snippets). action='fetch' to read a webpage. Keep fetched content short.",
  schema: {
    action: "'fetch' | 'search'",
    url: "string (required for fetch — full URL with https://)",
    query: "string (required for search)"
  },
  execute: async (args) => {
    try {
      if (args.action === 'fetch') {
        if (!args.url) return { status: "error", message: "url is required for fetch" };
        const res = await httpGet(args.url, 30000); // Smaller limit for fetch
        const contentType = res.headers['content-type'] || '';
        let content;
        if (contentType.includes('application/json')) {
          content = res.body.slice(0, 1500);
        } else {
          content = stripHtml(res.body);
        }
        return { status: "success", url: args.url, content };

      } else if (args.action === 'search') {
        if (!args.query) return { status: "error", message: "query is required for search" };
        const results = await duckDuckGoSearch(args.query);
        // Return compact summary — NOT full JSON dump — to save context tokens
        const summary = results.map((r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
        ).join('\n\n');
        return { status: "success", query: args.query, summary };

      } else {
        return { status: "error", message: "action must be 'fetch' or 'search'" };
      }
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }
};