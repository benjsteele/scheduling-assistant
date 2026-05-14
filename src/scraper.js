import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { callTool } from './browser.js';

const OUTLOOK_URL = 'https://outlook.office.com/mail/';
const TEAMS_URL = 'https://teams.microsoft.com/';

const FLAGS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'flags.json');

function loadFlags() {
  try {
    return JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf-8'));
  } catch {
    return { people: [], channels: [] };
  }
}

function applyFlags(items, flags, { senderKey = 'sender', channelKey = 'channel' } = {}) {
  const people = flags.people.map(p => p.toLowerCase());
  const channels = flags.channels.map(c => c.toLowerCase());
  if (!people.length && !channels.length) return items.map(i => ({ ...i, flagged: false }));

  return items.map(item => {
    const sender = (item[senderKey] ?? '').toLowerCase();
    const channel = (item[channelKey] ?? '').toLowerCase();
    const flagged = people.some(p => sender.includes(p)) || channels.some(c => channel.includes(c));
    return { ...item, flagged };
  });
}

const OUTLOOK_SCRIPT = `
(function() {
  const rows = Array.from(document.querySelectorAll('[role="option"]'));
  return JSON.stringify(
    rows
      .filter(el => el.getAttribute('aria-label')?.toLowerCase().includes('unread'))
      .slice(0, 20)
      .map(el => ({
        subject: el.querySelector('[class*="subject"]')?.innerText?.trim() ?? '',
        preview: el.querySelector('[class*="preview"]')?.innerText?.trim() ?? '',
        sender:  el.querySelector('[class*="sender"]')?.innerText?.trim() ?? '',
        time:    el.querySelector('[class*="time"], [class*="date"]')?.innerText?.trim() ?? '',
        channel: ''
      }))
      .filter(e => e.subject)
  );
})()
`;

// Teams Web: capture message body, sender, and the active channel/chat name.
// Selectors are best-effort; Microsoft updates the Teams DOM periodically.
const TEAMS_SCRIPT = `
(function() {
  const channelName =
    document.querySelector('[data-tid="channel-title"]')?.innerText?.trim() ||
    document.querySelector('[data-tid="headerTitle"]')?.innerText?.trim() ||
    document.querySelector('[class*="channelTitle"]')?.innerText?.trim() ||
    '';

  const items = Array.from(document.querySelectorAll('[data-tid="message-body-content"]'));
  return JSON.stringify(
    items.slice(0, 30).map(el => {
      const container =
        el.closest('[data-tid*="messageThread"]') ||
        el.closest('[class*="message"]') ||
        el.parentElement;
      const sender =
        container?.querySelector('[data-tid="message-author-name"]')?.innerText?.trim() ||
        container?.querySelector('[class*="author"]')?.innerText?.trim() ||
        '';
      return { content: el.innerText?.trim(), sender, channel: channelName };
    }).filter(m => m.content)
  );
})()
`;

export async function scrapeOutlook(client) {
  await callTool(client, 'navigate_page', { url: OUTLOOK_URL });
  await callTool(client, 'wait_for', { selector: '[role="option"]', timeout: 15000 });
  const raw = await callTool(client, 'evaluate_script', { expression: OUTLOOK_SCRIPT });
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function scrapeTeams(client) {
  await callTool(client, 'navigate_page', { url: TEAMS_URL });
  await callTool(client, 'wait_for', { selector: '[data-tid="message-body-content"]', timeout: 20000 });
  const raw = await callTool(client, 'evaluate_script', { expression: TEAMS_SCRIPT });
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function scrape(client) {
  const flags = loadFlags();

  const [emailResult, messageResult] = await Promise.allSettled([
    scrapeOutlook(client),
    scrapeTeams(client),
  ]);

  const rawEmails = emailResult.status === 'fulfilled' ? emailResult.value : [];
  const rawMessages = messageResult.status === 'fulfilled' ? messageResult.value : [];

  return {
    emails: applyFlags(rawEmails, flags),
    messages: applyFlags(rawMessages, flags),
  };
}
