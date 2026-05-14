# scheduling-assistant

A local tool that scrapes your Outlook Web and Microsoft Teams Web, summarises new messages with a local Ollama LLM, saves the result as a Markdown file, and sends it to you via WhatsApp Web — all on a configurable schedule.

No cloud services beyond Microsoft 365 itself. Everything runs on your machine.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com/) running locally with at least one model pulled (e.g. `ollama pull llama3.2`)
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

## Output

Summaries are saved to `summaries/<ISO-timestamp>.md`. The `summaries/` directory is gitignored.
