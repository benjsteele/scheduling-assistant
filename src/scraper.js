import { callTool } from './browser.js';

const OUTLOOK_URL = 'https://outlook.office.com/mail/';
const TEAMS_URL = 'https://teams.microsoft.com/';

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
        time:    el.querySelector('[class*="time"], [class*="date"]')?.innerText?.trim() ?? ''
      }))
      .filter(e => e.subject)
  );
})()
`;

const TEAMS_SCRIPT = `
(function() {
  const items = Array.from(document.querySelectorAll('[data-tid="message-body-content"]'));
  return JSON.stringify(
    items.slice(0, 30).map(el => el.innerText?.trim()).filter(Boolean)
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
  const [emails, messages] = await Promise.allSettled([
    scrapeOutlook(client),
    scrapeTeams(client),
  ]);
  return {
    emails: emails.status === 'fulfilled' ? emails.value : [],
    messages: messages.status === 'fulfilled' ? messages.value : [],
  };
}
