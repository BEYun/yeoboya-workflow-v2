'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

function allow() {
  process.exit(0);
}

function block(msg) {
  process.stderr.write(String(msg) + '\n');
  process.exit(2);
}

function log(event) {
  try {
    const dir = process.env.DEV_LOG_DIR || path.join(os.homedir(), '.claude', 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
    fs.appendFileSync(path.join(dir, 'yeoboya-hooks.log'), line);
  } catch {
    // Logging must never break a hook.
  }
}

module.exports = { readStdin, allow, block, log };
