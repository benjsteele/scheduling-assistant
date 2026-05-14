# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                                                     # install dependencies
npm run summary                                                 # run pipeline once (scrape → summarise → save → notify)
npm start                                                       # start background cron scheduler
npm run schedule -- --days 1,2,3,4,5 --hour 9 --minute 0      # update schedule.json
npm run login                                                   # first-run browser login (headed Chrome)
```

## Architecture

**Runtime**: Node.js ESM (`"type": "module"`). No build step.

**Browser automation** (`src/browser.js`): Spawns `chrome-devtools-mcp` as a subprocess using `@modelcontextprotocol/sdk`'s `StdioClientTransport`. The application is the MCP client; `chrome-devtools-mcp` is the server. All browser operations go through `callTool(client, toolName, args)`. The MCP tools used are: `navigate_page`, `wait_for`, `evaluate_script`, `click`.

**Pipeline** (`src/pipeline.js`): Single browser instance is created, passed through scraper and notifier, then closed. Sequence: `createBrowser` → `scrape` → `summarize` → write `.md` file → `sendWhatsApp` → `closeBrowser`.

**Scraping** (`src/scraper.js`): `scrapeOutlook` and `scrapeTeams` run in parallel via `Promise.allSettled` so a failure in one does not abort the other. Selectors target `[role="option"][aria-label*="Unread"]` for Outlook and `[data-tid="message-body-content"]` for Teams — these may need updating if Microsoft changes the DOM.

**Summarisation** (`src/summarizer.js`): Plain `fetch` to `${OLLAMA_BASE_URL}/api/chat`. Model and base URL come from `.env`. No SDK dependency.

**WhatsApp delivery** (`src/notifier.js`): Uses the `?phone=&text=` URL scheme on `web.whatsapp.com`. Requires the WhatsApp Web session to already be established in `profiles/browser/`.

**Scheduling** (`src/schedule_runner.js`): Reads `schedule.json` at startup and builds a cron expression. Responds to `SIGHUP` to reload `schedule.json` without a full restart.

## Configuration files

| File | Purpose |
|------|---------|
| `.env` | Runtime secrets — never commit. Copy from `.env.example`. |
| `schedule.json` | `{ days: number[], hour: number, minute: number }` — days are 0–6 (0=Sun) |
| `profiles/browser/` | Chrome user data dir — gitignored, created by `npm run login` |
| `summaries/` | Output markdown files — gitignored |

## Key constraints

- `chrome-devtools-mcp` is a `devDependency` and is invoked via `npx`, never imported.
- The `profiles/` directory must never be committed (contains login sessions).
- The `.env` file must never be committed.
- Selectors for Outlook and Teams are brittle; if scraping returns empty arrays, check them with `take_screenshot` via `chrome-devtools-mcp`.
