import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const SCHEDULE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schedule.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  console.error('Usage: npm run schedule -- --days 1,2,3,4,5 --hour 9 --minute 0');
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (!args.days || args.hour == null || args.minute == null) {
  fail('--days, --hour, and --minute are all required');
}

const days = args.days.split(',').map(Number);
const hour = Number(args.hour);
const minute = Number(args.minute);

if (days.some(d => isNaN(d) || d < 0 || d > 6)) fail('--days must be comma-separated integers 0–6 (0=Sun)');
if (isNaN(hour) || hour < 0 || hour > 23) fail('--hour must be 0–23');
if (isNaN(minute) || minute < 0 || minute > 59) fail('--minute must be 0–59');

const schedule = { days, hour, minute };
fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
console.log(`Schedule updated: ${JSON.stringify(schedule)}`);
console.log('Send SIGHUP to a running scheduler (kill -HUP <pid>) to reload without restart.');
