import 'dotenv/config';

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

function buildPrompt(emails, messages) {
  const emailSection = emails.length
    ? emails.map(e =>
        `- **${e.subject}** (from ${e.sender}, ${e.time})\n  ${e.preview}`
      ).join('\n')
    : '_No unread emails._';

  const teamsSection = messages.length
    ? messages.map(m => `- ${m}`).join('\n')
    : '_No recent Teams messages._';

  return `You are a concise assistant. Summarise the following emails and Teams messages into a brief Markdown digest. Group by theme where possible. Highlight anything urgent or requiring a response.

## Unread Emails
${emailSection}

## Recent Teams Messages
${teamsSection}

Produce a clean Markdown summary with clear sections. Be brief.`;
}

export async function summarize(emails, messages) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: buildPrompt(emails, messages) }],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content ?? '';
}
