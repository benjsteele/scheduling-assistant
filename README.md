# scheduling-assistant

A local tool that scrapes your Outlook Web and Microsoft Teams Web, summarises new messages with a local Ollama LLM, saves the result as a Markdown file, and sends it to you via WhatsApp Web — all on a configurable schedule.

No cloud services beyond Microsoft 365 itself. Everything runs on your machine.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  schedule_runner.js  (node-cron daemon / --once flag)   │
└──────────────────────────┬──────────────────────────────┘
                           │ triggers
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     pipeline.js                         │
│                                                         │
│  browser.js ──► chrome-devtools-mcp (subprocess)        │
│      │              Chrome (headless, profiles/browser) │
│      │                                                  │
│      ├─► scraper.js                                     │
│      │     navigate_page + evaluate_script              │
│      │     ├── outlook.office.com  → emails[]           │
│      │     └── teams.microsoft.com → messages[]         │
│      │                                                  │
│      ├─► summarizer.js                                  │
│      │     POST localhost:11434/api/chat (Ollama)       │
│      │     └── Markdown summary string                  │
│      │                                                  │
│      ├─► summaries/<timestamp>.md  (written to disk)    │
│      │                                                  │
│      └─► notifier.js                                    │
│            navigate_page → web.whatsapp.com             │
│            click Send → WhatsApp message delivered      │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- `chrome-devtools-mcp` is spawned as a child process and driven over stdio using the MCP protocol (`@modelcontextprotocol/sdk`). The app is the MCP client; it never imports `chrome-devtools-mcp` directly.
- A single Chrome instance (one browser profile) handles all three sites per run — Outlook, Teams, and WhatsApp Web — so only one login session needs to be maintained.
- The Ollama call is a plain `fetch` with no SDK, keeping the dependency footprint minimal.
- `schedule.json` is the single source of truth for timing and can be updated live (via `npm run schedule`) without restarting the daemon.

## Recommended specs

This tool runs Chrome headless, a Node.js process, and a local LLM simultaneously.

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| CPU / GPU | Any modern CPU | Apple Silicon or discrete GPU for faster LLM inference |
| Disk | 2 GB free | 5 GB free (model weights + Chrome profile) |
| OS | macOS 12+, Linux | macOS (Apple Silicon) |

### Model recommendations (M2 MacBook Pro, 16 GB)

Your unified memory is shared between the OS, Chrome, Node.js, and the model. Expect Chrome + system to use ~4–6 GB, leaving ~10 GB for the LLM.

| Model | RAM usage | Speed on M2 | Quality | Verdict |
|-------|-----------|-------------|---------|---------|
| `llama3.2:3b` | ~2 GB | Very fast | Good for summaries | **Recommended default** |
| `llama3.1:8b` | ~5 GB | Fast | Better reasoning | Good if you want richer summaries |
| `mistral:7b` | ~4.5 GB | Fast | Good | Solid alternative to llama3.1:8b |
| `phi4:14b` | ~9 GB | Slow | High quality | Pushes RAM limits when Chrome is running — not advised |
| `llama3.1:70b` | ~40 GB | N/A | Overkill | Will not fit |

**Start with `llama3.2:3b`** — it is fast enough to run a summary in under 30 seconds on an M2, and the task (summarising bullet-pointed emails) does not require a large model. Step up to `llama3.1:8b` only if summary quality feels lacking.

```bash
ollama pull llama3.2:3b   # ~2 GB download
```

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com/) running locally with a model pulled (see recommendations above)
- A Microsoft 365 account with Outlook and Teams access
- A WhatsApp account with WhatsApp Web available

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and fill in the three values
```

### .env values

| Variable | Example | Description |
|----------|---------|-------------|
| `WHATSAPP_NUMBER` | `447911123456` | Your number in E.164 format (no `+`) |
| `OLLAMA_MODEL` | `llama3.2` | Any model you have pulled in Ollama |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL (default if omitted) |

## First-run: log in to all three sites

```bash
npm run login
```

This opens a headed Chrome window. Log in to Outlook, then Teams, then WhatsApp Web (scan the QR code). Press Enter at each prompt. Your session is saved to `profiles/browser/` and reused for all future runs.

## Usage

| Command | What it does |
|---------|-------------|
| `npm run summary` | Run once immediately: scrape → summarise → save → notify |
| `npm start` | Start the background scheduler (runs at times set in `schedule.json`) |
| `npm run schedule -- --days 1,2,3,4,5 --hour 9 --minute 0` | Update the schedule |
| `npm run login` | Re-open the browser for re-authentication |

Days are 0–6 (0 = Sunday). The default schedule is weekdays at 09:00.

To reload a running scheduler after changing the schedule without restarting it:
```bash
kill -HUP <pid>
```

## Flagging priority people and channels

Edit `flags.json` to mark senders or Teams channels as priority. Matching is case-insensitive substring — `"sarah"` matches `"Sarah Smith"` or `"sarah@company.com"`.

```json
{
  "people": ["ceo@company.com", "Sarah"],
  "channels": ["Urgent", "Engineering"]
}
```

Flagged items appear first in the summary under a **🚩 Flagged Items** section. The LLM generates a **💬 Draft response** for each flagged message automatically. No restart needed — `flags.json` is read fresh on every run.

## Output

Summaries are saved to `summaries/<ISO-timestamp>.md`. The `summaries/` directory is gitignored.

A summary with flagged items looks like:

```markdown
# Summary — 14/05/2026, 09:00:00

## 🚩 Flagged Items (priority people / channels)

### Email: Q2 budget sign-off needed
From: ceo@company.com (9:02 AM)
Please review and sign off on the attached budget by EOD.

💬 Draft response:
Thanks for sending this over. I'll review the Q2 budget today and send my sign-off by end of business. Let me know if there's anything specific you'd like me to focus on.

---

## Other Unread Emails
...
```
