import { EmotionType, VoiceProfile } from '../types/sreha';

export interface EmotionVisualMeta {
  type: EmotionType;
  labelBn: string;
  primaryColor: string;
  secondaryColor: string;
  glowRgba: string;
  pulseSpeed: number;
  waveAmplitude: number;
  voiceStyleHint: string;
}

export const EMOTION_META: Record<EmotionType, EmotionVisualMeta> = {
  Happy: {
    type: 'Happy',
    labelBn: 'আনন্দিত',
    primaryColor: '#38BDF8',
    secondaryColor: '#F472B6',
    glowRgba: 'rgba(56, 189, 248, 0.42)',
    pulseSpeed: 1.35,
    waveAmplitude: 1.25,
    voiceStyleHint: 'Warm, cheerful, bright, and lively tone',
  },
  Excited: {
    type: 'Excited',
    labelBn: 'উচ্ছ্বসিত',
    primaryColor: '#EC4899',
    secondaryColor: '#8B5CF6',
    glowRgba: 'rgba(236, 72, 153, 0.48)',
    pulseSpeed: 1.85,
    waveAmplitude: 1.6,
    voiceStyleHint: 'Energetic, enthusiastic, expressive rhythm',
  },
  Calm: {
    type: 'Calm',
    labelBn: 'শান্ত',
    primaryColor: '#3B82F6',
    secondaryColor: '#6366F1',
    glowRgba: 'rgba(59, 130, 246, 0.32)',
    pulseSpeed: 0.75,
    waveAmplitude: 0.8,
    voiceStyleHint: 'Steady, soothing, unhurried, and composed',
  },
  Caring: {
    type: 'Caring',
    labelBn: 'যত্নশীল',
    primaryColor: '#A855F7',
    secondaryColor: '#EC4899',
    glowRgba: 'rgba(168, 85, 247, 0.38)',
    pulseSpeed: 0.9,
    waveAmplitude: 0.95,
    voiceStyleHint: 'Gentle, affectionate, reassuring, and kind',
  },
  Curious: {
    type: 'Curious',
    labelBn: 'কৌতূহলী',
    primaryColor: '#06B6D4',
    secondaryColor: '#3B82F6',
    glowRgba: 'rgba(6, 182, 212, 0.40)',
    pulseSpeed: 1.25,
    waveAmplitude: 1.15,
    voiceStyleHint: 'Inquisitive, engaged, bright, and attentive',
  },
  Sad: {
    type: 'Sad',
    labelBn: 'বিষণ্ণ',
    primaryColor: '#60A5FA',
    secondaryColor: '#334155',
    glowRgba: 'rgba(96, 165, 250, 0.28)',
    pulseSpeed: 0.55,
    waveAmplitude: 0.55,
    voiceStyleHint: 'Soft, slow, tender, and softly melancholic',
  },
  Worried: {
    type: 'Worried',
    labelBn: 'উদ্বিগ্ন',
    primaryColor: '#818CF8',
    secondaryColor: '#475569',
    glowRgba: 'rgba(129, 140, 248, 0.30)',
    pulseSpeed: 0.65,
    waveAmplitude: 0.7,
    voiceStyleHint: 'Attentive, careful, concerned, and supportive',
  },
  Surprised: {
    type: 'Surprised',
    labelBn: 'বিস্মিত',
    primaryColor: '#22D3EE',
    secondaryColor: '#A855F7',
    glowRgba: 'rgba(34, 211, 238, 0.45)',
    pulseSpeed: 1.6,
    waveAmplitude: 1.45,
    voiceStyleHint: 'Bright, curious, slightly elevated pitch',
  },
  Upset: {
    type: 'Upset',
    labelBn: 'মন খারাপ',
    primaryColor: '#64748B',
    secondaryColor: '#6366F1',
    glowRgba: 'rgba(100, 116, 139, 0.34)',
    pulseSpeed: 0.6,
    waveAmplitude: 0.65,
    voiceStyleHint: 'Restrained, respectful, calm, and de-escalating',
  },
  Empathetic: {
    type: 'Empathetic',
    labelBn: 'সহানুভূতিশীল',
    primaryColor: '#8B5CF6',
    secondaryColor: '#38BDF8',
    glowRgba: 'rgba(139, 92, 246, 0.38)',
    pulseSpeed: 0.85,
    waveAmplitude: 0.9,
    voiceStyleHint: 'Deeply understanding, warm, patient, and respectful',
  },
  Playful: {
    type: 'Playful',
    labelBn: 'হাসিখুশি',
    primaryColor: '#F472B6',
    secondaryColor: '#38BDF8',
    glowRgba: 'rgba(244, 114, 182, 0.44)',
    pulseSpeed: 1.45,
    waveAmplitude: 1.3,
    voiceStyleHint: 'Lighthearted, witty, warm, and upbeat',
  },
  Thoughtful: {
    type: 'Thoughtful',
    labelBn: 'চিন্তাশীল',
    primaryColor: '#6366F1',
    secondaryColor: '#0EA5E9',
    glowRgba: 'rgba(99, 102, 241, 0.34)',
    pulseSpeed: 0.7,
    waveAmplitude: 0.8,
    voiceStyleHint: 'Measured, reflective, articulate, with natural brief pauses',
  },
};

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'natural',
    label: 'Sreha Natural',
    labelBn: 'স্রেহা ন্যাচারাল',
    geminiVoiceName: 'Zephyr',
    description: 'Balanced, conversational bilingual voice for daily assistance.',
    sampleTextBn: 'নমস্কার! আমি স্রেহা, আপনার ব্যক্তিগত এআই সহকারী। আজ আপনাকে কীভাবে সাহায্য করতে পারি?',
  },
  {
    id: 'soft',
    label: 'Sreha Soft',
    labelBn: 'স্রেহা সফট',
    geminiVoiceName: 'Kore',
    description: 'Gentle, empathetic tone suited for calm guidance and comfort.',
    sampleTextBn: 'চিন্তা করবেন না, আমি আপনার পাশে আছি। আমরা একসাথে বিষয়টি সমাধান করব।',
  },
  {
    id: 'expressive',
    label: 'Sreha Expressive',
    labelBn: 'স্রেহা এক্সপ্রেসিভ',
    geminiVoiceName: 'Puck',
    description: 'Lively, dynamic delivery with heightened emotional inflection.',
    sampleTextBn: 'বাহ, দারুণ খবর! চলুন এখনই নতুন আইডিয়া নিয়ে কাজ শুরু করি!',
  },
  {
    id: 'calm',
    labelBn: 'স্রেহা কাম',
    label: 'Sreha Calm',
    geminiVoiceName: 'Charon',
    description: 'Grounded, focused, steady cadence for deep work and study.',
    sampleTextBn: 'সব তথ্য গুছিয়ে নিয়েছি। শান্তভাবে ধাপে ধাপে এগোনো যাক।',
  },
];

