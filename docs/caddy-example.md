# Self-hosted Firecrawl + Caddy gateway

If you self-host Firecrawl and want to use it with these TypingMind plugins, you need an auth gateway in front of `firecrawl-api` that:

1. Enforces a bearer token (so randoms can't use your scraper)
2. Returns CORS headers (so TypingMind in the browser can `fetch` it)

This is a minimal Caddyfile that does both.

## Caddyfile

```caddyfile
# Disable automatic HTTPS (TLS terminated by upstream NPM Plus / Cloudflare Tunnel / etc.)
# and Caddy's admin port (we don't need it inside this container).
{
    auto_https off
    admin off
}

# CORS header set — `>` prefix means SET (replaces any existing value, including
# whatever the upstream firecrawl-api may have already added). Without `>` you'll
# get duplicate `Access-Control-Allow-Origin: *, *` which Safari/WebKit rejects.
(cors_headers) {
    header >Access-Control-Allow-Origin "*"
    header >Access-Control-Allow-Methods "POST, GET, OPTIONS"
    header >Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With"
    header >Access-Control-Max-Age "86400"
    header >Access-Control-Expose-Headers "Content-Length, Content-Type"
    # `Allow-Credentials: true` conflicts with `Allow-Origin: *` — browsers reject.
    # Strip it in case upstream sets it.
    header -Access-Control-Allow-Credentials
}

:8080 {
    log {
        output stdout
        format console
    }

    # Health probe — no auth
    handle /healthz {
        import cors_headers
        respond "ok" 200
    }

    # OPTIONS preflight — no auth, return 204
    @cors_preflight method OPTIONS
    handle @cors_preflight {
        import cors_headers
        respond "" 204
    }

    # Bearer token check
    @authorized header Authorization "Bearer {env.FIRECRAWL_PUBLIC_API_KEY}"
    handle @authorized {
        import cors_headers
        reverse_proxy firecrawl-api:3002 {
            flush_interval -1
        }
    }

    handle {
        import cors_headers
        respond "Unauthorized" 401 {
            close
        }
    }
}
```

### Why these specific bits matter

| Detail | What goes wrong without it |
|---|---|
| `> ` prefix on each CORS header | `header` (no prefix) appends. If `firecrawl-api` already sends `Access-Control-Allow-Origin`, you get `["*", "*"]`. Safari/WebKit (and TypingMind Mac) treat that as malformed → CORS error. |
| `(cors_headers)` snippet imported into every `handle` | A site-level `header { … }` block does **not** consistently apply when a `handle` ends with `respond`. Putting headers inside each `handle` is reliable. |
| `header -Access-Control-Allow-Credentials` | If the upstream sends `Allow-Credentials: true` and you reply with `Allow-Origin: *`, browsers refuse the response. |
| `auto_https off` | Caddy default would try to fetch a Let's Encrypt cert for `:8080`, which fails noisily. TLS belongs at the upstream proxy. |
| `admin off` | Disables Caddy's REST admin API on port 2019, which we don't expose anyway but it's one less attack surface. |

> Bearer token is the only real auth here; CORS is just to make browsers happy. Don't rely on origin restrictions for security — anyone with the token can call from any client (curl, server-side, another browser app).

## docker-compose snippet

```yaml
services:
  firecrawl-gateway:
    image: caddy:2-alpine
    container_name: firecrawl-gateway
    restart: unless-stopped
    environment:
      - FIRECRAWL_PUBLIC_API_KEY=${FIRECRAWL_PUBLIC_API_KEY}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/caddy:/data
    ports:
      # Bind to LAN IP if you only want LAN reachability:
      #   - "192.168.1.50:3002:8080"
      # Or bind to all interfaces (default):
      - "${FIRECRAWL_PORT:-3002}:8080"
    depends_on:
      - firecrawl-api
    networks:
      # Must share at least one network with firecrawl-api so reverse_proxy can resolve it.
      # Use whatever network firecrawl-api is on in your setup (e.g. `backend` in the
      # official Firecrawl compose, or your own custom network).
      - <same-network-as-firecrawl-api>
```

**Importantly:** strip `ports:` from `firecrawl-api` itself — keep only `expose: ["3002"]`. Otherwise the API is reachable on the host bypassing your gateway entirely (no auth, no CORS), which defeats the purpose.

## Generating a token

```bash
python3 -c "import secrets; print('fc-pub-' + secrets.token_urlsafe(32))"
```

Put it in `.env` as `FIRECRAWL_PUBLIC_API_KEY=...` and use the same value in the TypingMind plugin's "API Key" setting.

## Test

```bash
# preflight (should 204 with CORS headers)
curl -i -X OPTIONS https://firecrawl.your-domain.com/v2/search \
  -H "Origin: https://www.typingmind.com" \
  -H "Access-Control-Request-Method: POST"

# real call (should 200 + JSON)
curl -i -X POST https://firecrawl.your-domain.com/v2/search \
  -H "Origin: https://www.typingmind.com" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"docker","limit":2,"scrapeOptions":{"formats":["markdown"]}}'
```

## Why CORS matters

TypingMind plugins run in the user's browser. When the JS does `fetch('https://firecrawl.your-domain.com/v2/search', ...)`, the browser fires a preflight `OPTIONS` request and only sends the real `POST` if the response includes `Access-Control-Allow-Origin` matching the page's origin (typingmind.com). Without these headers you'll see `Failed to fetch` / `CORS policy` errors in the browser console.

If you're calling the API from a non-browser context (a server, a Python script, curl), CORS doesn't apply and you can ignore this section.
