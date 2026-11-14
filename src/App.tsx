/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Home,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  AIModelInfo,
  AutomationTask,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  CustomGeminiConfig,
  EmotionType,
  MemoryItem,
  NavTab,
  ProviderConfigState,
  ProviderId,
  SrehaSettings,
} from './types/sreha';
import { buildSrehaSystemInstruction, parseEmotionFromResponse } from './utils/emotion';
import { deriveChatTitle, transitionAutomationStatus } from './utils/chatHelpers';
import { extractRelevantHeartMemory, resolveRuntimeGeminiConfig } from './utils/heartEngine';
import { ChatView } from './components/ChatView';
import { ToolsView } from './components/ToolsView';
import { MemoryView } from './components/MemoryView';
import { SettingsView } from './components/SettingsView';
import { LiveVoiceModal } from './components/LiveVoiceModal';
import { AndroidProjectDrawer } from './components/AndroidProjectDrawer';
import { PWAInstallButton } from './components/PWAInstallButton';

const STORAGE_KEYS = {
  settings: 'sreha_settings_v1',
  sessions: 'sreha_sessions_v1',
  memories: 'sreha_memories_v1',
  tasks: 'sreha_tasks_v1',
  providers: 'sreha_providers_v1',
  orModels: 'sreha_openrouter_models_v1',
  customGemini: 'sreha_custom_gemini_v1',
};

const DEFAULT_CUSTOM_GEMINI_MODELS: AIModelInfo[] = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini Flash (Default)',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini Flash Lite',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
  },
  {
    id: 'gemini-3.8-live',
    name: 'Gemini Live Native Audio',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
  },
];

const DEFAULT_CUSTOM_GEMINI: CustomGeminiConfig = {
  apiKey: '',
  modelId: 'gemini-4-hydrogen',
  status: 'unconfigured',
  availableModels: DEFAULT_CUSTOM_GEMINI_MODELS,
};

const DEFAULT_SETTINGS: SrehaSettings = {
  theme: 'dark',
  language: 'auto',
  activeProvider: 'gemini',
  activeModelId: 'gemini-4-hydrogen',
  voiceProfile: 'natural',
  emotionEnabled: true,
  emotionVoiceDelivery: true,
  cryingEffectEnabled: true,
  memoryConsent: true,
  heartEngineEnabled: true,
  naturalReactionsEnabled: true,
  listeningSensitivity: 'balanced',
};

const DEFAULT_PROVIDERS: Record<ProviderId, ProviderConfigState> = {
  gemini: { id: 'gemini', name: 'Google Gemini', serverManaged: true, apiKey: 'server-managed', status: 'connected' },
  openrouter: { id: 'openrouter', name: 'OpenRouter', apiKey: '', status: 'unconfigured' },
  openai: { id: 'openai', name: 'OpenAI', apiKey: '', status: 'unconfigured' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', apiKey: '', status: 'unconfigured' },
  grok: { id: 'grok', name: 'Grok (xAI)', apiKey: '', status: 'unconfigured' },
};

const BUILTIN_MODELS: AIModelInfo[] = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini Flash (Default)',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini Flash Lite',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    providerLabel: 'OpenAI',
    available: true,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    providerLabel: 'DeepSeek',
    available: true,
  },
  {
    id: 'grok-2-latest',
    name: 'Grok 2',
    provider: 'grok',
    providerLabel: 'Grok (xAI)',
    available: true,
  },
];

