import { EmotionType, VoiceExpressionType, VoiceProfileId } from '../types/sreha';

export interface VoiceDeliveryParams {
  speakingRate: number;
  pitch: number;
  sentencePauseMs: number;
  intonationStyle: string;
  chunkBoundaryMode: 'sentence';
  supportsNativeVocalBursts: boolean;
}

/**
 * Computes delivery prosody, speaking rate, intonation, and inter-sentence timing
 * for the active emotion and voice profile without artificial choppy pauses.
 */
export function computeVoiceDeliveryParams(options: {
  emotion: EmotionType;
  voiceProfile: VoiceProfileId;
  expression?: VoiceExpressionType;
  transportMode?: 'native-live' | 'adaptive-voice' | 'tts' | 'browser-tts';
}): VoiceDeliveryParams {
  let speakingRate = 1.0;
  let pitch = 1.0;
  let sentencePauseMs = 140;
  let intonationStyle = 'Natural, smooth, fluent conversational flow';

  switch (options.voiceProfile) {
    case 'soft':
      speakingRate = 0.96;
      pitch = 1.02;
      intonationStyle = 'Gentle, soothing, empathetic warmth';
      break;
    case 'expressive':
      speakingRate = 1.04;
      pitch = 1.05;
      intonationStyle = 'Dynamic, expressive, lively cadence';
      break;
    case 'calm':
      speakingRate = 0.95;
      pitch = 0.98;
      intonationStyle = 'Composed, steady, focused cadence';
      break;
    default:
      speakingRate = 1.0;
      pitch = 1.0;
      break;
  }

  switch (options.emotion) {
    case 'Excited':
      speakingRate += 0.06;
      pitch += 0.06;
      sentencePauseMs = 100;
      break;
    case 'Happy':
    case 'Playful':
      speakingRate += 0.03;
      pitch += 0.04;
      sentencePauseMs = 115;
      break;
    case 'Surprised':
      speakingRate += 0.02;
      pitch += 0.07;
      sentencePauseMs = 120;
      break;
    case 'Sad':
    case 'Empathetic':
      speakingRate -= 0.06;
      pitch -= 0.04;
      sentencePauseMs = 200;
      break;
    case 'Caring':
    case 'Worried':
      speakingRate -= 0.04;
      pitch -= 0.01;
      sentencePauseMs = 170;
      break;
    case 'Thoughtful':
      speakingRate -= 0.03;
      sentencePauseMs = 190;
      break;
    case 'Curious':
      pitch += 0.03;
      sentencePauseMs = 130;
      break;
    default:
      break;
  }

  return {
    speakingRate: Number(Math.max(0.82, Math.min(1.18, speakingRate)).toFixed(2)),
    pitch: Number(Math.max(0.88, Math.min(1.15, pitch)).toFixed(2)),
    sentencePauseMs,
    intonationStyle,
    chunkBoundaryMode: 'sentence',
    supportsNativeVocalBursts:
      options.transportMode === 'native-live' || options.transportMode === 'tts',
  };
}

/**
 * Strips emotion classification prefixes, literal stage directions such as (laughs)/(sighs),
 * and markdown symbols so spoken output never reads artificial tags aloud.
 */
export function sanitizeSpokenText(raw: string): string {
  return raw
    .replace(/^\s*\[EMOTION:[^\]]+\]\s*/i, '')
    .replace(/\((?:laughs?|chuckles?|sighs?|giggles?|smiles?|gasp|breath|pause)\)/gi, ' ')
    .replace(/\*(?:laughs?|chuckles?|sighs?|giggles?|smiles?|gasp)\*/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[#>-]+\s+/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Splits spoken text strictly on natural sentence boundaries (। . ! ? \n)
 * and merges overly tiny fragments so streaming TTS keeps natural sentence continuity.
 */
export function splitSentenceBoundaryChunks(rawText: string, minChunkChars = 48): string[] {
  const clean = sanitizeSpokenText(rawText);
  if (!clean) return [];

  // Split after sentence-ending punctuation (supports Bengali dari '।' and standard punctuation)
  const rawSentences = clean
    .split(/(?<=[।.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSentences.length <= 1) {
    return rawSentences;
  }

  const merged: string[] = [];
  let buffer = '';

  for (const sentence of rawSentences) {
    buffer = buffer ? `${buffer} ${sentence}` : sentence;
    if (buffer.length >= minChunkChars) {
      merged.push(buffer);
      buffer = '';
    }
  }
  if (buffer) {
    if (merged.length > 0 && buffer.length < 24) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${buffer}`;
    } else {
      merged.push(buffer);
    }
  }

  return merged;
}

/**
 * Prepares expressive text for Gemini Flash TTS (`gemini-3.8-flash-tts`) ONLY when the
 * provider supports native vocal burst tokens (<laugh>, <breath>). Never leaks raw markers to UI.
 */
export function applySupportedTtsVocalBurst(
  spokenText: string,
  expression: VoiceExpressionType,
  supportsVocalBursts: boolean
): string {
  const clean = sanitizeSpokenText(spokenText);
  if (!supportsVocalBursts || !clean) return clean;
  if (expression === 'natural_laughter' || expression === 'soft_chuckle') {
    return `<laugh> ${clean}`;
  }
  if (expression === 'soft_breath' || expression === 'thoughtful_pause') {
    return `<breath> ${clean}`;
  }
  return clean;
}
