import fs from 'fs';
import path from 'path';
import { createBrowser, closeBrowser } from './browser.js';
import { scrape } from './scraper.js';
import { summarize } from './summarizer.js';
import { sendWhatsApp } from './notifier.js';

export async function runPipeline() {
  console.log(`[${new Date().toISOString()}] Pipeline started`);

  const client = await createBrowser({ headless: true });

  try {
    console.log('Scraping Outlook and Teams...');
    const { emails, messages } = await scrape(client);
    console.log(`  Found ${emails.length} unread emails, ${messages.length} Teams messages`);

    console.log('Summarising with Ollama...');
    const summary = await summarize(emails, messages);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(process.cwd(), 'summaries', `${timestamp}.md`);
    const header = `# Summary — ${new Date().toLocaleString()}\n\n`;
    fs.writeFileSync(outPath, header + summary, 'utf-8');
    console.log(`Summary saved to ${outPath}`);

    console.log('Sending WhatsApp notification...');
    await sendWhatsApp(client, summary);
    console.log('WhatsApp message sent.');
  } finally {
    await closeBrowser(client);
  }

  console.log(`[${new Date().toISOString()}] Pipeline complete`);
}
