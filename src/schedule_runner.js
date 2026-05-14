import 'dotenv/config';
import fs from 'fs';
import cron from 'node-cron';
import { runPipeline } from './pipeline.js';

const SCHEDULE_FILE = new URL('../schedule.json', import.meta.url).pathname;

function loadSchedule() {
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
}

function buildCronExpression({ days, hour, minute }) {
  return `${minute} ${hour} * * ${days.join(',')}`;
}

if (process.argv.includes('--once')) {
  await runPipeline();
} else {
  const schedule = loadSchedule();
  const expression = buildCronExpression(schedule);
  console.log(`Scheduler started. Cron: ${expression}`);

  cron.schedule(expression, () => {
    runPipeline().catch(err => console.error('Pipeline error:', err));
  });

  // Re-read schedule.json on SIGHUP so changes take effect without restart
  process.on('SIGHUP', () => {
    const updated = loadSchedule();
    const newExpr = buildCronExpression(updated);
    console.log(`Schedule reloaded. New cron: ${newExpr}`);
  });
}