const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_seed_1',
    category: 'preference',
    title: 'Bilingual Assistant Preference',
    content: 'User communicates in both Bengali (বাংলা) and English; match language naturally.',
    createdAt: Date.now() - 86400_000,
    updatedAt: Date.now() - 86400_000,
    sensitiveConfirmed: true,
  },
];

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [androidDrawerOpen, setAndroidDrawerOpen] = useState(false);

  const [settings, setSettings] = useState<SrehaSettings>(() =>
    loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const loaded = loadJson<ChatSession[]>(STORAGE_KEYS.sessions, []);
    return loaded.length > 0
      ? loaded
      : [{ id: 'chat_initial', title: 'New Conversation', updatedAt: Date.now(), messages: [] }];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || 'chat_initial');
  const [memories, setMemories] = useState<MemoryItem[]>(() =>
    loadJson(STORAGE_KEYS.memories, INITIAL_MEMORIES)
  );
  const [tasks, setTasks] = useState<AutomationTask[]>(() =>
    loadJson(STORAGE_KEYS.tasks, [])
  );
  const [providers, setProviders] = useState<Record<ProviderId, ProviderConfigState>>(() =>
    loadJson(STORAGE_KEYS.providers, DEFAULT_PROVIDERS)
  );
  const [customGemini, setCustomGemini] = useState<CustomGeminiConfig>(() =>
    loadJson(STORAGE_KEYS.customGemini, DEFAULT_CUSTOM_GEMINI)
  );
  const [loadingGeminiModels, setLoadingGeminiModels] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<AIModelInfo[]>(() =>
    loadJson(STORAGE_KEYS.orModels, [])
  );
  const [loadingOrModels, setLoadingOrModels] = useState(false);
  const [orModelsError, setOrModelsError] = useState<string | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('Calm');
  const [isCryingEffect, setIsCryingEffect] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.providers, JSON.stringify(providers));
  }, [providers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.customGemini, JSON.stringify(customGemini));
  }, [customGemini]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.orModels, JSON.stringify(openRouterModels));
  }, [openRouterModels]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  const runtimeResolution = useMemo(
    () =>
      resolveRuntimeGeminiConfig({
        customGemini,
        activeProvider: settings.activeProvider,
        activeModelId: settings.activeModelId,
        providers,
      }),
    [customGemini, settings.activeProvider, settings.activeModelId, providers]
  );

  const availableModels = useMemo(
    () => [...BUILTIN_MODELS, ...openRouterModels],
    [openRouterModels]
  );

  const fetchOpenRouterModels = useCallback(async () => {
    setLoadingOrModels(true);
    setOrModelsError(null);
    try {
      const headers: Record<string, string> = {};
      if (providers.openrouter.apiKey) {
        headers['x-provider-key'] = providers.openrouter.apiKey;
      }
      const res = await fetch('/api/openrouter/models', { headers });
      const json = (await res.json()) as { models?: AIModelInfo[]; error?: string };
      if (!res.ok || !json.models) {
        throw new Error(json.error || 'Failed to fetch OpenRouter models.');
      }
      setOpenRouterModels(json.models);
    } catch (err) {
      setOrModelsError(err instanceof Error ? err.message : 'Unable to load OpenRouter models.');
    } finally {
      setLoadingOrModels(false);
    }
  }, [providers.openrouter.apiKey]);

  const createNewChat = () => {
    const fresh: ChatSession = {
      id: `chat_${Date.now()}`,
      title: 'New Conversation',
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setActiveTab('home');
    setCurrentEmotion('Calm');
    setIsCryingEffect(false);
    setSidebarOpen(false);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh: ChatSession = {
          id: `chat_${Date.now()}`,
          title: 'New Conversation',
          updatedAt: Date.now(),
          messages: [],
        };
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSessionId) {
        setActiveSessionId(next[0].id);
      }
      return next;
    });
  };

  const streamAssistantReply = async (
    targetSessionId: string,
    historyMessages: ChatMessage[],
    attachments: ChatAttachment[]
  ) => {
    const assistantMsgId = `msg_ai_${Date.now()}`;
    const placeholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      modelId: settings.activeModelId,
      provider: settings.activeProvider,
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? { ...s, updatedAt: Date.now(), messages: [...s.messages, placeholder] }
          : s
      )
    );

    const memoriesSummary =
      settings.memoryConsent && memories.length > 0
        ? memories
            .slice(0, 8)
            .map((m) => `- ${m.title}: ${m.content}`)
            .join('\n')
        : undefined;

    const systemInstruction = buildSrehaSystemInstruction({
      language: settings.language,
      emotionEnabled: settings.emotionEnabled,
      cryingEffectEnabled: settings.cryingEffectEnabled,
      memoriesSummary,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    try {
      const effectiveProvider = runtimeResolution.provider;
      const effectiveModelId = runtimeResolution.modelId;
      const providerKey =
        effectiveProvider === 'gemini'
          ? runtimeResolution.customApiKey
          : providers[effectiveProvider]?.apiKey;
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          provider: effectiveProvider,
          modelId: effectiveModelId,
          systemInstruction,
          messages: historyMessages.map((m) => ({ role: m.role, content: m.content })),
          attachments,
          apiKey: providerKey,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let rawAccumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;
          const evt = JSON.parse(jsonStr) as { delta?: string; error?: string; done?: boolean };

          if (evt.error) {
            throw new Error(evt.error);
          }

          if (evt.delta) {
            rawAccumulated += evt.delta;
            const parsed = settings.emotionEnabled
              ? parseEmotionFromResponse(rawAccumulated)
              : { emotion: 'Calm' as EmotionType, isCryingEffect: false, cleanText: rawAccumulated };

            setCurrentEmotion(parsed.emotion);
            setIsCryingEffect(parsed.isCryingEffect);

            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetSessionId
                  ? {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantMsgId
                          ? {
                              ...m,
                              content: parsed.cleanText,
                              emotion: parsed.emotion,
                              isCryingEffect: parsed.isCryingEffect,
                            }
                          : m
                      ),
                    }
                  : s
              )
            );
          }
        }
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, isStreaming: false } : m
                ),
              }
            : s
        )
      );
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        isStreaming: false,
                        error: isAbort
                          ? undefined
                          : err instanceof Error
                            ? err.message
                            : 'Failed to generate response.',
                      }
                    : m
                ),
              }
            : s
        )
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = (text: string, attachments: ChatAttachment[]) => {
    if (!activeSession) return;
    setActiveTab('chat');
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const updatedMessages = [...activeSession.messages, userMsg];
    const nextTitle =
      activeSession.messages.length === 0 ? deriveChatTitle(text) : activeSession.title;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? { ...s, title: nextTitle, updatedAt: Date.now(), messages: updatedMessages }
          : s
      )
    );

    streamAssistantReply(activeSession.id, updatedMessages, attachments);
  };

  const handleRegenerateLast = () => {
    if (!activeSession || isStreaming) return;
    const msgs = [...activeSession.messages];
    if (msgs.length === 0) return;
    if (msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop();
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? { ...s, messages: msgs } : s))
    );
    streamAssistantReply(activeSession.id, msgs, []);
  };

  const handleSaveProviderKey = (id: ProviderId, key: string) => {
    const trimmed = key.trim();
    setProviders((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        apiKey: trimmed,
        status: trimmed ? 'unconfigured' : 'unconfigured',
        errorMessage: undefined,
      },
    }));
    if (id === 'openrouter' && trimmed) {
      fetchOpenRouterModels();
    }
  };

  const handleRemoveProviderKey = (id: ProviderId) => {
    setProviders((prev) => ({
      ...prev,
      [id]: { ...prev[id], apiKey: '', status: 'unconfigured', errorMessage: undefined },
    }));
    if (settings.activeProvider === id) {
      setSettings((s) => ({ ...s, activeProvider: 'gemini', activeModelId: 'gemini-4-hydrogen' }));
    }
  };

  const handleSaveCustomGeminiKey = (key: string) => {
    const trimmed = key.trim();
    setCustomGemini((prev) => ({
      ...prev,
      apiKey: trimmed,
      status: 'unconfigured', // Must be tested before activating
      errorMessage: undefined,
    }));
  };

  const handleRefreshGeminiModels = async (overrideKey?: string) => {
    const keyToUse = (overrideKey ?? customGemini.apiKey).trim();
    setLoadingGeminiModels(true);
    try {
      const headers: Record<string, string> = {};
      if (keyToUse) {
        headers['x-gemini-key'] = keyToUse;
      }
      const res = await fetch('/api/gemini/models', { headers });
      const json = (await res.json()) as { models?: AIModelInfo[]; error?: string };
      if (!res.ok || !json.models) {
        throw new Error(json.error || 'Failed to refresh Gemini models.');
      }
      setCustomGemini((prev) => ({
        ...prev,
        availableModels: json.models || DEFAULT_CUSTOM_GEMINI_MODELS,
        errorMessage: undefined,
      }));
    } catch (err) {
      setCustomGemini((prev) => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Unable to refresh Gemini models.',
      }));
    } finally {
      setLoadingGeminiModels(false);
    }
  };

  const handleTestCustomGemini = async () => {
    const key = customGemini.apiKey.trim();
    if (!key) {
      setCustomGemini((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Please enter and save a Gemini API key first.',
      }));
      return;
    }
    setCustomGemini((prev) => ({ ...prev, status: 'testing', errorMessage: undefined }));
    try {
      const res = await fetch('/api/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, modelId: customGemini.modelId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Gemini API key verification failed.');
      }
      setCustomGemini((prev) => ({
        ...prev,
        status: 'connected',
        lastChecked: Date.now(),
        errorMessage: undefined,
      }));
      void handleRefreshGeminiModels(key);
    } catch (err) {
      setCustomGemini((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Verification failed.',
      }));
    }
  };

  const handleRemoveCustomGeminiKey = () => {
    setCustomGemini({
      ...DEFAULT_CUSTOM_GEMINI,
    });
  };

  const handleTestProvider = async (id: ProviderId) => {
    setProviders((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: 'testing', errorMessage: undefined },
    }));
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id, apiKey: providers[id].apiKey }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Connection failed');
      }
      setProviders((prev) => ({
        ...prev,
        [id]: { ...prev[id], status: 'connected', lastChecked: Date.now(), errorMessage: undefined },
      }));
    } catch (err) {
      setProviders((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Test failed',
        },
      }));
    }
  };

  const navItems: Array<{ id: NavTab; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-slate-50 text-slate-900 dark:bg-[#070B19] dark:text-slate-100 overflow-hidden">
      {/* Top Bar (3-zone contract) */}
      <header className="shrink-0 h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B1124]/90 backdrop-blur-md flex items-center justify-between gap-8 z-30">
        {/* Zone 1: Brand mark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open chat history"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setDesktopSidebarOpen((v) => !v)}
            className="hidden md:inline-flex p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle chat sidebar"
          >
            {desktopSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-base sm:text-lg font-bold font-display tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-pink-500 bg-clip-text text-transparent whitespace-nowrap shrink-0"
          >
            SREHA AI
          </button>
        </div>

        {/* Zone 2: 5 single-line nav links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  active
                    ? 'text-blue-600 dark:text-sky-400 border-blue-600 dark:border-sky-400'
                    : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="shrink-0 flex items-center gap-2">
          <PWAInstallButton />
          <button
            type="button"
            onClick={createNewChat}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Main Content Shell */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Desktop Chat History Sidebar */}
        {desktopSidebarOpen && (
          <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1124] p-3">
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Chat History
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 mt-1">
              {sessions.map((s) => {
                const active = s.id === activeSession?.id && (activeTab === 'chat' || activeTab === 'home');
                return (
                  <div
                    key={s.id}
                    className={`group flex items-center justify-between gap-1 rounded-xl px-2.5 py-2 text-xs transition-colors ${
                      active
                        ? 'bg-blue-600/12 text-blue-700 dark:text-sky-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setActiveTab(s.messages.length > 0 ? 'chat' : 'home');
                      }}
                      className="flex-1 text-left truncate"
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity"
                      aria-label={`Delete chat ${s.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <button
                type="button"
                onClick={() => setAndroidDrawerOpen(true)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                Android APK Source & ZIP
              </button>
            </div>
          </aside>
        )}

        {/* Mobile History Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="relative w-72 max-w-[82vw] h-full bg-white dark:bg-[#0B1124] border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col z-10">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-sm font-bold font-display">Chat History</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500"
                  aria-label="Close chat history"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 mt-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setActiveTab(s.messages.length > 0 ? 'chat' : 'home');
                        setSidebarOpen(false);
                      }}
                      className="flex-1 text-left text-xs truncate"
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(s.id)}
                      className="p-1 text-slate-400 hover:text-rose-500"
                      aria-label={`Delete chat ${s.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  setAndroidDrawerOpen(true);
                }}
                className="mt-3 w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold"
              >
                Android Kotlin Project & ZIP
              </button>
            </aside>
          </div>
        )}

        {/* Active View */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {(activeTab === 'home' || activeTab === 'chat') && activeSession && (
            <ChatView
              mode={activeTab}
              messages={activeSession.messages}
              isStreaming={isStreaming}
              currentEmotion={currentEmotion}
              isCryingEffect={isCryingEffect}
              settings={settings}
              providers={providers}
              availableModels={availableModels}
              onSendMessage={handleSendMessage}
              onStopStreaming={() => abortControllerRef.current?.abort()}
              onRegenerateLast={handleRegenerateLast}
              onOpenLiveVoice={() => setLiveVoiceOpen(true)}
              onSelectModel={(provider, modelId) =>
                setSettings((s) => ({ ...s, activeProvider: provider, activeModelId: modelId }))
              }
              onRefreshOpenRouter={fetchOpenRouterModels}
              onNavigateSettings={() => setActiveTab('settings')}
              onNavigateChat={() => setActiveTab('chat')}
              customGeminiKey={
                customGemini.status === 'connected' ? customGemini.apiKey.trim() : undefined
              }
            />
          )}

          {activeTab === 'tools' && (
            <ToolsView
              tasks={tasks}
              onCreateTask={(task) => setTasks((prev) => [task, ...prev])}
              onTaskAction={(id, action) =>
                setTasks((prev) =>
                  prev.map((t) => (t.id === id ? transitionAutomationStatus(t, action) : t))
                )
              }
              onDeleteTask={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
              onOpenAndroidExplorer={() => setAndroidDrawerOpen(true)}
              onSaveToMemory={(title, content) => {
                if (!settings.memoryConsent) return;
                setMemories((prev) => [
                  {
                    id: `mem_${Date.now()}`,
                    category: 'task_context',
                    title,
                    content,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    sensitiveConfirmed: true,
                  },
                  ...prev,
                ]);
              }}
            />
          )}

          {activeTab === 'memory' && (
            <MemoryView
              memories={memories}
              memoryConsent={settings.memoryConsent}
              onAddMemory={(item) =>
                setMemories((prev) => [
                  {
                    ...item,
                    id: `mem_${Date.now()}`,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  },
                  ...prev,
                ])
              }
              onDeleteMemory={(id) => setMemories((prev) => prev.filter((m) => m.id !== id))}
              onRestoreBackup={(items) => setMemories(items)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              providers={providers}
              customGemini={customGemini}
              runtimeResolution={runtimeResolution}
              loadingGeminiModels={loadingGeminiModels}
              openRouterModels={openRouterModels}
              loadingOrModels={loadingOrModels}
              orModelsError={orModelsError}
              onUpdateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              onSaveCustomGeminiKey={handleSaveCustomGeminiKey}
              onSelectCustomGeminiModel={(modelId) =>
                setCustomGemini((prev) => ({ ...prev, modelId }))
              }
              onTestCustomGemini={handleTestCustomGemini}
              onRefreshGeminiModels={() => handleRefreshGeminiModels()}
              onRemoveCustomGeminiKey={handleRemoveCustomGeminiKey}
              onSaveProviderKey={handleSaveProviderKey}
              onRemoveProviderKey={handleRemoveProviderKey}
              onTestProvider={handleTestProvider}
              onFetchOpenRouterModels={fetchOpenRouterModels}
              onClearAllHistory={() => {
                const fresh: ChatSession = {
                  id: `chat_${Date.now()}`,
                  title: 'New Conversation',
                  updatedAt: Date.now(),
                  messages: [],
                };
                setSessions([fresh]);
                setActiveSessionId(fresh.id);
              }}
              onOpenAndroidExplorer={() => setAndroidDrawerOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 destinations, compact <= 64px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-[#0B1124]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
        aria-label="Mobile navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? 'text-blue-600 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <LiveVoiceModal
        open={liveVoiceOpen}
        onClose={() => setLiveVoiceOpen(false)}
        voiceProfile={settings.voiceProfile}
        language={settings.language}
        emotion={currentEmotion}
        heartEngineEnabled={settings.heartEngineEnabled !== false}
        naturalReactionsEnabled={settings.naturalReactionsEnabled !== false}
        listeningSensitivity={settings.listeningSensitivity || 'balanced'}
        memoriesSummary={
          settings.memoryConsent && memories.length > 0
            ? extractRelevantHeartMemory('', memories, 6)
            : undefined
        }
        customGeminiKey={
          customGemini.status === 'connected' ? customGemini.apiKey.trim() : undefined
        }
        customGeminiModel={
          customGemini.status === 'connected' ? customGemini.modelId : undefined
        }
        onEmotionChange={(em) => setCurrentEmotion(em)}
        onMemorySave={(item) => {
          if (!settings.memoryConsent) return;
          setMemories((prev) => [
            {
              id: `mem_heart_${Date.now()}`,
              category: item.category,
              title: item.title,
              content: item.content,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              sensitiveConfirmed: true,
            },
            ...prev,
          ]);
        }}
        onTranscriptSave={(userText, assistantText) => {
          if (!activeSession) return;
          const newMsgs: ChatMessage[] = [];
          if (userText.trim()) {
            newMsgs.push({
              id: `lv_u_${Date.now()}`,
              role: 'user',
              content: userText.trim(),
              timestamp: Date.now(),
            });
          }
          if (assistantText.trim()) {
            newMsgs.push({
              id: `lv_a_${Date.now() + 1}`,
              role: 'assistant',
              content: assistantText.trim(),
              timestamp: Date.now(),
              emotion: currentEmotion,
            });
          }
          if (newMsgs.length > 0) {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSession.id
                  ? {
                      ...s,
                      title:
                        s.messages.length === 0 && userText
                          ? deriveChatTitle(userText)
                          : s.title,
                      updatedAt: Date.now(),
                      messages: [...s.messages, ...newMsgs],
                    }
                  : s
              )
            );
          }
        }}
      />

      <AndroidProjectDrawer
        open={androidDrawerOpen}
        onClose={() => setAndroidDrawerOpen(false)}
      />
    </div>
  );
}