const VALID_EMOTIONS = new Set<string>(Object.keys(EMOTION_META));

export interface ParsedEmotionResult {
  emotion: EmotionType;
  isCryingEffect: boolean;
  cleanText: string;
}

const EMOTION_TAG_REGEX = /^\s*\[EMOTION:([A-Za-z]+)(?:\|(CRYING))?\]\s*/i;

export function parseEmotionFromResponse(rawText: string): ParsedEmotionResult {
  const match = rawText.match(EMOTION_TAG_REGEX);
  if (match) {
    const rawEmotion = match[1];
    const normalized =
      rawEmotion.charAt(0).toUpperCase() + rawEmotion.slice(1).toLowerCase();
    const emotion: EmotionType = VALID_EMOTIONS.has(normalized)
      ? (normalized as EmotionType)
      : 'Calm';
    const isCryingEffect = Boolean(match[2]);
    const cleanText = rawText.replace(EMOTION_TAG_REGEX, '').trimStart();
    return { emotion, isCryingEffect, cleanText };
  }

  // Fallback heuristic when a provider omits the prefix tag
  const lower = rawText.toLowerCase();
  if (/দুঃখিত|কষ্ট|sorry|heartbreaking|miss you|ভালো লাগছে না/.test(lower)) {
    return { emotion: 'Empathetic', isCryingEffect: false, cleanText: rawText };
  }
  if (/দারুণ|অসাধারণ|congratulations|awesome|great news|!{2,}/.test(lower)) {
    return { emotion: 'Excited', isCryingEffect: false, cleanText: rawText };
  }
  if (/বাহ|শুভ|happy|glad|খুশি|ধন্যবাদ/.test(lower)) {
    return { emotion: 'Happy', isCryingEffect: false, cleanText: rawText };
  }
  if (/সতর্ক|উদ্বিগ্ন|careful|worried|risk/.test(lower)) {
    return { emotion: 'Worried', isCryingEffect: false, cleanText: rawText };
  }
  if (/কেন|কীভাবে|interesting|curious|জানতে চাই|\?/.test(lower)) {
    return { emotion: 'Curious', isCryingEffect: false, cleanText: rawText };
  }
  if (/ভাবছি|বিশ্লেষণ|thought|consider|ধাপে ধাপে/.test(lower)) {
    return { emotion: 'Thoughtful', isCryingEffect: false, cleanText: rawText };
  }
  return { emotion: 'Calm', isCryingEffect: false, cleanText: rawText };
}

export function buildSrehaSystemInstruction(options: {
  language: 'auto' | 'bn' | 'en';
  emotionEnabled: boolean;
  cryingEffectEnabled: boolean;
  memoriesSummary?: string;
}): string {
  const langRule =
    options.language === 'bn'
      ? 'Respond primarily in natural, warm Bengali (বাংলা), using English technical terms smoothly when helpful.'
      : options.language === 'en'
        ? 'Respond primarily in clear, natural English unless the user explicitly writes in Bengali.'
        : 'Automatically match the user language: reply in natural Bengali (বাংলা) when spoken/written to in Bengali or Banglish, and in English when addressed in English.';

  const emotionRule = options.emotionEnabled
    ? `At the very beginning of EVERY response, output an emotion classification tag on the first token in the exact format [EMOTION:Type] where Type is one of: Happy, Excited, Calm, Caring, Curious, Surprised, Sad, Worried, Empathetic, Playful, Thoughtful.${
        options.cryingEffectEnabled
          ? ' Only for deeply touching or sorrowful theatrical/empathetic moments when appropriate, you may use [EMOTION:Sad|CRYING] or [EMOTION:Empathetic|CRYING].'
          : ''
      } Do not explain the tag; follow it immediately with your natural reply.`
    : '';

  const memoryBlock = options.memoriesSummary
    ? `\n\nKnown User Context & Saved Memory (use naturally without repeatedly asking the same questions):\n${options.memoriesSummary}`
    : '';

  return [
    'You are SREHA (স্রেহা), an emotionally expressive, intelligent, calm, friendly, respectful, and context-aware Personal AI Assistant.',
    'Identity boundary: Always clearly identify yourself as an AI Assistant if asked. Never claim to be a real human.',
    'Safety & Emotional ethics: Never use harsh or rude language. If the user expresses anger or distress, stay calm, listen carefully, and respond with respectful empathy. Never manipulate the user, induce guilt, or encourage unhealthy emotional dependency.',
    langRule,
    emotionRule,
    memoryBlock,
  ]
    .filter(Boolean)
    .join('\n');
}
