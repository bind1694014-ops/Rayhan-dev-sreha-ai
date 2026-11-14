import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsBengali,
  deriveChatTitle,
  parseVoiceAutomationCommand,
  shouldAutoScroll,
  transitionAutomationStatus,
  validateMemoryBackup,
} from './chatHelpers';
import { AutomationTask } from '../types/sreha';

test('shouldAutoScroll returns true near bottom and false when reading older messages', () => {
  assert.equal(shouldAutoScroll(895, 1500, 500, 110), true);
  assert.equal(shouldAutoScroll(400, 1500, 500, 110), false);
});

test('containsBengali detects Bengali script accurately', () => {
  assert.equal(containsBengali('স্রেহা কেমন আছো?'), true);
  assert.equal(containsBengali('Hello Sreha'), false);
});

test('deriveChatTitle truncates long prompts cleanly', () => {
  const title = deriveChatTitle('a'.repeat(60));
  assert.equal(title.length, 43);
  assert.ok(title.endsWith('…'));
});

test('parseVoiceAutomationCommand parses Bengali and English commands', () => {
  const alarm = parseVoiceAutomationCommand('স্রেহা, আগামীকাল সকাল ৮টার জন্য Alarm সেট করো');
  assert.equal(alarm.kind, 'alarm');
  assert.ok(alarm.steps.length >= 2);

  const timer = parseVoiceAutomationCommand('Start a 10 minute timer');
  assert.equal(timer.kind, 'timer');
  assert.equal(timer.triggerOffsetMs, 600_000);
});

test('transitionAutomationStatus handles pause, resume, cancel safely', () => {
  const task: AutomationTask = {
    id: 't1',
    title: 'Test',
    command: 'Test',
    steps: ['Step 1'],
    scheduleLabel: 'In 5 min',
    status: 'active',
    createdAt: 1000,
  };
  const paused = transitionAutomationStatus(task, 'pause');
  assert.equal(paused.status, 'paused');
  const resumed = transitionAutomationStatus(paused, 'resume');
  assert.equal(resumed.status, 'active');
  const cancelled = transitionAutomationStatus(resumed, 'cancel');
  assert.equal(cancelled.status, 'cancelled');
});

test('validateMemoryBackup accepts valid JSON and rejects malformed payloads', () => {
  const valid = validateMemoryBackup(
    JSON.stringify({
      memories: [{ id: 'm1', category: 'note', title: 'Exam', content: 'Monday 10 AM' }],
    })
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.items.length, 1);

  const invalid = validateMemoryBackup('not-json');
  assert.equal(invalid.valid, false);
});
