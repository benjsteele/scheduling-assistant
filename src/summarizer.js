import 'dotenv/config';

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

function formatEmail(e) {
  return `- **${e.subject}** (from ${e.sender}, ${e.time})\n  ${e.preview}`;
}

function formatMessage(m) {
  const who = m.sender ? `${m.sender}` : 'Unknown';
  const where = m.channel ? ` in ${m.channel}` : '';
  return `- [${who}${where}] ${m.content}`;
}

function buildPrompt(emails, messages) {
  const flaggedEmails = emails.filter(e => e.flagged);
  const otherEmails = emails.filter(e => !e.flagged);
  const flaggedMessages = messages.filter(m => m.flagged);
  const otherMessages = messages.filter(m => !m.flagged);

  const hasFlagged = flaggedEmails.length > 0 || flaggedMessages.length > 0;

  const flaggedSection = hasFlagged ? `
## 🚩 Flagged Items (priority people / channels)

${[
    ...flaggedEmails.map(e => `### Email: ${e.subject}\nFrom: ${e.sender} (${e.time})\n${e.preview}`),
    ...flaggedMessages.map(m => `### Teams: ${m.sender ? `${m.sender}` : 'Message'}${m.channel ? ` in ${m.channel}` : ''}\n${m.content}`)
  ].join('\n\n')}

For each flagged item above, provide a suggested draft response under a "💬 Draft response:" heading. Keep drafts professional and concise (2–4 sentences). Match the tone of the original message.
` : '';

  const emailSection = otherEmails.length
    ? otherEmails.map(formatEmail).join('\n')
    : '_None._';

  const teamsSection = otherMessages.length
    ? otherMessages.map(formatMessage).join('\n')
    : '_None._';

  return `You are a concise assistant producing a daily digest in Markdown.
${flaggedSection}
## Other Unread Emails
${emailSection}

## Other Teams Messages
${teamsSection}

Instructions:
- If there are flagged items, list them first with a "💬 Draft response:" for each.
- Then produce a brief grouped summary of the remaining emails and Teams messages.
- Highlight anything else that looks urgent or needs a reply.
- Be brief throughout.`;
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
