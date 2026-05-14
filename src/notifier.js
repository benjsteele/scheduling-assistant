import 'dotenv/config';
import { callTool } from './browser.js';

export async function sendWhatsApp(client, text) {
  const number = process.env.WHATSAPP_NUMBER;
  if (!number) throw new Error('WHATSAPP_NUMBER is not set in .env');

  const encoded = encodeURIComponent(text);
  const url = `https://web.whatsapp.com/send?phone=${number}&text=${encoded}`;

  await callTool(client, 'navigate_page', { url });
  await callTool(client, 'wait_for', { selector: '[aria-label="Send"]', timeout: 20000 });
  await callTool(client, 'click', { selector: '[aria-label="Send"]' });

  // Wait briefly for message delivery before the browser closes
  await new Promise(r => setTimeout(r, 3000));
}
