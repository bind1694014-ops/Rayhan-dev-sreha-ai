export type EmotionType =
  | 'Happy'
  | 'Excited'
  | 'Calm'
  | 'Caring'
  | 'Curious'
  | 'Sad'
  | 'Worried'
  | 'Surprised'
  | 'Upset'
  | 'Empathetic'
  | 'Playful'
  | 'Thoughtful';

export type VoiceExpressionType =
  | 'natural_laughter'
  | 'soft_chuckle'
  | 'happy_tone'
  | 'excited_tone'
  | 'gentle_speaking'
  | 'thoughtful_pause'
  | 'caring_tone'
  | 'surprised_reaction'
  | 'empathetic_tone'
  | 'soft_breath'
  | 'neutral';

export type LiveIndicatorState =
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'reconnecting'
  | 'paused'
  | 'connecting'
  | 'error'
  | 'idle';

export interface HeartStateSnapshot {
  emotion: EmotionType;
  expression: VoiceExpressionType;
  reactionHint?: string;
  memoryCue?: string;
  speakingRate: number;
  toneDescription: string;
}

export interface CustomGeminiConfig {
  apiKey: string;
  modelId: string;
  status: 'unconfigured' | 'testing' | 'connected' | 'error';
  availableModels: AIModelInfo[];
  errorMessage?: string;
  lastChecked?: number;
}

export interface RuntimeGeminiResolution {
  source: 'custom_gemini' | 'default_gemini' | 'fallback_provider';
  provider: ProviderId;
  modelId: string;
  customApiKey?: string;
  label: string;
}

export type VoiceProfileId = 'natural' | 'soft' | 'expressive' | 'calm';

export type ProviderId = 'gemini' | 'openrouter' | 'openai' | 'deepseek' | 'grok';

export type NavTab = 'home' | 'chat' | 'tools' | 'memory' | 'settings';

export type ThemeMode = 'dark' | 'light';

export type LanguageMode = 'auto' | 'bn' | 'en';

export interface AIModelInfo {
  id: string;
  name: string;
  provider: ProviderId;
  providerLabel: string;
  contextLength?: number;
  isFree?: boolean;
  available: boolean;
  description?: string;
}

export interface ProviderConfigState {
  id: ProviderId;
  name: string;
  serverManaged?: boolean;
  apiKey: string;
  status: 'unconfigured' | 'testing' | 'connected' | 'error';
  errorMessage?: string;
  lastChecked?: number;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  base64Data?: string;
  textPreview?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  emotion?: EmotionType;
  isCryingEffect?: boolean;
  modelId?: string;
  provider?: ProviderId;
  attachments?: ChatAttachment[];
  isStreaming?: boolean;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export type MemoryCategory = 'preference' | 'note' | 'fact' | 'task_context' | 'conversation';

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  sensitiveConfirmed?: boolean;
}

export type AutomationStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface AutomationTask {
  id: string;
  title: string;
  command: string;
  steps: string[];
  scheduleLabel: string;
  triggerAt?: number;
  status: AutomationStatus;
  createdAt: number;
  lastRunAt?: number;
  errorLog?: string;
}

export interface PendingAgentAction {
  id: string;
  actionType:
    | 'reminder'
    | 'alarm'
    | 'timer'
    | 'open_url'
    | 'camera'
    | 'android_only_bridge';
  title: string;
  description: string;
  payload: Record<string, string | number>;
  nativeOnly?: boolean;
}

export interface VoiceProfile {
  id: VoiceProfileId;
  label: string;
  labelBn: string;
  geminiVoiceName: 'Zephyr' | 'Kore' | 'Puck' | 'Charon';
  description: string;
  sampleTextBn: string;
}

export interface SrehaSettings {
  theme: ThemeMode;
  language: LanguageMode;
  activeProvider: ProviderId;
  activeModelId: string;
  voiceProfile: VoiceProfileId;
  emotionEnabled: boolean;
  emotionVoiceDelivery: boolean;
  cryingEffectEnabled: boolean;
  memoryConsent: boolean;
  heartEngineEnabled?: boolean;
  naturalReactionsEnabled?: boolean;
  listeningSensitivity?: 'balanced' | 'sensitive' | 'noisy_room';
}

export interface AndroidProjectFile {
  path: string;
  module: string;
  language: 'kotlin' | 'gradle' | 'xml' | 'batch' | 'markdown' | 'properties';
  content: string;
}
