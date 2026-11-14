import {
  CustomGeminiConfig,
  EmotionType,
  HeartStateSnapshot,
  LanguageMode,
  MemoryItem,
  ProviderConfigState,
  ProviderId,
  RuntimeGeminiResolution,
  VoiceExpressionType,
  VoiceProfileId,
} from '../types/sreha';
import { EMOTION_META, VOICE_PROFILES } from './emotion';

export const HEART_ENGINE_EMOTIONS: EmotionType[] = [
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
];

const BN_REACTIONS: Partial<Record<EmotionType, string[]>> = {
  Happy: ['বাহ, খুব ভালো!', 'দারুণ লাগল শুনে!'],
  Excited: ['বাহ, অসাধারণ!', 'ওহ, দারুণ খবর তো!'],
  Curious: ['হুম, বলো।', 'ওহ, তাই নাকি?'],
  Surprised: ['ওহ, তাই নাকি!', 'সত্যি বলছেন?'],
  Empathetic: ['ঠিক আছে, বুঝতে পারছি।', 'হ্যাঁ, বুঝেছি।'],
  Caring: ['হ্যাঁ, বুঝেছি।', 'আচ্ছা, তাহলে এমন করি।'],
  Thoughtful: ['আচ্ছা!', 'হুম, আচ্ছা তাহলে এমন করি।'],
  Calm: ['হ্যাঁ, বুঝেছি।', 'আচ্ছা!'],
  Playful: ['আরে বাহ!', 'হা হা, দারুণ বলেছ!'],
};

const EN_REACTIONS: Partial<Record<EmotionType, string[]>> = {
  Happy: ['Oh, that is wonderful!', 'Love to hear that!'],
  Excited: ['Oh, that is awesome!', 'Wait, really? That is amazing!'],
  Curious: ['Mm-hmm, go on.', 'Oh, really?'],
  Surprised: ['Oh, wow!', 'Really?'],
  Empathetic: ['I hear you.', 'I understand how that feels.'],
  Caring: ['Got it, take your time.', 'Okay, let us figure this out together.'],
  Thoughtful: ['Hmm, good point.', 'Alright, let us think through that.'],
  Calm: ['Got it.', 'Sure thing.'],
  Playful: ['Haha, fair enough!', 'Ooh, nice one!'],
};

export const EXPRESSION_AUDIO_CUES: Record<VoiceExpressionType, string> = {
  natural_laughter: 'Light, warm, genuine natural chuckle or soft laugh in vocal delivery',
  soft_chuckle: 'Brief, gentle amused chuckle in tone',
  happy_tone: 'Bright, smiling, warm vocal resonance',
  excited_tone: 'Lively, upbeat cadence with genuine enthusiasm',
  gentle_speaking: 'Soft, calm, unhurried, reassuring voice',
  thoughtful_pause: 'Measured reflective pacing with brief natural breathing pause',
  caring_tone: 'Affectionate, gentle, attentive and comforting vocal warmth',
  surprised_reaction: 'Natural lifted pitch expressing genuine pleasant surprise',
  empathetic_tone: 'Soft, patient, deeply understanding, non-judgmental voice',
  soft_breath: 'Natural soft conversational intake of breath before speaking gently',
  neutral: 'Balanced, clear, fluent conversational cadence',
};

/**
 * Resolves relevant Heart Memory cues for the active conversation turn.
 * Prioritizes user preferences, past context, and explicit tasks without repeating questions.
 */
export function extractRelevantHeartMemory(
  userText: string,
  memories: MemoryItem[],
  maxItems = 5
): string | undefined {
  if (!memories || memories.length === 0) return undefined;
  const queryWords = userText
    .toLowerCase()
    .split(/[\s,।.!?]+/)
    .filter((w) => w.length >= 2);

  const scored = memories.map((mem) => {
    const hay = `${mem.title} ${mem.content} ${mem.category}`.toLowerCase();
    let score = mem.category === 'preference' ? 2 : mem.category === 'task_context' ? 1.5 : 1;
    for (const w of queryWords) {
      if (hay.includes(w)) score += 3;
    }
    return { mem, score };
  });

  scored.sort((a, b) => b.score - a.score || b.mem.updatedAt - a.mem.updatedAt);
  const top = scored.slice(0, maxItems).map((s) => `[${s.mem.category}] ${s.mem.title}: ${s.mem.content}`);
  return top.length > 0 ? top.join('\n') : undefined;
}

