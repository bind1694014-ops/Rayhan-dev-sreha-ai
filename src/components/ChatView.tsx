import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  AudioLines,
  ChevronDown,
  Copy,
  Check,
  Paperclip,
  RefreshCw,
  Send,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  AIModelInfo,
  ChatAttachment,
  ChatMessage,
  EmotionType,
  ProviderConfigState,
  ProviderId,
  SrehaSettings,
  VoiceExpressionType,
} from '../types/sreha';
import { EMOTION_META, VOICE_PROFILES } from '../utils/emotion';
import { formatMessageTime, shouldAutoScroll } from '../utils/chatHelpers';
import { computeVoiceDeliveryParams, sanitizeSpokenText } from '../utils/voiceDelivery';
import { SrehaOrb } from './SrehaOrb';
import { MarkdownMessage } from './MarkdownMessage';

interface ChatViewProps {
  mode: 'home' | 'chat';
  messages: ChatMessage[];
  isStreaming: boolean;
  currentEmotion: EmotionType;
  isCryingEffect: boolean;
  settings: SrehaSettings;
  providers: Record<ProviderId, ProviderConfigState>;
  availableModels: AIModelInfo[];
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  onStopStreaming: () => void;
  onRegenerateLast: () => void;
  onOpenLiveVoice: () => void;
  onSelectModel: (provider: ProviderId, modelId: string) => void;
  onRefreshOpenRouter: () => void;
  onNavigateSettings: () => void;
  onNavigateChat?: () => void;
  customGeminiKey?: string;
}

const STARTER_PROMPTS = [
  'নমস্কার স্রেহা! আজ আমার কাজের পরিকল্পনা গুছিয়ে দাও।',
  'বাংলা এবং ইংরেজিতে সুন্দর একটি Python স্ক্রিপ্ট লিখে দাও।',
  'আমার মন একটু খারাপ, একটু শান্তভাবে কথা বলবে?',
  'Explain how Gemini Live API real-time audio works.',
];

