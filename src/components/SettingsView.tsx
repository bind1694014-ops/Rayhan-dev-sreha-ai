import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FolderCode,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  AIModelInfo,
  CustomGeminiConfig,
  EmotionType,
  LanguageMode,
  ProviderConfigState,
  ProviderId,
  RuntimeGeminiResolution,
  SrehaSettings,
  VoiceProfileId,
} from '../types/sreha';
import { EMOTION_META, VOICE_PROFILES } from '../utils/emotion';
import { SrehaOrb } from './SrehaOrb';

interface SettingsViewProps {
  settings: SrehaSettings;
  providers: Record<ProviderId, ProviderConfigState>;
  customGemini: CustomGeminiConfig;
  runtimeResolution: RuntimeGeminiResolution;
  loadingGeminiModels: boolean;
  openRouterModels: AIModelInfo[];
  loadingOrModels: boolean;
  orModelsError: string | null;
  onUpdateSettings: (patch: Partial<SrehaSettings>) => void;
  onSaveCustomGeminiKey: (key: string) => void;
  onSelectCustomGeminiModel: (modelId: string) => void;
  onTestCustomGemini: () => void;
  onRefreshGeminiModels: () => void;
  onRemoveCustomGeminiKey: () => void;
  onSaveProviderKey: (id: ProviderId, key: string) => void;
  onRemoveProviderKey: (id: ProviderId) => void;
  onTestProvider: (id: ProviderId) => void;
  onFetchOpenRouterModels: () => void;
  onClearAllHistory: () => void;
  onOpenAndroidExplorer: () => void;
}

