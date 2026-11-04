/**
 * PM2 process configuration for Players Paradise Hub
 * Keep a single Node instance in fork mode to prevent VPS RAM exhaustion,
 * enable shared in-memory caching, and maintain sub-second response times.
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const envFromFile = {};

try {
  const envPath = path.join(cwd, '.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envFromFile[key] = val;
    }
  }
} catch (err) {
  console.warn('[ecosystem] Could not read .env.local:', err.message);
}

module.exports = {
  apps: [
    {
      name: 'players-paradise',
      cwd,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      node_args: '--max-old-space-size=512',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        ...envFromFile,
      },
    },
  ],
};