export const ChatView: React.FC<ChatViewProps> = ({
  mode,
  messages,
  isStreaming,
  currentEmotion,
  isCryingEffect,
  settings,
  providers,
  availableModels,
  onSendMessage,
  onStopStreaming,
  onRegenerateLast,
  onOpenLiveVoice,
  onSelectModel,
  onRefreshOpenRouter,
  onNavigateSettings,
  onNavigateChat,
  customGeminiKey,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Track scroll position without interrupting user reading history
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = shouldAutoScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
    isNearBottomRef.current = near;
    setShowScrollBottom(!near && el.scrollHeight > el.clientHeight + 80);
  };

  // Auto-scroll only when near bottom or when a new user message is added
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'user' || isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' });
    }
  }, [messages, isStreaming]);

  // Auto-grow multiline composer
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 148)}px`;
  }, [input]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;
    isNearBottomRef.current = true;
    onSendMessage(trimmed || 'Please analyze the attached file.', attachments);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    const next: ChatAttachment[] = [];
    for (const file of files) {
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
          reader.readAsDataURL(file);
        });
        next.push({ id, name: file.name, mimeType: file.type, size: file.size, base64Data });
      } else {
        const textPreview = await file.text();
        next.push({
          id,
          name: file.name,
          mimeType: file.type || 'text/plain',
          size: file.size,
          textPreview: textPreview.slice(0, 12000),
        });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  const handleSpeakMessage = async (msg: ChatMessage) => {
    if (speakingId === msg.id) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      return;
    }
    const spokenText = sanitizeSpokenText(msg.content);
    if (!spokenText) return;

    setSpeakingId(msg.id);
    const profile =
      VOICE_PROFILES.find((v) => v.id === settings.voiceProfile) || VOICE_PROFILES[0];
    const activeEm = msg.emotion || 'Calm';
    const emotionMeta = EMOTION_META[activeEm] || EMOTION_META.Calm;
    const expression: VoiceExpressionType =
      activeEm === 'Playful'
        ? 'soft_chuckle'
        : activeEm === 'Happy'
          ? 'happy_tone'
          : activeEm === 'Caring' || activeEm === 'Worried'
            ? 'caring_tone'
            : activeEm === 'Empathetic' || activeEm === 'Sad'
              ? 'empathetic_tone'
              : activeEm === 'Excited'
                ? 'excited_tone'
                : activeEm === 'Surprised'
                  ? 'surprised_reaction'
                  : activeEm === 'Thoughtful'
                    ? 'thoughtful_pause'
                    : 'neutral';
    const delivery = computeVoiceDeliveryParams({
      emotion: activeEm,
      voiceProfile: settings.voiceProfile,
      expression,
      transportMode: 'tts',
    });
    const style = settings.emotionVoiceDelivery
      ? `${emotionMeta.voiceStyleHint}. ${delivery.intonationStyle}. ${msg.isCryingEffect ? 'Include gentle emotional trembling delivery.' : ''}`
      : profile.description;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText,
          voiceName: profile.geminiVoiceName,
          style,
          expression,
          customGeminiKey,
        }),
      });
      const json = (await res.json()) as { audioBase64?: string };
      if (res.ok && json.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${json.audioBase64}`);
        audio.onended = () => setSpeakingId(null);
        await audio.play();
        return;
      }
    } catch {
      // Fallback to browser SpeechSynthesis if available
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(spokenText);
      utter.rate = delivery.speakingRate;
      utter.pitch = delivery.pitch;
      utter.lang = /[\u0980-\u09FF]/.test(spokenText) ? 'bn-BD' : 'en-US';
      utter.onend = () => setSpeakingId(null);
      utter.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utter);
    } else {
      setSpeakingId(null);
    }
  };

  const activeModel =
    availableModels.find(
      (m) => m.id === settings.activeModelId && m.provider === settings.activeProvider
    ) || availableModels[0];

  const showHero = mode === 'home';

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Scrollable Chat / Home Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6"
        data-testid="chat-scroll-container"
      >
        {showHero || messages.length === 0 ? (
          <div className="max-w-2xl mx-auto min-h-full flex flex-col items-center justify-start sm:justify-center text-center py-3 sm:py-6">
            <SrehaOrb
              emotion={currentEmotion}
              isCryingEffect={isCryingEffect}
              isSpeaking={isStreaming}
              size="lg"
            />
            <h1 className="mt-5 text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 dark:text-white text-balance">
              নমস্কার! আমি স্রেহা (SREHA)
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-lg">
              আপনার ব্যক্তিগত, আবেগ-সচেতন এবং বাংলা-বান্ধব AI এজেন্ট। টেক্সট চ্যাট, লাইভ ভয়েস কথোপকথন, মেমোরি ও অটোমেশনের জন্য আমি প্রস্তুত।
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onOpenLiveVoice}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 hover:opacity-95 transition-opacity"
              >
                <AudioLines className="w-4 h-4" />
                <span>Start Live Voice</span>
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateChat?.()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>Resume Chat ({messages.length})</span>
                </button>
              )}
            </div>

            <div className="mt-7 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendMessage(prompt, [])}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] hover:border-blue-500/60 dark:hover:border-sky-400/50 text-xs sm:text-sm text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5 pb-4">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isLastAssistant =
                !isUser && index === messages.length - 1;
              const emMeta = msg.emotion ? EMOTION_META[msg.emotion] : null;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[78%] flex flex-col ${
                      isUser ? 'items-end' : 'items-start'
                    }`}
                  >
                    {!isUser && (
                      <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          SREHA
                        </span>
                        {emMeta && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: emMeta.primaryColor }}>
                              {emMeta.type} ({emMeta.labelBn})
                              {msg.isCryingEffect ? ' · Expressive' : ''}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatMessageTime(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-[#111936] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md'
                      }`}
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2 space-y-1 text-xs opacity-90">
                          {msg.attachments.map((a) => (
                            <div key={a.id} className="font-mono">
                              Attachment: {a.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.error ? (
                        <p className="text-sm text-rose-500 dark:text-rose-400">
                          {msg.error}
                        </p>
                      ) : isUser ? (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      ) : (
                        <MarkdownMessage
                          content={
                            msg.content || (msg.isStreaming ? 'Thinking…' : '')
                          }
                        />
                      )}
                    </div>

                    {isUser ? (
                      <span className="mt-1 text-[11px] text-slate-400 tabular-nums">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    ) : (
                      !msg.isStreaming &&
                      msg.content && (
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                            aria-label="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSpeakMessage(msg)}
                            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                            aria-label="Listen to response"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>{speakingId === msg.id ? 'Speaking…' : 'Speak'}</span>
                          </button>

                          {isLastAssistant && (
                            <button
                              type="button"
                              onClick={onRegenerateLast}
                              className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                              aria-label="Regenerate response"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Regenerate</span>
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scroll-to-bottom button when reading older messages */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute right-6 bottom-36 md:bottom-28 z-20 p-2.5 rounded-full bg-white dark:bg-[#111936] border border-slate-200 dark:border-slate-700 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Scroll to latest message"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Composer pinned safely above mobile nav / keyboard */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0B1124]/95 backdrop-blur-md px-3 sm:px-6 pt-2.5 pb-20 md:pb-4">
        <div className="max-w-3xl mx-auto relative">
          {/* Model Switcher Popover */}
          {showModelMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-80 max-w-[92vw] max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] shadow-2xl p-2 z-30">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-800 mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Switch AI Model
                </span>
                <button
                  type="button"
                  onClick={onRefreshOpenRouter}
                  className="text-xs text-blue-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh OpenRouter</span>
                </button>
              </div>
              <div className="space-y-1">
                {availableModels.map((model) => {
                  const providerState = providers[model.provider];
                  const isEnabled =
                    model.provider === 'gemini' || Boolean(providerState?.apiKey);
                  const isActive =
                    model.id === settings.activeModelId &&
                    model.provider === settings.activeProvider;
                  return (
                    <button
                      key={`${model.provider}:${model.id}`}
                      type="button"
                      disabled={!isEnabled}
                      onClick={() => {
                        onSelectModel(model.provider, model.id);
                        setShowModelMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-700 dark:text-sky-300 font-semibold'
                          : isEnabled
                            ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            : 'text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{model.name}</div>
                        <div className="text-[11px] opacity-75 truncate">
                          {model.providerLabel}
                          {model.contextLength ? ` · ${Math.round(model.contextLength / 1000)}k ctx` : ''}
                        </div>
                      </div>
                      {!isEnabled && (
                        <span className="text-[10px] shrink-0">Key Needed</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModelMenu(false);
                  onNavigateSettings();
                }}
                className="mt-2 w-full py-2 rounded-xl text-xs font-medium text-center text-blue-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Configure API Keys in Settings
              </button>
            </div>
          )}

          {/* Selected Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                >
                  <span className="truncate max-w-[160px]">{att.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                    }
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Composer Box */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#111936] p-2 shadow-sm">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFilePick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
                aria-label="Attach file or image"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="স্রেহাকে লিখুন (বাংলা বা ইংরেজি)…"
                aria-label="Message SREHA"
                className="flex-1 bg-transparent resize-none py-2 px-1 text-sm sm:text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none max-h-36"
              />

              <button
                type="button"
                onClick={onOpenLiveVoice}
                className="min-h-[40px] px-3 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white text-xs font-semibold hover:opacity-95 transition-opacity shrink-0"
                aria-label="Open Live Voice Mode"
              >
                <AudioLines className="w-4 h-4" />
                <span className="hidden sm:inline">Live</span>
              </button>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors shrink-0"
                  aria-label="Stop generating"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!input.trim() && attachments.length === 0}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setShowModelMenu((s) => !s)}
                className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Switch AI model"
              >
                <span className="font-medium truncate max-w-[200px]">
                  {activeModel?.name || settings.activeModelId}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <span className="hidden sm:inline">
                Enter to send · Shift+Enter for new line
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
