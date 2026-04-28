# Firecrawl TypingMind Plugins

**English** | [繁體中文](README.zh-TW.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Two [TypingMind](https://www.typingmind.com) plugins that give your LLM **web search** and **page scraping** powers via [Firecrawl](https://www.firecrawl.dev/).

| Plugin | What it does |
|---|---|
| **Firecrawl Web Search** | Search the web and return cleaned markdown of the top N results |
| **Firecrawl Scrape URL** | Fetch a specific URL and return its main content as markdown |

Works with both **Firecrawl Cloud** (`api.firecrawl.dev`) and a **self-hosted** Firecrawl deployment.

---

## Prerequisites

- TypingMind (web or desktop) running a model that supports **function calling** — OpenAI GPT-4o, Anthropic Claude 3.5+, Google Gemini 2.5+, DeepSeek V3, etc.
- Firecrawl access, one of:
  - **Cloud:** an `fc-...` API key from [firecrawl.dev](https://www.firecrawl.dev/)
  - **Self-hosted:** a Firecrawl instance behind a reverse proxy that enforces a Bearer token **and** returns CORS headers (TypingMind plugins run in the browser, so CORS is mandatory)

---

## Quick install (via jsDelivr)

This repo is public, so [jsDelivr](https://www.jsdelivr.com/) serves the plugin JSON over a CDN with `Access-Control-Allow-Origin: *` — TypingMind can fetch it directly.

1. In TypingMind: **Settings → Plugins → Add Plugin → Load from URL**
2. Paste these URLs, one at a time:

   **Web Search:**
   ```
   https://cdn.jsdelivr.net/gh/weiting-tw/typingmind-firecrawl@main/plugins/firecrawl_web_search.json
   ```

   **Scrape URL:**
   ```
   https://cdn.jsdelivr.net/gh/weiting-tw/typingmind-firecrawl@main/plugins/firecrawl_scrape_url.json
   ```

3. After import, open each plugin's settings and fill:
   - **Firecrawl Base URL** — `https://api.firecrawl.dev` for cloud, or your self-hosted URL
   - **Firecrawl API Key** — your `fc-...` cloud key, or the Bearer token your self-hosted gateway expects

4. In a chat session, open the plugin sidebar and **enable** both plugins for that conversation.

> Pin to a specific version by replacing `@main` with a tag (`@v1.0.0`) or commit hash (`@a1b2c3d`).

---

## Manual install (paste JSON)

If you can't or don't want to use jsDelivr (e.g. corporate firewall blocks the CDN, or you're working from a fork that's still private), paste the JSON directly:

1. Grab the JSON for each plugin:
   - [`plugins/firecrawl_web_search.json`](plugins/firecrawl_web_search.json)
   - [`plugins/firecrawl_scrape_url.json`](plugins/firecrawl_scrape_url.json)

   Either clone this repo or open each file on GitHub and copy its raw contents.

2. In TypingMind: **Settings → Plugins → Add Plugin**, then choose the **Import / Paste JSON** option (the exact label varies by TypingMind version). Paste and save. Repeat for the second plugin.

3. Configure and enable as in steps 3–4 of the quick install.

---

## Setup variants

### A. Cloud (easiest)

1. Sign up at [firecrawl.dev](https://www.firecrawl.dev/) and copy your `fc-...` API key.
2. In each plugin's settings:
   - Base URL: `https://api.firecrawl.dev` (default)
   - API Key: `fc-...`
3. Done.

### B. Self-hosted

1. Self-host Firecrawl per the [official guide](https://github.com/firecrawl/firecrawl).
2. Put a thin auth gateway (Caddy / nginx / Traefik) in front that enforces `Authorization: Bearer <your-token>`. Self-hosted Firecrawl with `USE_DB_AUTHENTICATION=false` does not authenticate by itself — exposing it raw is reckless.
3. Configure the plugin:
   - Base URL: `https://firecrawl.your-domain.com`
   - API Key: whatever Bearer token your gateway expects.
4. **Make sure your gateway returns CORS headers** — the plugins run in TypingMind's browser context. Minimum:
   ```
   Access-Control-Allow-Origin: https://www.typingmind.com   (or echo Origin)
   Access-Control-Allow-Headers: Authorization, Content-Type
   Access-Control-Allow-Methods: POST, OPTIONS
   ```
   See [`docs/caddy-example.md`](docs/caddy-example.md) for a drop-in Caddyfile.

---

## Plugin settings reference

| Setting | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | text | `https://api.firecrawl.dev` | Firecrawl API endpoint root |
| `apiKey` | password | _(required)_ | `fc-...` cloud key, or self-hosted gateway token |
| `onlyMainContent` | enum (`true` / `false`) | `true` | Strip nav, footer, ads |
| `maxCharsPerResult` (search) | number | `4000` | Per-result markdown char cap |
| `maxChars` (scrape) | number | `12000` | Total markdown char cap |

---

## How the LLM uses these

When a function-calling-capable model decides a search or fetch would help, it auto-invokes:

- `firecrawl_web_search(query: string, limit?: integer)`
  → POST `${baseUrl}/v2/search`
  → Returns top `limit` results with their cleaned markdown
- `firecrawl_scrape_url(url: string)`
  → POST `${baseUrl}/v2/scrape`
  → Returns the page's main content as markdown

Markdown is trimmed at the character limits in each plugin's settings to keep token usage in check.

---

## Troubleshooting

**`Failed to fetch` / CORS error in browser console** — your self-hosted backend isn't returning CORS headers. See [`docs/caddy-example.md`](docs/caddy-example.md).

**`Firecrawl HTTP 401`** — API key is wrong, or for self-hosted: the gateway's Bearer token doesn't match what you put in the plugin.

**`Firecrawl HTTP 429` (cloud)** — you're rate-limited. Lower `limit` in your prompts, upgrade your firecrawl.dev plan, or self-host.

**LLM never calls the plugin** —
- The model may not support function calling (most local Ollama models don't). Use OpenAI / Anthropic / Google / DeepSeek.
- Make sure the plugin is **enabled** in the chat session, not just installed.

---

## Development

The plugins are plain JSON with embedded JavaScript. To modify:

1. Edit the file under [`plugins/`](plugins/).
2. Commit and push. The `@main` jsDelivr URL picks up the new version once the CDN cache refreshes (usually a few minutes).
3. In TypingMind, delete the existing plugin and re-import — either reload from the same jsDelivr URL or paste the updated JSON.

For production stability, pin TypingMind to a tag or commit hash (`@v1.0.0`, `@<sha>`) instead of `@main` so it doesn't auto-update.

### File structure

```
typingmind-firecrawl/
├── README.md
├── README.zh-TW.md
├── LICENSE
├── plugins/
│   ├── firecrawl_web_search.json
│   └── firecrawl_scrape_url.json
└── docs/
    └── caddy-example.md
```

---

## License

MIT — see [LICENSE](LICENSE).

The Firecrawl service itself is licensed AGPL-3.0; this plugin merely calls its public API and is therefore not a derivative work of Firecrawl.

The plugin's `iconURL` points at `firecrawl.dev`'s public favicon and is the property of Firecrawl Inc.
