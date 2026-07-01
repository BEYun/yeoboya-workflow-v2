#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { readStdin } = require('./lib/hook-runtime');
const { hasPendingRecovery, clearRecovery, readFrictionLog } = require('./lib/friction');

(async () => {
  const root = process.env.DEV_ROOT || process.cwd();
  const raw = await readStdin();

  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}

  if (payload.stop_hook_active) process.exit(0);
  if (!hasPendingRecovery(root)) process.exit(0);

  clearRecovery(root);

  const recent = readFrictionLog(root).filter((e) => e.source === 'hook').slice(-3);
  const cats = [...new Set(recent.map((e) => e.category))].join(', ') || '마찰';
  const cli = path.join(__dirname, 'friction-log.js');

  const msg = [
    '이번 작업에서 자동 감지된 불편이 있습니다: ' + cats + '.',
    '왜 그랬는지·무엇을 기대했는지 한 줄로 남겨 주세요(정성 기록, 선택).',
    '방법: 아래 JSON을 stdin으로 friction-log CLI에 전달하세요.',
    "echo '{\"category\":\"<코드키>\",\"skill\":\"<스킬>\",\"severity\":\"friction\",\"what\":\"...\",\"expected\":\"...\",\"source\":\"agent\"}' | node " + cli,
    '남길 게 없으면 그대로 종료해도 됩니다(다시 묻지 않습니다).',
  ].join('\n');

  process.stderr.write(msg + '\n');
  process.exit(2);
})();