const BYOK_PROVIDERS: ProviderId[] = ['openrouter', 'openai', 'deepseek', 'grok'];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  providers,
  customGemini,
  runtimeResolution,
  loadingGeminiModels,
  openRouterModels,
  loadingOrModels,
  orModelsError,
  onUpdateSettings,
  onSaveCustomGeminiKey,
  onSelectCustomGeminiModel,
  onTestCustomGemini,
  onRefreshGeminiModels,
  onRemoveCustomGeminiKey,
  onSaveProviderKey,
  onRemoveProviderKey,
  onTestProvider,
  onFetchOpenRouterModels,
  onClearAllHistory,
  onOpenAndroidExplorer,
}) => {
  const [draftCustomGeminiKey, setDraftCustomGeminiKey] = useState(customGemini.apiKey || '');
  const [showCustomGeminiKey, setShowCustomGeminiKey] = useState(false);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>(() => ({
    openrouter: providers.openrouter.apiKey,
    openai: providers.openai.apiKey,
    deepseek: providers.deepseek.apiKey,
    grok: providers.grok.apiKey,
  }));
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [previewingVoice, setPreviewingVoice] = useState<VoiceProfileId | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [previewEmotion, setPreviewEmotion] = useState<EmotionType>('Happy');
  const [confirmClear, setConfirmClear] = useState(false);

  const handlePreviewVoice = async (profileId: VoiceProfileId) => {
    const profile = VOICE_PROFILES.find((v) => v.id === profileId);
    if (!profile) return;
    setPreviewingVoice(profileId);
    setVoiceError(null);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: profile.sampleTextBn,
          voiceName: profile.geminiVoiceName,
          style: profile.description,
        }),
      });
      const json = (await res.json()) as { audioBase64?: string; error?: string };
      if (!res.ok || !json.audioBase64) {
        throw new Error(json.error || 'Voice preview failed.');
      }
      const audio = new Audio(`data:audio/wav;base64,${json.audioBase64}`);
      await audio.play();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Unable to play voice preview.');
    } finally {
      setPreviewingVoice(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-24 md:pb-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">
            SREHA Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AI Providers, OpenRouter Models, Voice Profiles, Emotion Engine, Theme & Native Android Export
          </p>
        </div>

        {/* Theme & Language */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
          <h2 className="text-base font-semibold font-display text-slate-900 dark:text-white">
            Appearance & Language
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1124]">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">Theme Mode</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {settings.theme === 'dark' ? 'Dark Navy (Default)' : 'Crisp Light'}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
              >
                {settings.theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>Switch to Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Switch to Dark</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1124]">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">Language</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Bilingual বাংলা & English
                </div>
              </div>
              <select
                value={settings.language}
                onChange={(e) => onUpdateSettings({ language: e.target.value as LanguageMode })}
                aria-label="Language setting"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="auto">Auto (বাংলা + EN)</option>
                <option value="bn">বাংলা Primary</option>
                <option value="en">English Primary</option>
              </select>
            </div>
          </div>
        </section>

        {/* AI Providers & API Configuration */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold font-display text-slate-900 dark:text-white">
              Multi-Provider AI Engine
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Google Gemini is pre-connected via AI Studio server runtime. Optional external keys are stored locally in browser vault (and Android Keystore in APK).
            </p>
          </div>

          {/* Google Gemini (Default Server-Managed) */}
          <div className="py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Google Gemini API (Default Configuration)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Runtime Priority: <span className="font-medium text-blue-600 dark:text-sky-400">{runtimeResolution.label}</span> · Default Status:{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {providers.gemini.status === 'error'
                    ? `Error: ${providers.gemini.errorMessage}`
                    : providers.gemini.status === 'testing'
                      ? 'Testing…'
                      : 'Ready'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onTestProvider('gemini')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1124] text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Test Default Gemini
            </button>
          </div>

          {/* Separate Custom Gemini API & Model Configuration */}
          <div
            className="p-4 rounded-xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 space-y-3"
            data-testid="separate-gemini-settings"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Custom Gemini API & Model Configuration
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Optional user-provided Gemini key (validated before activation; never overrides Default Gemini if untested or invalid).
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs">
                {customGemini.status === 'connected' && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Verified & Active (Priority 1)
                    </span>
                  </>
                )}
                {customGemini.status === 'error' && (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-rose-600 dark:text-rose-400">
                      Invalid Key (Default Gemini Active)
                    </span>
                  </>
                )}
                {customGemini.status === 'testing' && (
                  <span className="text-blue-500">Testing Connection…</span>
                )}
                {customGemini.status === 'unconfigured' && (
                  <span className="text-slate-500 dark:text-slate-400">
                    {customGemini.apiKey
                      ? 'Saved (Untested · Default Gemini Active)'
                      : 'Not Set (Using Default Gemini)'}
                  </span>
                )}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type={showCustomGeminiKey ? 'text' : 'password'}
                  value={draftCustomGeminiKey}
                  onChange={(e) => setDraftCustomGeminiKey(e.target.value)}
                  placeholder="Enter custom Gemini API key (e.g. AIza…)…"
                  aria-label="Custom Gemini API Key"
                  className="w-full pr-10 pl-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomGeminiKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showCustomGeminiKey ? 'Hide Custom Gemini key' : 'Show Custom Gemini key'}
                >
                  {showCustomGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSaveCustomGeminiKey(draftCustomGeminiKey)}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap"
                >
                  Save Key
                </button>
                <button
                  type="button"
                  onClick={onTestCustomGemini}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
                >
                  Test Connection
                </button>
                {customGemini.apiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftCustomGeminiKey('');
                      onRemoveCustomGeminiKey();
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500/10"
                    aria-label="Remove Custom Gemini key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label
                  htmlFor="custom-gemini-model-select"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap"
                >
                  Gemini Model:
                </label>
                <select
                  id="custom-gemini-model-select"
                  value={customGemini.modelId}
                  onChange={(e) => onSelectCustomGeminiModel(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-900 dark:text-white"
                >
                  {customGemini.availableModels.map((gm) => (
                    <option key={gm.id} value={gm.id}>
                      {gm.name} ({gm.id})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={onRefreshGeminiModels}
                disabled={loadingGeminiModels}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGeminiModels ? 'animate-spin' : ''}`} />
                <span>Refresh Models</span>
              </button>
            </div>

            {customGemini.errorMessage && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{customGemini.errorMessage}</p>
            )}
          </div>

          {/* BYOK Providers */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {BYOK_PROVIDERS.map((pid) => {
              const p = providers[pid];
              const isVisible = Boolean(visibleKeys[pid]);
              const draft = draftKeys[pid] ?? '';
              return (
                <div
                  key={pid}
                  className="py-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {p.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {p.status === 'connected' && (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                        </>
                      )}
                      {p.status === 'error' && (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span className="text-rose-600 dark:text-rose-400">Error</span>
                        </>
                      )}
                      {p.status === 'testing' && <span className="text-blue-500">Testing…</span>}
                      {p.status === 'unconfigured' && (
                        <span className="text-slate-500 dark:text-slate-400">
                          {p.apiKey ? 'Saved (Untested)' : 'Disabled (No Key)'}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={draft}
                        onChange={(e) =>
                          setDraftKeys((prev) => ({ ...prev, [pid]: e.target.value }))
                        }
                        placeholder={`Enter ${p.name} API key…`}
                        aria-label={`${p.name} API Key`}
                        className="w-full pr-10 pl-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-mono text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleKeys((prev) => ({ ...prev, [pid]: !prev[pid] }))
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label={isVisible ? `Hide ${p.name} key` : `Show ${p.name} key`}
                      >
                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSaveProviderKey(pid, draft)}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => onTestProvider(pid)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
                      >
                        Test
                      </button>
                      {p.apiKey && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftKeys((prev) => ({ ...prev, [pid]: '' }));
                            onRemoveProviderKey(pid);
                          }}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500/10"
                          aria-label={`Remove ${p.name} key`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {p.errorMessage && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{p.errorMessage}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* OpenRouter Live Models */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                OpenRouter Dynamic Models ({openRouterModels.length} loaded)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Refresh live catalog without updating the app.
              </div>
            </div>
            <button
              type="button"
              onClick={onFetchOpenRouterModels}
              disabled={loadingOrModels}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1124] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOrModels ? 'animate-spin' : ''}`} />
              <span>Refresh OpenRouter Models</span>
            </button>
          </div>
          {orModelsError && <p className="text-xs text-rose-500">{orModelsError}</p>}
        </section>

        {/* Voice Profiles */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold font-display text-slate-900 dark:text-white">
              Voice Selection (Live Voice & TTS)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select SREHA’s voice profile and preview spoken Bengali delivery.
            </p>
          </div>
          {voiceError && <p className="text-xs text-rose-500">{voiceError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VOICE_PROFILES.map((vp) => {
              const selected = settings.voiceProfile === vp.id;
              return (
                <div
                  key={vp.id}
                  className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                    selected
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/35'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1124]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {vp.label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {vp.labelBn}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {vp.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ voiceProfile: vp.id })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreviewVoice(vp.id)}
                      disabled={previewingVoice === vp.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{previewingVoice === vp.id ? 'Playing…' : 'Preview'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Emotion Engine */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
          <h2 className="text-base font-semibold font-display text-slate-900 dark:text-white">
            Emotion Engine & Orb Preview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-950 text-white">
              <SrehaOrb
                emotion={previewEmotion}
                isCryingEffect={settings.cryingEffectEnabled && (previewEmotion === 'Sad' || previewEmotion === 'Empathetic')}
                size="md"
              />
              <span className="mt-2 text-xs text-slate-300">
                {previewEmotion} · {EMOTION_META[previewEmotion].labelBn}
              </span>
            </div>

            <div className="md:col-span-8 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(EMOTION_META) as EmotionType[]).map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setPreviewEmotion(em)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      previewEmotion === em
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200 pt-1">
                <span>Enable Context-Aware Emotion Classification</span>
                <input
                  type="checkbox"
                  checked={settings.emotionEnabled}
                  onChange={(e) => onUpdateSettings({ emotionEnabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                <span>Emotion-Adapted Voice Delivery</span>
                <input
                  type="checkbox"
                  checked={settings.emotionVoiceDelivery}
                  onChange={(e) => onUpdateSettings({ emotionVoiceDelivery: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                <span>Expressive Crying Orb & Voice Presentation</span>
                <input
                  type="checkbox"
                  checked={settings.cryingEffectEnabled}
                  onChange={(e) => onUpdateSettings({ cryingEffectEnabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                <span>SREHA Heart Engine (Emotion & Personality Simulation)</span>
                <input
                  type="checkbox"
                  checked={settings.heartEngineEnabled !== false}
                  onChange={(e) => onUpdateSettings({ heartEngineEnabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                <span>Natural Conversational Reactions (Contextual Backchannels)</span>
                <input
                  type="checkbox"
                  checked={settings.naturalReactionsEnabled !== false}
                  onChange={(e) => onUpdateSettings({ naturalReactionsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
                <span>Active Listening Noise Handling</span>
                <select
                  value={settings.listeningSensitivity || 'balanced'}
                  onChange={(e) =>
                    onUpdateSettings({
                      listeningSensitivity: e.target.value as 'balanced' | 'sensitive' | 'noisy_room',
                    })
                  }
                  aria-label="Active listening sensitivity"
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1124] text-xs font-medium"
                >
                  <option value="balanced">Balanced (Default)</option>
                  <option value="sensitive">Quiet Room (Sensitive)</option>
                  <option value="noisy_room">Noisy Environment Filter</option>
                </select>
              </div>
              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                <span>Allow Saving Long-Term Memory (With Permission)</span>
                <input
                  type="checkbox"
                  checked={settings.memoryConsent}
                  onChange={(e) => onUpdateSettings({ memoryConsent: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Native Android Export & Data Management */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold font-display text-slate-900 dark:text-white">
              About SREHA & Native Android Build
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Download the 13-module Kotlin + Jetpack Compose Gradle project (`gradlew.bat assembleDebug`) or clear local chat history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenAndroidExplorer}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FolderCode className="w-4 h-4" />
              <span>Inspect Kotlin Source</span>
            </button>
            <a
              href="/api/android/download-zip"
              download="SREHA-AI-AGENT-Android.zip"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Download className="w-4 h-4" />
              <span>Download Android ZIP</span>
            </a>
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium"
              >
                Clear Chat History
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClearAllHistory();
                  setConfirmClear(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                Confirm Clear All
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
