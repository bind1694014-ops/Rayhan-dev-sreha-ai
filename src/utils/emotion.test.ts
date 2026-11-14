import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSrehaSystemInstruction,
  EMOTION_META,
  parseEmotionFromResponse,
  VOICE_PROFILES,
} from './emotion';

test('parseEmotionFromResponse extracts valid emotion tag and strips prefix', () => {
  const res = parseEmotionFromResponse('[EMOTION:Happy] নমস্কার! কেমন আছেন?');
  assert.equal(res.emotion, 'Happy');
  assert.equal(res.isCryingEffect, false);
  assert.equal(res.cleanText, 'নমস্কার! কেমন আছেন?');
});

test('parseEmotionFromResponse handles crying effect modifier cleanly', () => {
  const res = parseEmotionFromResponse('[EMOTION:Empathetic|CRYING] আপনার কষ্ট শুনে আমার খুব খারাপ লাগছে।');
  assert.equal(res.emotion, 'Empathetic');
  assert.equal(res.isCryingEffect, true);
  assert.equal(res.cleanText, 'আপনার কষ্ট শুনে আমার খুব খারাপ লাগছে।');
});

test('parseEmotionFromResponse falls back safely on unknown tag', () => {
  const res = parseEmotionFromResponse('[EMOTION:UnknownMood] Hello there');
  assert.equal(res.emotion, 'Calm');
  assert.equal(res.cleanText, 'Hello there');
});

test('all 11 Heart Engine emotions (plus Upset compatibility) and 4 voice profiles are defined', () => {
  assert.equal(Object.keys(EMOTION_META).length, 12);
  assert.equal(VOICE_PROFILES.length, 4);
});

test('buildSrehaSystemInstruction enforces AI identity and emotion rules', () => {
  const prompt = buildSrehaSystemInstruction({
    language: 'auto',
    emotionEnabled: true,
    cryingEffectEnabled: true,
    memoriesSummary: 'User prefers Bengali replies.',
  });
  assert.match(prompt, /Personal AI Assistant/);
  assert.match(prompt, /Never claim to be a real human/);
  assert.match(prompt, /\[EMOTION:Type\]/);
  assert.match(prompt, /User prefers Bengali replies/);
});
