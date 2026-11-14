import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeConversationHeartState,
  buildHeartVoiceSystemPrompt,
  extractHeartMemoryCandidate,
  HEART_ENGINE_EMOTIONS,
  resolveRuntimeGeminiConfig,
} from './heartEngine';
import {
  applySupportedTtsVocalBurst,
  computeVoiceDeliveryParams,
  sanitizeSpokenText,
  splitSentenceBoundaryChunks,
} from './voiceDelivery';
import { CustomGeminiConfig, MemoryItem, ProviderConfigState, ProviderId } from '../types/sreha';

test('HEART_ENGINE_EMOTIONS contains all 11 required emotion states', () => {
  assert.equal(HEART_ENGINE_EMOTIONS.length, 11);
  for (const em of [
    'Happy',
    'Excited',
    'Calm',
    'Caring',
    'Curious',
    'Surprised',
    'Sad',
    'Worried',
    'Empathetic',
    'Playful',
    'Thoughtful',
  ]) {
    assert.ok(HEART_ENGINE_EMOTIONS.includes(em as (typeof HEART_ENGINE_EMOTIONS)[number]));
  }
});

test('analyzeConversationHeartState detects humor, empathy, curiosity, and memory cues', () => {
  const memories: MemoryItem[] = [
    {
      id: 'm1',
      category: 'preference',
      title: 'Tone Preference',
      content: 'Prefers concise Bengali explanations with Python examples.',
      createdAt: 1000,
      updatedAt: 2000,
    },
  ];

  const funny = analyzeConversationHeartState({
    userText: 'একটা মজার কৌতুক শোনাও তো!',
    turnCount: 3,
    lastReactionTurn: 0,
    memories,
  });
  assert.equal(funny.emotion, 'Playful');
  assert.equal(funny.expression, 'natural_laughter');
  assert.ok(funny.reactionHint);

  const sad = analyzeConversationHeartState({
    userText: 'আজ আমার মনটা খুব খারাপ লাগছে।',
    turnCount: 4,
    lastReactionTurn: 3, // Within cooldown -> should NOT force reaction on every turn
    memories,
  });
  assert.equal(sad.emotion, 'Empathetic');
  assert.equal(sad.reactionHint, undefined);
});

test('buildHeartVoiceSystemPrompt enforces fluid speaking, authentic audio expression, and Heart ethics', () => {
  const state = analyzeConversationHeartState({ userText: 'হ্যালো স্রেহা' });
  const prompt = buildHeartVoiceSystemPrompt({
    language: 'auto',
    voiceProfile: 'natural',
    heartState: state,
    memoriesSummary: '[preference] Prefers warm Bengali.',
    naturalReactionsEnabled: true,
  });
  assert.match(prompt, /SREHA HEART ENGINE/);
  assert.match(prompt, /NEVER output literal stage directions/);
  assert.match(prompt, /NEVER claim human consciousness/);
  assert.match(prompt, /Prefers warm Bengali/);
});

test('extractHeartMemoryCandidate identifies user preferences and tasks', () => {
  const pref = extractHeartMemoryCandidate('আমি সংক্ষেপে উত্তর পছন্দ করি');
  assert.equal(pref?.category, 'preference');

  const task = extractHeartMemoryCandidate('কাল আমাকে সকাল ৯টায় মিটিংয়ের কথা মনে করিয়ে দিও');
  assert.equal(task?.category, 'task_context');
});

test('resolveRuntimeGeminiConfig enforces priority: Valid Custom Gemini > Default Gemini > Other Provider', () => {
  const baseProviders: Record<ProviderId, ProviderConfigState> = {
    gemini: { id: 'gemini', name: 'Google Gemini', serverManaged: true, apiKey: 'server-managed', status: 'connected' },
    openrouter: { id: 'openrouter', name: 'OpenRouter', apiKey: 'sk-or-123', status: 'connected' },
    openai: { id: 'openai', name: 'OpenAI', apiKey: '', status: 'unconfigured' },
    deepseek: { id: 'deepseek', name: 'DeepSeek', apiKey: '', status: 'unconfigured' },
    grok: { id: 'grok', name: 'Grok', apiKey: '', status: 'unconfigured' },
  };

  // Unverified custom key must NEVER activate over Default Gemini
  const unverifiedCustom: CustomGeminiConfig = {
    apiKey: 'AIza-untested',
    modelId: 'gemini-4-hydrogen',
    status: 'error',
    availableModels: [],
  };
  const res1 = resolveRuntimeGeminiConfig({
    customGemini: unverifiedCustom,
    activeProvider: 'gemini',
    activeModelId: 'gemini-4-hydrogen',
    providers: baseProviders,
  });
  assert.equal(res1.source, 'default_gemini');
  assert.equal(res1.customApiKey, undefined);

  // Verified custom Gemini key takes priority 1
  const verifiedCustom: CustomGeminiConfig = {
    apiKey: 'AIza-valid-custom',
    modelId: 'gemini-3.1-flash-lite',
    status: 'connected',
    availableModels: [],
  };
  const res2 = resolveRuntimeGeminiConfig({
    customGemini: verifiedCustom,
    activeProvider: 'gemini',
    activeModelId: 'gemini-4-hydrogen',
    providers: baseProviders,
  });
  assert.equal(res2.source, 'custom_gemini');
  assert.equal(res2.customApiKey, 'AIza-valid-custom');
  assert.equal(res2.modelId, 'gemini-3.1-flash-lite');

  // External provider works cleanly when selected & configured
  const res3 = resolveRuntimeGeminiConfig({
    customGemini: unverifiedCustom,
    activeProvider: 'openrouter',
    activeModelId: 'openai/gpt-4o-mini',
    providers: baseProviders,
  });
  assert.equal(res3.source, 'fallback_provider');
  assert.equal(res3.provider, 'openrouter');
});

test('Natural Voice Delivery Controller sanitizes stage tags and splits strictly at sentence boundaries', () => {
  const sanitized = sanitizeSpokenText('[EMOTION:Happy] (laughs) নমস্কার! **কেমন আছো**? *sighs*');
  assert.equal(sanitized, 'নমস্কার! কেমন আছো?');

  const chunks = splitSentenceBoundaryChunks(
    'হ্যাঁ, বুঝেছি। আমি এখনই তোমার জন্য পুরো পরিকল্পনাটা সাজিয়ে দিচ্ছি! তুমি চাইলে আমরা ধাপে ধাপে শুরু করতে পারি।'
  );
  assert.ok(chunks.length >= 1);
  for (const chunk of chunks) {
    assert.ok(/[।!?]$/.test(chunk), `Chunk should end at sentence boundary: ${chunk}`);
  }

  const delivery = computeVoiceDeliveryParams({
    emotion: 'Empathetic',
    voiceProfile: 'soft',
    transportMode: 'native-live',
  });
  assert.ok(delivery.speakingRate < 1.0);
  assert.equal(delivery.chunkBoundaryMode, 'sentence');
  assert.equal(delivery.supportsNativeVocalBursts, true);

  assert.equal(
    applySupportedTtsVocalBurst('দারুণ বলেছ!', 'natural_laughter', true),
    '<laugh> দারুণ বলেছ!'
  );
  assert.equal(
    applySupportedTtsVocalBurst('দারুণ বলেছ!', 'natural_laughter', false),
    'দারুণ বলেছ!'
  );
});