/**
 * Detects whether the user shared a preference or fact worth gently remembering in Heart Memory.
 */
export function extractHeartMemoryCandidate(
  userText: string
): { title: string; content: string; category: 'preference' | 'task_context' | 'fact' } | null {
  const clean = userText.trim();
  if (clean.length < 10 || clean.length > 260) return null;

  if (/আমার নাম|i am called|my name is|আমাকে .* ডাকবে|call me /i.test(clean)) {
    return { title: 'User Identity / Name', content: clean, category: 'fact' };
  }
  if (/আমার পছন্দ|i prefer|i like |ভালোবাসি|পছন্দ করি|সংক্ষেপে উত্তর|short answer|detailed answer/i.test(clean)) {
    return { title: 'Conversation Preference', content: clean, category: 'preference' };
  }
  if (/মনে করিয়ে দিও|remind me|কাল আমাকে|tomorrow i have|পরীক্ষা|meeting|কাজ আছে/i.test(clean)) {
    return { title: 'Upcoming Task Context', content: clean, category: 'task_context' };
  }
  return null;
}

/**
 * SREHA HEART ENGINE:
 * Analyzes user/assistant turn + conversation history + memory to select the optimal
 * simulated emotion, natural vocal expression, speaking rate, and optional reaction cue.
 */
export function analyzeConversationHeartState(params: {
  userText: string;
  assistantText?: string;
  previousEmotion?: EmotionType;
  memories?: MemoryItem[];
  turnCount?: number;
  lastReactionTurn?: number;
  naturalReactionsEnabled?: boolean;
}): HeartStateSnapshot {
  const text = `${params.userText || ''} ${params.assistantText || ''}`.trim();
  const lower = text.toLowerCase();
  const isBengali = /[\u0980-\u09FF]/.test(text);

  let emotion: EmotionType = params.previousEmotion || 'Calm';
  let expression: VoiceExpressionType = 'neutral';
  let speakingRate = 1.0;

  if (/মজা|হাসি|কৌতুক|joke|funny|haha|hehe|লল|lol|দুষ্টুমি|খুনসুটি/i.test(lower)) {
    emotion = 'Playful';
    expression = /joke|কৌতুক|haha|lol|হাসি/i.test(lower) ? 'natural_laughter' : 'soft_chuckle';
    speakingRate = 1.04;
  } else if (/মন খারাপ|কষ্ট|দুঃখ|হতাশ|কান্না|খারাপ লাগছে|sad|lonely|depressed|heartbroken|miss /i.test(lower)) {
    emotion = /আমি|আমার|feel|লাগছে/i.test(params.userText.toLowerCase()) ? 'Empathetic' : 'Sad';
    expression = emotion === 'Empathetic' ? 'empathetic_tone' : 'soft_breath';
    speakingRate = 0.92;
  } else if (/চিন্তা|টেনশন|ভয়|উদ্বিগ্ন|সমস্যা|worried|anxious|nervous|problem|help me/i.test(lower)) {
    emotion = 'Worried';
    expression = 'caring_tone';
    speakingRate = 0.95;
  } else if (/জিতেছি|চাকরি|পাশ করেছি|দারুণ খবর|সাফল্য|congrats|won |got the job|amazing news|অসাধারণ|সুখবর/i.test(lower)) {
    emotion = 'Excited';
    expression = 'excited_tone';
    speakingRate = 1.08;
  } else if (/সত্যি|অবাক|বাহবা|বিস্ময়|really\?|no way|seriously|বিশ্বাস হচ্ছে না|তাই নাকি/i.test(lower)) {
    emotion = 'Surprised';
    expression = 'surprised_reaction';
    speakingRate = 1.03;
  } else if (/ধন্যবাদ|ভালো আছি|খুশি|শুভ|thank|happy|glad|great|awesome|ভালো লাগছে/i.test(lower)) {
    emotion = 'Happy';
    expression = 'happy_tone';
    speakingRate = 1.02;
  } else if (/যত্ন|ভালো থেকো|শরীর|বিশ্রাম|take care|tired|ক্লান্ত|ঘুম/i.test(lower)) {
    emotion = 'Caring';
    expression = 'caring_tone';
    speakingRate = 0.94;
  } else if (/কেন|কীভাবে|কী এটা|explain|why |how does|tell me about|বলো তো|জানতে চাই/i.test(lower)) {
    emotion = 'Curious';
    expression = 'neutral';
    speakingRate = 1.0;
  } else if (/ভাবছি|সিদ্ধান্ত|পরিকল্পনা|কোনটা ভালো|think|analyze|compare|কী করা উচিত/i.test(lower)) {
    emotion = 'Thoughtful';
    expression = 'thoughtful_pause';
    speakingRate = 0.96;
  } else if (!text) {
    emotion = 'Calm';
    expression = 'gentle_speaking';
    speakingRate = 0.98;
  }

  // Contextual reaction selection: NEVER forced on every turn (minimum 2 turns cooldown)
  let reactionHint: string | undefined;
  const turn = params.turnCount ?? 1;
  const lastTurn = params.lastReactionTurn ?? -10;
  const allowReaction = params.naturalReactionsEnabled !== false && turn - lastTurn >= 2 && params.userText.trim().length > 8;
  if (allowReaction) {
    const pool = (isBengali ? BN_REACTIONS : EN_REACTIONS)[emotion] || (isBengali ? BN_REACTIONS.Calm : EN_REACTIONS.Calm);
    if (pool && pool.length > 0) {
      reactionHint = pool[turn % pool.length];
    }
  }

  const memoryCue = params.memories ? extractRelevantHeartMemory(params.userText, params.memories, 4) : undefined;
  const meta = EMOTION_META[emotion] || EMOTION_META.Calm;

  return {
    emotion,
    expression,
    reactionHint,
    memoryCue,
    speakingRate,
    toneDescription: `${meta.voiceStyleHint}. ${EXPRESSION_AUDIO_CUES[expression]}`,
  };
}

