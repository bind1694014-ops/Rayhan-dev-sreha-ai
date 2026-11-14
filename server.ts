import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { generateAndroidProjectFiles } from './src/utils/androidProjectGenerator';
import {
  analyzeConversationHeartState,
  buildHeartVoiceSystemPrompt,
} from './src/utils/heartEngine';
import {
  applySupportedTtsVocalBurst,
  sanitizeSpokenText,
  splitSentenceBoundaryChunks,
} from './src/utils/voiceDelivery';
import { EmotionType, LanguageMode, VoiceProfileId } from './src/types/sreha';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGeminiClient(overrideKey?: string, baseUrl?: string): GoogleGenAI {
  const apiKey = overrideKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(baseUrl ? { baseUrl } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_GEMINI_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const CURATED_GEMINI_MODELS = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini Flash (Default)',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
    description: 'Balanced high-speed multimodal & Bengali/English reasoning',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini Flash Lite',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
    description: 'Ultra-low-latency text & lightweight agent tasks',
  },
  {
    id: 'gemini-3.8-live',
    name: 'Gemini Live Native Audio',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    available: true,
    description: 'Real-time duplex spoken conversation model',
  },
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const server = http.createServer(app);

  // Health / Ping for Network Diagnostics & Speed Test
  app.get('/api/network/ping', (req, res) => {
    const sizeKb = Math.min(Number(req.query.sizeKb || 0), 512);
    if (sizeKb > 0) {
      const payload = 'S'.repeat(sizeKb * 1024);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-store');
      res.send(payload);
      return;
    }
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Separate Gemini Settings: Test Custom or Default Gemini API Key
  app.post('/api/gemini/test', async (req, res) => {
    const { apiKey, modelId } = req.body as { apiKey?: string; modelId?: string };
    const trimmedKey = apiKey?.trim();
    try {
      const testModel =
        trimmedKey && modelId
          ? modelId
          : modelId && VALID_GEMINI_MODELS.has(modelId)
            ? modelId
            : 'gemini-3.1-flash-lite';
      const ai = trimmedKey
        ? getGeminiClient(trimmedKey, 'https://generativelanguage.googleapis.com')
        : getGeminiClient();
      const result = await ai.models.generateContent({
        model: testModel,
        contents: 'Reply with OK',
      });
      res.json({
        ok: true,
        source: trimmedKey ? 'custom_gemini' : 'default_gemini',
        message: `Connected (${result.text?.trim() || 'Ready'})`,
      });
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Gemini API key verification failed.';
      try {
        const parsed = JSON.parse(msg) as { error?: { message?: string } };
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {
        // use raw message
      }
      res.status(400).json({
        ok: false,
        error: msg,
      });
    }
  });

  // Separate Gemini Settings: Refresh Gemini Models Catalog
  app.get('/api/gemini/models', async (req, res) => {
    const customKey = (req.headers['x-gemini-key'] as string | undefined)?.trim();
    try {
      if (!customKey) {
        res.json({ models: CURATED_GEMINI_MODELS, source: 'default_gemini', fetchedAt: Date.now() });
        return;
      }
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(customKey)}`
      );
      if (!upstream.ok) {
        const errText = await upstream.text();
        let cleanErr = errText.slice(0, 220);
        try {
          const parsed = JSON.parse(errText) as { error?: { message?: string } };
          if (parsed?.error?.message) cleanErr = parsed.error.message;
        } catch {
          // keep slice
        }
        res.status(upstream.status).json({
          error: `Gemini Models API error (${upstream.status}): ${cleanErr}`,
        });
        return;
      }
      const json = (await upstream.json()) as {
        models?: Array<{
          name: string;
          displayName?: string;
          description?: string;
          inputTokenLimit?: number;
          supportedGenerationMethods?: string[];
        }>;
      };
      const dynamicModels = (json.models || [])
        .filter((m) =>
          (m.supportedGenerationMethods || []).some(
            (method) => method === 'generateContent' || method === 'bidiGenerateContent'
          )
        )
        .map((m) => {
          const cleanId = m.name.replace(/^models\//, '');
          return {
            id: cleanId,
            name: m.displayName || cleanId,
            provider: 'gemini' as const,
            providerLabel: 'Google Gemini',
            contextLength: m.inputTokenLimit,
            available: true,
            description: m.description?.slice(0, 140),
          };
        })
        .slice(0, 40);

      res.json({
        models: dynamicModels.length > 0 ? dynamicModels : CURATED_GEMINI_MODELS,
        source: 'custom_gemini',
        fetchedAt: Date.now(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to refresh Gemini models.',
      });
    }
  });

  // Live OpenRouter Models API fetcher
  app.get('/api/openrouter/models', async (req, res) => {
    try {
      const authHeader = req.headers['x-provider-key'] as string | undefined;
      const headers: Record<string, string> = {
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'SREHA AI AGENT',
      };
      if (authHeader) {
        headers['Authorization'] = `Bearer ${authHeader}`;
      }
      const upstream = await fetch('https://openrouter.ai/api/v1/models', { headers });
      if (!upstream.ok) {
        const text = await upstream.text();
        res.status(upstream.status).json({ error: `OpenRouter API error (${upstream.status}): ${text}` });
        return;
      }
      const json = (await upstream.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          context_length?: number;
          pricing?: { prompt?: string; completion?: string };
          description?: string;
        }>;
      };
      const models = (json.data || []).slice(0, 120).map((m) => {
        const providerSlug = m.id.includes('/') ? m.id.split('/')[0] : 'openrouter';
        const isFree = m.pricing?.prompt === '0' && m.pricing?.completion === '0';
        return {
          id: m.id,
          name: m.name || m.id,
          provider: 'openrouter',
          providerLabel: `OpenRouter · ${providerSlug}`,
          contextLength: m.context_length,
          isFree,
          available: true,
          description: m.description?.slice(0, 140),
        };
      });
      res.json({ models, fetchedAt: Date.now() });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch OpenRouter models.',
      });
    }
  });

  // Test Provider Connection
  app.post('/api/providers/test', async (req, res) => {
    const { provider, apiKey } = req.body as { provider: string; apiKey?: string };
    try {
      if (provider === 'gemini') {
        const ai = getGeminiClient();
        const result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: 'Reply with OK',
        });
        res.json({ ok: true, message: `Connected (${result.text?.trim() || 'Ready'})` });
        return;
      }

      if (!apiKey || !apiKey.trim()) {
        res.status(400).json({ ok: false, error: 'API key is required to test this provider.' });
        return;
      }

      const endpoints: Record<string, { url: string; model: string }> = {
        openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-4o-mini' },
        openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
        deepseek: { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
        grok: { url: 'https://api.x.ai/v1/chat/completions', model: 'grok-2-latest' },
      };

      const target = endpoints[provider];
      if (!target) {
        res.status(400).json({ ok: false, error: `Unsupported provider: ${provider}` });
        return;
      }

      if (provider === 'openrouter') {
        const keyCheck = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${apiKey.trim()}` },
        });
        if (!keyCheck.ok) {
          const errText = await keyCheck.text();
          res.status(keyCheck.status).json({ ok: false, error: `OpenRouter key check failed: ${errText}` });
          return;
        }
        res.json({ ok: true, message: 'OpenRouter key verified' });
        return;
      }

      const upstream = await fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: target.model,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 8,
        }),
      });

      if (!upstream.ok) {
        const errBody = await upstream.text();
        res.status(upstream.status).json({
          ok: false,
          error: `HTTP ${upstream.status}: ${errBody.slice(0, 220)}`,
        });
        return;
      }
      res.json({ ok: true, message: `Connected (${provider})` });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Connection test failed.',
      });
    }
  });

  // Streaming Chat Proxy (SSE)
  app.post('/api/chat/stream', async (req, res) => {
    const {
      provider = 'gemini',
      modelId = 'gemini-4-hydrogen',
      systemInstruction = '',
      messages = [],
      attachments = [],
      apiKey,
    } = req.body as {
      provider: string;
      modelId: string;
      systemInstruction: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      attachments?: Array<{ name: string; mimeType: string; base64Data?: string; textPreview?: string }>;
      apiKey?: string;
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      if (provider === 'gemini') {
        const customKey = apiKey && apiKey !== 'server-managed' ? apiKey.trim() : undefined;
        const ai = customKey
          ? getGeminiClient(customKey, 'https://generativelanguage.googleapis.com')
          : getGeminiClient();
        const safeModel = customKey
          ? modelId || 'gemini-4-hydrogen'
          : VALID_GEMINI_MODELS.has(modelId)
            ? modelId
            : 'gemini-4-hydrogen';

        const contents = messages.map((m, idx) => {
          const isLastUser = idx === messages.length - 1 && m.role === 'user';
          const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
          if (isLastUser && attachments.length > 0) {
            for (const att of attachments) {
              if (att.base64Data && (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf')) {
                parts.push({
                  inlineData: {
                    mimeType: att.mimeType,
                    data: att.base64Data,
                  },
                });
              } else if (att.textPreview) {
                parts.push({ text: `[Attached file: ${att.name}]\n${att.textPreview.slice(0, 12000)}` });
              }
            }
          }
          parts.push({ text: m.content });
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts,
          };
        });

        const stream = await ai.models.generateContentStream({
          model: safeModel,
          contents,
          config: {
            systemInstruction,
            ...(safeModel === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            sendEvent({ delta: chunk.text });
          }
        }
        sendEvent({ done: true });
        res.end();
        return;
      }

      // External OpenAI-compatible providers (OpenRouter, OpenAI, DeepSeek, Grok)
      if (!apiKey || !apiKey.trim()) {
        sendEvent({ error: `${provider} API key is missing. Add it in Settings or switch to Google Gemini.` });
        res.end();
        return;
      }

      const endpoints: Record<string, string> = {
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        openai: 'https://api.openai.com/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/chat/completions',
        grok: 'https://api.x.ai/v1/chat/completions',
      };
      const url = endpoints[provider];
      if (!url) {
        sendEvent({ error: `Unsupported provider: ${provider}` });
        res.end();
        return;
      }

      const formattedMessages = [
        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
        ...messages.map((m, idx) => {
          const isLastUser = idx === messages.length - 1 && m.role === 'user';
          if (isLastUser && attachments.length > 0) {
            const notes = attachments
              .map((a) => (a.textPreview ? `[File ${a.name}]:\n${a.textPreview.slice(0, 6000)}` : `[Attached ${a.name}]`))
              .join('\n\n');
            return { role: m.role, content: `${notes}\n\n${m.content}` };
          }
          return { role: m.role, content: m.content };
        }),
      ];

      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
          ...(provider === 'openrouter'
            ? {
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'SREHA AI AGENT',
              }
            : {}),
        },
        body: JSON.stringify({
          model: modelId,
          messages: formattedMessages,
          stream: true,
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text();
        sendEvent({ error: `${provider} API error (${upstream.status}): ${errText.slice(0, 260)}` });
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              sendEvent({ delta });
            }
          } catch {
            // ignore partial SSE JSON
          }
        }
      }
      sendEvent({ done: true });
      res.end();
    } catch (err) {
      sendEvent({
        error: err instanceof Error ? err.message : 'Streaming failed.',
      });
      res.end();
    }
  });

  // TTS & Voice Preview (Gemini 3.8 Flash TTS / Flash Lite TTS with authentic prosody)
  app.post('/api/tts', async (req, res) => {
    const {
      text,
      voiceName = 'Zephyr',
      style = 'Warm, natural, friendly assistant',
      expression = 'neutral',
      customGeminiKey,
    } = req.body as {
      text: string;
      voiceName?: 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';
      style?: string;
      expression?: string;
      customGeminiKey?: string;
    };

    const cleanText = sanitizeSpokenText(text || '');
    if (!cleanText) {
      res.status(400).json({ error: 'Text is required for speech synthesis.' });
      return;
    }

    const useExpressiveModel =
      expression === 'natural_laughter' ||
      expression === 'soft_chuckle' ||
      expression === 'soft_breath' ||
      expression === 'thoughtful_pause';

    const customBaseUrl = customGeminiKey?.trim()
      ? 'https://generativelanguage.googleapis.com'
      : undefined;

    const attempts: Array<{ model: string; baseUrl?: string; apiVersion?: string; withMetadata: boolean }> = [
      {
        model: useExpressiveModel ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts',
        baseUrl: customBaseUrl,
        apiVersion: 'v1beta',
        withMetadata: true,
      },
      {
        model: 'gemini-3.8-flash-lite-tts',
        baseUrl: customBaseUrl,
        apiVersion: 'v1beta',
        withMetadata: false,
      },
      {
        model: 'gemini-3.8-flash-lite-tts',
        baseUrl: customBaseUrl,
        withMetadata: false,
      },
    ];

    let lastErr: unknown = null;
    for (const attempt of attempts) {
      try {
        const ai = new GoogleGenAI({
          apiKey: customGeminiKey?.trim() || process.env.GEMINI_API_KEY,
          httpOptions: {
            ...(attempt.baseUrl ? { baseUrl: attempt.baseUrl } : {}),
            ...(attempt.apiVersion ? { apiVersion: attempt.apiVersion } : {}),
            headers: { 'User-Agent': 'aistudio-build' },
          },
        });
        const preparedText = applySupportedTtsVocalBurst(
          cleanText.slice(0, 1200),
          (expression as Parameters<typeof applySupportedTtsVocalBurst>[1]) || 'neutral',
          attempt.model === 'gemini-3.8-flash-tts'
        );

        const response = await ai.models.generateContent({
          model: attempt.model,
          contents: [
            {
              role: 'user',
              parts: [
                attempt.withMetadata
                  ? {
                      text: preparedText,
                      speechMetadata: { style },
                    }
                  : { text: preparedText },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            ...(attempt.withMetadata
              ? {
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName },
                    },
                  },
                }
              : {}),
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          res.json({
            audioBase64: base64Audio,
            mimeType: 'audio/wav',
            model: attempt.model,
            expressiveSupported: attempt.model === 'gemini-3.8-flash-tts',
          });
          return;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    res.status(502).json({
      error:
        lastErr instanceof Error
          ? lastErr.message
          : 'No audio returned by Gemini TTS on this runtime.',
    });
  });

  // Vision / Document Analysis for File & Camera Agent
  app.post('/api/vision/analyze', async (req, res) => {
    const { prompt, mimeType, base64Data, textContent } = req.body as {
      prompt: string;
      mimeType?: string;
      base64Data?: string;
      textContent?: string;
    };

    try {
      const ai = getGeminiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (base64Data && mimeType) {
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
      if (textContent) {
        parts.push({ text: `Document Content:\n${textContent.slice(0, 20000)}` });
      }
      parts.push({ text: prompt || 'Analyze this file or image clearly in Bengali and English.' });

      const result = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
      });

      res.json({ analysis: result.text || 'No analysis generated.' });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Analysis failed.',
      });
    }
  });

  // Download Complete Native Android Kotlin + Jetpack Compose Project ZIP
  app.get('/api/android/download-zip', async (_req, res) => {
    try {
      const zip = new JSZip();
      const root = zip.folder('SREHA_AI_AGENT');
      const files = generateAndroidProjectFiles();
      for (const file of files) {
        root?.file(file.path, file.content);
      }
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="SREHA-AI-AGENT-Android.zip"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to build Android ZIP archive.',
      });
    }
  });

  // Real-Time Gemini Live API WebSocket Bridge (/live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host}`);
    if (reqUrl.pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost:3000'}`);
    const voiceName = (reqUrl.searchParams.get('voice') || 'Zephyr') as
      | 'Zephyr'
      | 'Kore'
      | 'Puck'
      | 'Charon';
    const lang = (reqUrl.searchParams.get('lang') || 'auto') as LanguageMode;
    const voiceProfile = (reqUrl.searchParams.get('profile') || 'natural') as VoiceProfileId;
    const initialEmotion = (reqUrl.searchParams.get('emotion') || 'Calm') as EmotionType;

    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let adaptiveMode = false;
    let handshakeComplete = false;
    let customGeminiKey: string | undefined;
    let customGeminiModel: string | undefined;
    let memoriesSummary: string | undefined;
    let naturalReactionsEnabled = true;
    let heartEngineEnabled = true;
    let turnCount = 0;
    let lastReactionTurn = -10;
    let currentHeartState = analyzeConversationHeartState({
      userText: '',
      previousEmotion: initialEmotion,
      naturalReactionsEnabled: true,
    });

    const pendingClientMessages: string[] = [];
    const adaptiveHistory: Array<{ role: 'user' | 'model'; text: string }> = [];

    // Wait briefly (max 140ms) for optional session_init frame containing custom validated Gemini key & Heart Memory
    let initResolve: (() => void) | null = null;
    const initPromise = new Promise<void>((resolve) => {
      initResolve = resolve;
      setTimeout(resolve, 140);
    });

    const emitHeartState = (userText: string, assistantText?: string) => {
      if (!heartEngineEnabled || clientWs.readyState !== WebSocket.OPEN) return;
      const next = analyzeConversationHeartState({
        userText,
        assistantText,
        previousEmotion: currentHeartState.emotion,
        turnCount,
        lastReactionTurn,
        naturalReactionsEnabled,
      });
      if (next.reactionHint) {
        lastReactionTurn = turnCount;
      }
      currentHeartState = next;
      clientWs.send(JSON.stringify({ heartState: next }));
    };

    const handleClientMessage = async (rawText: string) => {
      try {
        const msg = JSON.parse(rawText) as {
          type?: string;
          audio?: string;
          audioTurnWav?: string;
          sampleRate?: number;
          text?: string;
          customGeminiKey?: string;
          customGeminiModel?: string;
          memoriesSummary?: string;
          naturalReactionsEnabled?: boolean;
          heartEngineEnabled?: boolean;
        };

        if (msg.type === 'session_init') {
          return;
        }

        const aiRest = customGeminiKey
          ? getGeminiClient(customGeminiKey, 'https://generativelanguage.googleapis.com')
          : getGeminiClient();

        if (session && !adaptiveMode) {
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: `audio/pcm;rate=${msg.sampleRate && msg.sampleRate >= 8000 ? msg.sampleRate : 16000}`,
              },
            });
          } else if (msg.text) {
            turnCount += 1;
            emitHeartState(msg.text);
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: msg.text }] }],
              turnComplete: true,
            });
          }
          return;
        }

        if (adaptiveMode && (msg.audioTurnWav || msg.text)) {
          turnCount += 1;
          if (msg.text) {
            emitHeartState(msg.text);
          }

          const liveSystemPrompt = buildHeartVoiceSystemPrompt({
            language: lang,
            voiceProfile,
            heartState: currentHeartState,
            memoriesSummary,
            naturalReactionsEnabled,
          });

          const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
          if (msg.audioTurnWav) {
            userParts.push({ inlineData: { mimeType: 'audio/wav', data: msg.audioTurnWav } });
            userParts.push({
              text: 'Listen carefully to the user speech in the audio. Return strict JSON with keys "transcript" (exact transcript of what the user said, or "" if silent/noise) and "reply" (your smooth, natural human-like spoken reply as SREHA in the same language, with NO literal stage tags like (laughs) or (sighs), or "" if empty/noise).',
            });
          } else if (msg.text) {
            userParts.push({
              text: `User said: "${msg.text}". Return strict JSON with keys "transcript" (the user text) and "reply" (your smooth, natural human-like spoken reply as SREHA in the same language, with NO literal stage tags like (laughs) or (sighs)).`,
            });
          }

          const historyContents = adaptiveHistory.slice(-10).map((h) => ({
            role: h.role,
            parts: [{ text: h.text }],
          }));

          const resp = await aiRest.models.generateContent({
            model: customGeminiModel && !customGeminiModel.includes('live') ? customGeminiModel : 'gemini-4-hydrogen',
            contents: [...historyContents, { role: 'user', parts: userParts }],
            config: {
              systemInstruction: liveSystemPrompt,
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });

          const rawJson = (resp.text || '{}').trim();
          let parsed: { transcript?: string; reply?: string } = {};
          try {
            parsed = JSON.parse(rawJson);
          } catch {
            parsed = { transcript: msg.text || '', reply: rawJson };
          }

          const userTranscript = (parsed.transcript || '').trim();
          const cleanReply = sanitizeSpokenText(parsed.reply || '');

          if (!cleanReply) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
            return;
          }

          if (userTranscript && msg.audioTurnWav && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ inputTranscript: userTranscript }));
          }

          emitHeartState(userTranscript || msg.text || '', cleanReply);

          adaptiveHistory.push({ role: 'user', text: userTranscript || msg.text || '[voice]' });
          adaptiveHistory.push({ role: 'model', text: cleanReply });

          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ outputTranscript: cleanReply }));
          }

          // Natural Voice Delivery Controller: sentence-boundary chunks for smooth continuity
          const sentenceChunks = splitSentenceBoundaryChunks(cleanReply, 70);
          let sentAnyWav = false;

          for (const chunk of sentenceChunks) {
            if (clientWs.readyState !== WebSocket.OPEN) break;
            try {
              const ttsModel =
                currentHeartState.expression === 'natural_laughter' ||
                currentHeartState.expression === 'soft_chuckle'
                  ? 'gemini-3.8-flash-tts'
                  : 'gemini-3.8-flash-lite-tts';
              const ttsClient = customGeminiKey
                ? getGeminiClient(customGeminiKey, 'https://generativelanguage.googleapis.com')
                : getGeminiClient();

              const preparedChunk = applySupportedTtsVocalBurst(
                chunk.slice(0, 600),
                currentHeartState.expression,
                ttsModel === 'gemini-3.8-flash-tts'
              );

              const ttsRes = await ttsClient.models.generateContent({
                model: ttsModel,
                contents: [{ role: 'user', parts: [{ text: preparedChunk }] }],
                config: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName },
                    },
                  },
                },
              });
              const b64Wav = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (b64Wav && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ wavAudio: b64Wav }));
                sentAnyWav = true;
              }
            } catch {
              // Fallback cleanly to browser speech synthesis below
              break;
            }
          }

          if (!sentAnyWav && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                speakText: cleanReply,
                speakingRate: currentHeartState.speakingRate,
              })
            );
          }
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ turnComplete: true }));
          }
        }
      } catch (err) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Voice processing failed.',
            })
          );
        }
      }
    };

    clientWs.on('message', (raw) => {
      const rawText = raw.toString();
      if (!handshakeComplete) {
        try {
          const maybeInit = JSON.parse(rawText) as {
            type?: string;
            customGeminiKey?: string;
            customGeminiModel?: string;
            memoriesSummary?: string;
            naturalReactionsEnabled?: boolean;
            heartEngineEnabled?: boolean;
          };
          if (maybeInit.type === 'session_init') {
            if (maybeInit.customGeminiKey?.trim()) {
              customGeminiKey = maybeInit.customGeminiKey.trim();
            }
            if (maybeInit.customGeminiModel?.trim()) {
              customGeminiModel = maybeInit.customGeminiModel.trim();
            }
            if (maybeInit.memoriesSummary?.trim()) {
              memoriesSummary = maybeInit.memoriesSummary.trim();
            }
            if (typeof maybeInit.naturalReactionsEnabled === 'boolean') {
              naturalReactionsEnabled = maybeInit.naturalReactionsEnabled;
            }
            if (typeof maybeInit.heartEngineEnabled === 'boolean') {
              heartEngineEnabled = maybeInit.heartEngineEnabled;
            }
            initResolve?.();
            return;
          }
        } catch {
          // ignore
        }
        if (pendingClientMessages.length < 16) {
          pendingClientMessages.push(rawText);
        }
        return;
      }
      void handleClientMessage(rawText);
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // ignore close error
      }
      session = null;
    });

    await initPromise;

    const effectiveApiKey = customGeminiKey || process.env.GEMINI_API_KEY;
    if (!effectiveApiKey) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
        clientWs.close();
      }
      return;
    }

    const liveSystemPrompt = buildHeartVoiceSystemPrompt({
      language: lang,
      voiceProfile,
      heartState: currentHeartState,
      memoriesSummary,
      naturalReactionsEnabled,
    });

    const preferredLiveModel =
      customGeminiModel && customGeminiModel.includes('live')
        ? customGeminiModel
        : 'gemini-3.8-live';

    const candidates: Array<{ model: string; baseUrl?: string; apiVersion?: string }> = [
      { model: preferredLiveModel },
      { model: preferredLiveModel, baseUrl: 'https://generativelanguage.googleapis.com', apiVersion: 'v1beta' },
      { model: preferredLiveModel, baseUrl: 'https://generativelanguage.googleapis.com', apiVersion: 'v1alpha' },
      {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiVersion: 'v1beta',
      },
    ];

    let liveInputTranscriptBuf = '';
    let liveOutputTranscriptBuf = '';

    for (const candidate of candidates) {
      if (clientWs.readyState !== WebSocket.OPEN) return;
      let isActiveCandidate = false;
      try {
        const client = new GoogleGenAI({
          apiKey: effectiveApiKey,
          httpOptions: {
            ...(candidate.baseUrl ? { baseUrl: candidate.baseUrl } : {}),
            ...(candidate.apiVersion ? { apiVersion: candidate.apiVersion } : {}),
            headers: { 'User-Agent': 'aistudio-build' },
          },
        });

        const attemptSession = await client.live.connect({
          model: candidate.model,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            systemInstruction: liveSystemPrompt,
          },
          callbacks: {
            onopen: () => {
              // Wait for setupComplete (live.connect resolution) before signaling ready
            },
            onmessage: (message: LiveServerMessage) => {
              if (!isActiveCandidate || clientWs.readyState !== WebSocket.OPEN) return;
              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                liveInputTranscriptBuf += ` ${content.inputTranscription.text}`;
                clientWs.send(JSON.stringify({ inputTranscript: content.inputTranscription.text }));
              }
              if (content?.outputTranscription?.text) {
                const rawChunk = content.outputTranscription.text;
                const cleanChunk = rawChunk
                  .replace(/\[EMOTION:[^\]]+\]/gi, '')
                  .replace(/\((?:laughs?|chuckles?|sighs?|giggles?|smiles?|gasp|breath|pause)\)/gi, '')
                  .replace(/\*(?:laughs?|chuckles?|sighs?|giggles?|smiles?|gasp)\*/gi, '');
                liveOutputTranscriptBuf += cleanChunk;
                clientWs.send(JSON.stringify({ outputTranscript: cleanChunk }));
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
              }
              if (content?.interrupted) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }
              if (content?.turnComplete) {
                turnCount += 1;
                emitHeartState(liveInputTranscriptBuf.trim(), liveOutputTranscriptBuf.trim());
                liveInputTranscriptBuf = '';
                liveOutputTranscriptBuf = '';
                clientWs.send(JSON.stringify({ turnComplete: true }));
              }
            },
            onerror: (errEvent) => {
              if (!isActiveCandidate || clientWs.readyState !== WebSocket.OPEN) return;
              clientWs.send(
                JSON.stringify({
                  error: errEvent?.message || 'Gemini Live stream error.',
                })
              );
            },
            onclose: () => {
              if (!isActiveCandidate || clientWs.readyState !== WebSocket.OPEN) return;
              clientWs.send(JSON.stringify({ closed: true }));
            },
          },
        });

        session = attemptSession;
        isActiveCandidate = true;
        handshakeComplete = true;
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              ready: true,
              mode: 'native-live',
              source: customGeminiKey ? 'custom_gemini' : 'default_gemini',
              heartState: currentHeartState,
            })
          );
        }
        break;
      } catch (err) {
        console.warn(
          '[Live] Candidate unavailable:',
          candidate.model,
          candidate.apiVersion || 'default',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // If native Live WebSocket endpoint isn't reachable (e.g., proxy 404), keep continuous voice active via Gemini multimodal audio turn
    if (!session) {
      adaptiveMode = true;
      handshakeComplete = true;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            ready: true,
            mode: 'adaptive-voice',
            source: customGeminiKey ? 'custom_gemini' : 'default_gemini',
            heartState: currentHeartState,
          })
        );
      }
    }

    while (pendingClientMessages.length > 0 && clientWs.readyState === WebSocket.OPEN) {
      const queued = pendingClientMessages.shift();
      if (queued) {
        await handleClientMessage(queued);
      }
    }
  });

  // Vite middleware in dev, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SREHA AI AGENT server running on http://localhost:${PORT}`);
  });
}

startServer();
