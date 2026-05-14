import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import readline from 'readline';

export async function createBrowser({ headless = true } = {}) {
  const args = ['-y', 'chrome-devtools-mcp@latest',
    `--user-data-dir=${process.cwd()}/profiles/browser`];
  if (headless) args.push('--headless');

  const transport = new StdioClientTransport({ command: 'npx', args });
  const client = new Client({ name: 'scheduling-assistant', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

export async function callTool(client, name, toolArgs) {
  const result = await client.callTool({ name, arguments: toolArgs });
  const text = result.content?.find(c => c.type === 'text')?.text ?? '';
  return text;
}

export async function closeBrowser(client) {
  await client.close();
}

// Entry point for: npm run login
if (process.argv.includes('--login')) {
  const client = await createBrowser({ headless: false });

  console.log('Navigating to Outlook Web — please log in...');
  await callTool(client, 'navigate_page', { url: 'https://outlook.office.com/mail/' });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = (q) => new Promise(res => rl.question(q, res));

  await prompt('Press Enter once you have logged in to Outlook...');

  console.log('Navigating to Microsoft Teams...');
  await callTool(client, 'navigate_page', { url: 'https://teams.microsoft.com/' });
  await prompt('Press Enter once you have logged in to Teams...');

  console.log('Navigating to WhatsApp Web...');
  await callTool(client, 'navigate_page', { url: 'https://web.whatsapp.com/' });
  await prompt('Press Enter once WhatsApp Web has loaded and linked your device...');

  rl.close();
  await closeBrowser(client);
  console.log('Login sessions saved to profiles/browser/. You can now run npm run summary.');
}
