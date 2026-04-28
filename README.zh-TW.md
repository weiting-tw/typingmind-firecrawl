# Firecrawl TypingMind Plugin

[English](README.md) | **繁體中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一個 [TypingMind](https://www.typingmind.com) plugin，透過 [Firecrawl](https://www.firecrawl.dev/) 同時提供 **網頁搜尋** 與 **網頁抓取** 兩個 function call，共用同一組設定。

| Function | 用途 |
|---|---|
| `firecrawl_web_search` | 搜尋網路，回傳前 N 筆結果的乾淨 markdown |
| `firecrawl_scrape_url` | 抓取指定網址，回傳該頁主要內容（markdown 格式）|

同時支援 **Firecrawl Cloud**（`api.firecrawl.dev`）與**自建（self-hosted）** Firecrawl。

---

## 前置需求

- TypingMind（網頁版或桌面版），搭配支援 **Function calling** 的模型 — 例如 OpenAI GPT-4o、Anthropic Claude 3.5+、Google Gemini 2.5+、DeepSeek V3 等。
- Firecrawl 存取權限，二擇一：
  - **Cloud：** 在 [firecrawl.dev](https://www.firecrawl.dev/) 申請的 `fc-...` API key。
  - **Self-hosted：** 一台 Firecrawl 主機，前面接一層 reverse proxy，負責 (1) 強制 Bearer token 驗證、(2) 回傳 CORS headers（TypingMind plugin 在瀏覽器執行，CORS 是必要條件）。

---

## 安裝

本 repo 遵循 TypingMind [GitHub 分享規範](https://docs.typingmind.com/plugins/share-import-plugins)：一個 repo 一個 plugin，repo 根目錄含 `plugin.json` + `implementation.js` + `README.md`。

1. 在 TypingMind：**Settings → Plugins → Add Plugin → Import from GitHub**
2. 貼這個 repo URL：

   ```
   https://github.com/weiting-tw/typingmind-firecrawl
   ```

3. 匯入後，點開 plugin 設定，填：
   - **Firecrawl Base URL** — Cloud 用 `https://api.firecrawl.dev`，self-hosted 用你自己的網址。
   - **Firecrawl API Key** — `fc-...` cloud key，或自建 gateway 的 Bearer token。

4. 在聊天視窗點 plugin sidebar，把這個 plugin **enable** 起來 —— `firecrawl_web_search` 跟 `firecrawl_scrape_url` 兩個 function 會一起啟用。

> 想要鎖在固定版本？URL 後面接 `@<tag>` 或 `@<sha>`，例：`https://github.com/weiting-tw/typingmind-firecrawl@v1.0.0`（依 TypingMind 版本而定）。

### 手動安裝（直接貼 JSON）

若 GitHub import 不可用，可改用直接貼 JSON：

1. 取得 [`plugin.json`](plugin.json) — clone 整個 repo，或在 GitHub 上開檔案點 raw 複製內容皆可。
2. TypingMind：**Settings → Plugins → Add Plugin → Import / Paste JSON**（不同 TypingMind 版本字眼可能略有差異）。把整個 JSON 貼進去存檔。
3. 設定與啟用步驟同上面安裝的 3、4 步。

---

## 設定方案

### A. Cloud（最簡單）

1. 到 [firecrawl.dev](https://www.firecrawl.dev/) 註冊，拿 `fc-...` API key。
2. Plugin 設定填：
   - Base URL：`https://api.firecrawl.dev`（預設值）
   - API Key：`fc-...`
3. 完成。

### B. Self-hosted（自建 + Caddy gateway）

1. 依 [Firecrawl 官方文件](https://github.com/firecrawl/firecrawl) 自架 Firecrawl。
2. 在 Firecrawl 前面架一層輕量 auth gateway（Caddy / nginx / Traefik 都可），負責兩件事：
   - 驗證 `Authorization: Bearer <your-token>`。
   - 回傳 CORS headers。

   自建 Firecrawl 預設 `USE_DB_AUTHENTICATION=false`，本身不做認證，直接暴露在外網非常危險。

3. Plugin 設定：
   - Base URL：`https://firecrawl.your-domain.com`
   - API Key：你 gateway 設定的 Bearer token。

4. **Gateway 必須回傳 CORS headers**，TypingMind plugin 在瀏覽器執行，最小組合：
   ```
   Access-Control-Allow-Origin: https://www.typingmind.com   (或 echo Origin)
   Access-Control-Allow-Headers: Authorization, Content-Type
   Access-Control-Allow-Methods: POST, OPTIONS
   ```
   完整 Caddyfile 範例見 [`docs/caddy-example.md`](docs/caddy-example.md)。

---

## 設定欄位說明

兩個 function 共用一組設定：

| 欄位 | 型別 | 預設值 | 用於 | 說明 |
|---|---|---|---|---|
| `baseUrl` | text | `https://api.firecrawl.dev` | 兩者 | Firecrawl API endpoint 根網址 |
| `apiKey` | password | _(必填)_ | 兩者 | `fc-...` cloud key 或 self-hosted gateway token |
| `onlyMainContent` | enum (`true` / `false`) | `true` | 兩者 | 是否去除導覽列、頁尾、廣告等雜訊 |
| `maxCharsPerResult` | number | `4000` | search | 每筆搜尋結果的 markdown 字元上限 |
| `maxChars` | number | `12000` | scrape | 單頁抓取的 markdown 字元上限 |

---

## 運作原理

當具備 Function calling 能力的 LLM 判斷需要搜尋或抓網頁時，會自動呼叫：

- `firecrawl_web_search(query: string, limit?: integer)`
  → POST `${baseUrl}/v2/search`
  → 回傳前 `limit` 筆搜尋結果與其乾淨 markdown
- `firecrawl_scrape_url(url: string)`
  → POST `${baseUrl}/v2/scrape`
  → 回傳該頁主要內容（markdown）

回傳的 markdown 會被截斷在 plugin 設定的字元上限，避免 token 用量爆掉。

---

## 疑難排解

**`Failed to fetch` / 瀏覽器 console 出現 CORS error** — 自建 backend 沒回 CORS headers，看 [`docs/caddy-example.md`](docs/caddy-example.md)。

**`Firecrawl HTTP 401`** — API key 不對。Self-hosted 的話，是 gateway 的 Bearer token 跟 plugin 設定不一致。

**`Firecrawl HTTP 429`（cloud）** — 被 rate limit 了。降低 prompt 中要求的 `limit`、升級 firecrawl.dev plan，或改自建。

**LLM 永遠不呼叫 plugin** —
- 該模型可能不支援 Function calling（多數 local Ollama 模型不支援）。改用 OpenAI、Anthropic、Google、DeepSeek。
- 確認 plugin 在「當前對話」是 **enabled** 狀態，不只是「已安裝」。

---

## 開發

`plugin.json` 才是 TypingMind 實際載入並執行的檔案 —— `pluginFunctions[].code` 字串才是真正的 runtime source of truth。`implementation.js` 是給編輯器看的鏡像（lint、語法高亮、formatter 才能正確運作），**改其中一邊時要同步改另一邊**再 commit。

要修改：

1. 同時編輯 [`implementation.js`](implementation.js) 跟 [`plugin.json`](plugin.json) 內對應的 `code` 字串，兩邊保持一致。
2. Commit、push。
3. 在 TypingMind 把舊 plugin 刪掉，重新從 GitHub URL 載入。

要追求穩定，TypingMind 那邊可以釘版本（tag 或 commit hash），避免 plugin 自己改版。

### 檔案結構

```
typingmind-firecrawl/
├── plugin.json          # metadata + pluginFunctions（含 inline code）
├── implementation.js    # inline code 的源檔鏡像
├── README.md            # plugin overview（也兼 repo 說明）
├── README.zh-TW.md      # 繁體中文翻譯（本檔）
├── LICENSE
└── docs/
    └── caddy-example.md
```

---

## 授權

MIT — 詳見 [LICENSE](LICENSE)。

Firecrawl 服務本體採用 AGPL-3.0 授權；本 plugin 僅呼叫其公開 API，不構成 Firecrawl 的衍生作品。

Plugin 中的 `iconURL` 指向 `firecrawl.dev` 的公開 favicon，圖案版權屬 Firecrawl Inc. 所有。
