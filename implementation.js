// Source mirror of the inline `code` strings in plugin.json.
// TypingMind runs the embedded copies in plugin.json — keep them in sync when editing here.

async function firecrawl_web_search(params, userSettings) {
  const { query, limit } = params;
  const { baseUrl, apiKey, onlyMainContent, maxCharsPerResult } = userSettings;

  if (!baseUrl || !apiKey) {
    return 'Plugin not configured: baseUrl and apiKey are required.';
  }
  const trimmedBase = String(baseUrl).replace(/\/+$/, '');
  const url = `${trimmedBase}/v2/search`;

  const body = {
    query: query,
    limit: Math.min(Math.max(limit || 5, 1), 10),
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: String(onlyMainContent) !== 'false'
    }
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return `Firecrawl request failed: ${e.message}`;
  }

  if (!res.ok) {
    const text = await res.text();
    return `Firecrawl HTTP ${res.status}: ${text.slice(0, 300)}`;
  }

  let data;
  try { data = await res.json(); } catch (e) {
    return `Firecrawl returned non-JSON response.`;
  }

  const list =
    (data && data.data && data.data.web) ||
    (Array.isArray(data && data.data) ? data.data : null) ||
    [];

  if (!list.length) {
    return `No results for: ${query}`;
  }

  const cap = Number(maxCharsPerResult) || 4000;
  const chunks = list.map((item, i) => {
    const title = item.title || item.url || `Result ${i + 1}`;
    const src = item.url || '';
    let md = item.markdown || item.description || '';
    if (md.length > cap) md = md.slice(0, cap) + '\n\n…(truncated)…';
    return `## [${i + 1}] ${title}\nSource: ${src}\n\n${md}`;
  });

  return chunks.join('\n\n---\n\n');
}

async function firecrawl_scrape_url(params, userSettings) {
  const { url: targetUrl } = params;
  const { baseUrl, apiKey, onlyMainContent, maxChars } = userSettings;

  if (!baseUrl || !apiKey) {
    return 'Plugin not configured: baseUrl and apiKey are required.';
  }
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return 'Invalid URL — must start with http:// or https://';
  }

  const trimmedBase = String(baseUrl).replace(/\/+$/, '');
  const apiUrl = `${trimmedBase}/v2/scrape`;

  const body = {
    url: targetUrl,
    formats: ['markdown'],
    onlyMainContent: String(onlyMainContent) !== 'false'
  };

  let res;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return `Firecrawl request failed: ${e.message}`;
  }

  if (!res.ok) {
    const text = await res.text();
    return `Firecrawl HTTP ${res.status}: ${text.slice(0, 300)}`;
  }

  let data;
  try { data = await res.json(); } catch (e) {
    return `Firecrawl returned non-JSON response.`;
  }

  const doc = (data && data.data) || data;
  let md = (doc && doc.markdown) || '';
  const meta = (doc && doc.metadata) || {};
  const title = meta.title || targetUrl;

  if (!md) {
    return `Firecrawl returned empty markdown for ${targetUrl}.`;
  }

  const cap = Number(maxChars) || 12000;
  if (md.length > cap) md = md.slice(0, cap) + '\n\n…(truncated)…';

  return `# ${title}\nSource: ${targetUrl}\n\n${md}`;
}
