# Firecrawl TypingMind Plugin

**English** | [繁體中文](README.zh-TW.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A single [TypingMind](https://www.typingmind.com) plugin that gives your LLM **web search** and **page scraping** powers via [Firecrawl](https://www.firecrawl.dev/), exposed as two function calls sharing one set of credentials.

| Function | What it does |
|---|---|
| `firecrawl_web_search` | Search the web and return cleaned markdown of the top N results |
| `firecrawl_scrape_url` | Fetch a specific URL and return its main content as markdown |

Works with both **Firecrawl Cloud** (`api.firecrawl.dev`) and a **self-hosted** Firecrawl deployment.

---

## Prerequisites

- TypingMind (web or desktop) running a model that supports **function calling** — OpenAI GPT-4o, Anthropic Claude 3.5+, Google Gemini 2.5+, DeepSeek V3, etc.
- Firecrawl access, one of:
  - **Cloud:** an `fc-...` API key from [firecrawl.dev](https://www.firecrawl.dev/)
  - **Self-hosted:** a Firecrawl instance behind a reverse proxy that enforces a Bearer token **and** returns CORS headers (TypingMind plugins run in the browser, so CORS is mandatory)

---

## Install

This repo follows TypingMind's [GitHub-share convention](https://docs.typingmind.com/plugins/share-import-plugins): one plugin per repo, with `plugin.json` + `implementation.js` + `README.md` at the repo root.

1. In TypingMind: **Settings → Plugins → Add Plugin → Import from GitHub**
2. Paste the repo URL:

   ```
   https://github.com/weiting-tw/typingmind-firecrawl
   ```

3. After import, open the plugin's settings and fill:
   - **Firecrawl Base URL** — `https://api.firecrawl.dev` for cloud, or your self-hosted URL
   - **Firecrawl API Key** — your `fc-...` cloud key, or the Bearer token your self-hosted gateway expects

4. In a chat session, open the plugin sidebar and **enable** the plugin — both `firecrawl_web_search` and `firecrawl_scrape_url` become available together.

> Pin to a specific version by appending `@<tag>` or `@<sha>` to the URL — e.g. `https://github.com/weiting-tw/typingmind-firecrawl@v1.0.0` (depending on TypingMind version's support).

### Manual install (paste JSON)

If GitHub import isn't available, paste the JSON directly:

1. Grab [`plugin.json`](plugin.json) — clone this repo, or open the file on GitHub and copy its raw contents.
2. In TypingMind: **Settings → Plugins → Add Plugin → Import / Paste JSON** (the exact label varies by TypingMind version). Paste and save.
3. Configure and enable as in steps 3–4 above.

---

## Setup variants

### A. Cloud (easiest)

1. Sign up at [firecrawl.dev](https://www.firecrawl.dev/) and copy your `fc-...` API key.
2. In the plugin's settings:
   - Base URL: `https://api.firecrawl.dev` (default)
   - API Key: `fc-...`
3. Done.

### B. Self-hosted

1. Self-host Firecrawl per the [official guide](https://github.com/firecrawl/firecrawl).
2. Put a thin auth gateway (Caddy / nginx / Traefik) in front that enforces `Authorization: Bearer <your-token>`. Self-hosted Firecrawl with `USE_DB_AUTHENTICATION=false` does not authenticate by itself — exposing it raw is reckless.
3. Configure the plugin:
   - Base URL: `https://firecrawl.your-domain.com`
   - API Key: whatever Bearer token your gateway expects.
4. **Make sure your gateway returns CORS headers** — the plugin runs in TypingMind's browser context. Minimum:
   ```
   Access-Control-Allow-Origin: https://www.typingmind.com   (or echo Origin)
   Access-Control-Allow-Headers: Authorization, Content-Type
   Access-Control-Allow-Methods: POST, OPTIONS
   ```
   See [`docs/caddy-example.md`](docs/caddy-example.md) for a drop-in Caddyfile.

---

## Plugin settings reference

One set of settings is shared by both functions:

| Setting | Type | Default | Used by | Description |
|---|---|---|---|---|
| `baseUrl` | text | `https://api.firecrawl.dev` | both | Firecrawl API endpoint root |
| `apiKey` | password | _(required)_ | both | `fc-...` cloud key, or self-hosted gateway token |
| `onlyMainContent` | enum (`true` / `false`) | `true` | both | Strip nav, footer, ads |
| `maxCharsPerResult` | number | `4000` | search | Per-result markdown char cap |
| `maxChars` | number | `12000` | scrape | Total scraped markdown char cap |

---

## How the LLM uses these

When a function-calling-capable model decides a search or fetch would help, it auto-invokes:

- `firecrawl_web_search(query: string, limit?: integer)`
  → POST `${baseUrl}/v2/search`
  → Returns top `limit` results with their cleaned markdown
- `firecrawl_scrape_url(url: string)`
  → POST `${baseUrl}/v2/scrape`
  → Returns the page's main content as markdown

Markdown is trimmed at the character limits in the plugin's settings to keep token usage in check.

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

`plugin.json` is what TypingMind actually loads — its `pluginFunctions[].code` strings are the runtime source of truth. `implementation.js` is a sibling source mirror for editor support (lint, syntax highlighting, formatter); when you edit one, **mirror the change to the other** before committing.

To modify:

1. Edit both [`implementation.js`](implementation.js) and the matching `code` string inside [`plugin.json`](plugin.json), keeping them identical.
2. Commit and push.
3. In TypingMind, delete the existing plugin and re-import from the GitHub URL.

For production stability, pin TypingMind to a tag or commit hash so it doesn't auto-update.

### File structure

```
typingmind-firecrawl/
├── plugin.json          # metadata + pluginFunctions (with inline code)
├── implementation.js    # source mirror of the inline code
├── README.md            # plugin overview (this file, also serves as repo doc)
├── README.zh-TW.md      # 繁體中文翻譯
├── LICENSE
└── docs/
    └── caddy-example.md
```

---

## License

MIT — see [LICENSE](LICENSE).

The Firecrawl service itself is licensed AGPL-3.0; this plugin merely calls its public API and is therefore not a derivative work of Firecrawl.

The plugin's `iconURL` points at `firecrawl.dev`'s public favicon and is the property of Firecrawl Inc.