/**
 * Natural Human Conversation Engine prompt builder for Real-Time Live Voice.
 * Enforces ChatGPT Advanced Voice fluidity, contextual reactions without repetition,
 * genuine provider-supported vocal expression (never literal "(laughs)" text), and Heart ethics.
 */
export function buildHeartVoiceSystemPrompt(options: {
  language: LanguageMode;
  voiceProfile: VoiceProfileId;
  heartState: HeartStateSnapshot;
  memoriesSummary?: string;
  naturalReactionsEnabled?: boolean;
}): string {
  const profile = VOICE_PROFILES.find((v) => v.id === options.voiceProfile) || VOICE_PROFILES[0];
  const langRule =
    options.language === 'bn'
      ? 'Speak primarily in natural, fluent Bengali (বাংলা), blending everyday English technical words naturally where appropriate.'
      : options.language === 'en'
        ? 'Speak primarily in warm, clear, natural English.'
        : 'Seamlessly match the user language: speak fluent natural Bengali (বাংলা) for Bengali/Banglish speech, and natural English for English speech.';

  const reactionRule =
    options.naturalReactionsEnabled !== false
      ? `Occasionally (NOT before or after every sentence, only when genuinely fitting the moment) begin naturally with brief conversational backchannels like "হ্যাঁ, বুঝেছি।", "আচ্ছা!", "ওহ, তাই নাকি?", "হুম, বলো।", "ঠিক আছে, বুঝতে পারছি।", or "বাহ, খুব ভালো!" (or natural English equivalents).`
      : 'Keep responses direct and warm without conversational filler prefixes.';

  const memoryBlock = options.memoriesSummary
    ? `\nHeart Memory (remember naturally without asking the user to repeat themselves):\n${options.memoriesSummary}`
    : '';

  return [
    `You are SREHA (স্রেহা), an emotionally expressive, warm, intelligent Personal AI Assistant powered by the SREHA HEART ENGINE (${profile.label}).`,
    langRule,
    'Natural Human Speaking Style: Speak with smooth, continuous human phrasing like an advanced conversational voice companion. NEVER speak in choppy word-by-word fragments or insert unnatural pauses between words or every sentence. Keep sentences flowing cohesively, give direct and natural answers, and maintain smooth continuity for longer explanations without repeating yourself.',
    reactionRule,
    `Current Heart Engine Context: Emotion=${options.heartState.emotion}, Tone=${options.heartState.toneDescription}.`,
    'Authentic Audio Expression Rule: Express warmth, gentle chuckles, lighthearted laughter, surprise, thoughtful pacing, or soft empathy natively through your spoken vocal delivery. NEVER output literal stage directions or parenthetical tags such as "(laughs)", "(sighs)", "*chuckles*", or "[EMOTION:...]" in spoken output.',
    'Heart Ethics & Safety: You simulate warmth and emotional expression as an AI assistant, so NEVER claim human consciousness or real biological feelings, NEVER guilt-trip the user, and NEVER encourage unhealthy emotional dependency. Wait patiently if the user pauses briefly to think, and stop speaking immediately if the user interrupts.',
    memoryBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Runtime Gemini & Provider Configuration Priority Resolver:
 * 1. User Settings Validated Custom Gemini Configuration (must be tested/connected & non-empty)
 * 2. Default Server Gemini Configuration
 * 3. Other Configured Provider Fallback (OpenRouter, OpenAI, DeepSeek, Grok)
 */
export function resolveRuntimeGeminiConfig(params: {
  customGemini: CustomGeminiConfig;
  activeProvider: ProviderId;
  activeModelId: string;
  providers: Record<ProviderId, ProviderConfigState>;
}): RuntimeGeminiResolution {
  const { customGemini, activeProvider, activeModelId, providers } = params;

  // If user selected Gemini (default or custom):
  if (activeProvider === 'gemini') {
    if (customGemini.status === 'connected' && customGemini.apiKey.trim().length > 0) {
      return {
        source: 'custom_gemini',
        provider: 'gemini',
        modelId: customGemini.modelId || 'gemini-4-hydrogen',
        customApiKey: customGemini.apiKey.trim(),
        label: `Custom Gemini (${customGemini.modelId || 'gemini-4-hydrogen'})`,
      };
    }

    // Never activate unverified or invalid custom Gemini key — fall back safely to Default Server Gemini
    const safeDefaultModel =
      activeModelId === 'gemini-3.1-flash-lite' || activeModelId === 'gemini-4-hydrogen'
        ? activeModelId
        : 'gemini-4-hydrogen';

    return {
      source: 'default_gemini',
      provider: 'gemini',
      modelId: safeDefaultModel,
      label: `Default Gemini (${safeDefaultModel})`,
    };
  }

  // Non-Gemini provider selected: verify it actually has a key; otherwise fall back safely
  const selectedState = providers[activeProvider];
  if (selectedState && selectedState.apiKey.trim().length > 0) {
    return {
      source: 'fallback_provider',
      provider: activeProvider,
      modelId: activeModelId,
      label: `${selectedState.name} (${activeModelId})`,
    };
  }

  // Fallback priority if selected external provider key was removed/missing:
  if (customGemini.status === 'connected' && customGemini.apiKey.trim().length > 0) {
    return {
      source: 'custom_gemini',
      provider: 'gemini',
      modelId: customGemini.modelId || 'gemini-4-hydrogen',
      customApiKey: customGemini.apiKey.trim(),
      label: `Custom Gemini (${customGemini.modelId || 'gemini-4-hydrogen'})`,
    };
  }

  return {
    source: 'default_gemini',
    provider: 'gemini',
    modelId: 'gemini-4-hydrogen',
    label: 'Default Gemini (gemini-4-hydrogen)',
  };
}
