import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Heart,
  Loader2,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  RefreshCw,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import {
  EmotionType,
  HeartStateSnapshot,
  LanguageMode,
  LiveIndicatorState,
  VoiceProfileId,
} from '../types/sreha';
import { EMOTION_META, VOICE_PROFILES } from '../utils/emotion';
import {
  analyzeConversationHeartState,
  extractHeartMemoryCandidate,
} from '../utils/heartEngine';
import { computeVoiceDeliveryParams, sanitizeSpokenText } from '../utils/voiceDelivery';
import { SrehaOrb } from './SrehaOrb';

interface LiveVoiceModalProps {
  open: boolean;
  onClose: () => void;
  voiceProfile: VoiceProfileId;
  language: LanguageMode;
  emotion: EmotionType;
  heartEngineEnabled?: boolean;
  naturalReactionsEnabled?: boolean;
  listeningSensitivity?: 'balanced' | 'sensitive' | 'noisy_room';
  memoriesSummary?: string;
  customGeminiKey?: string;
  customGeminiModel?: string;
  onEmotionChange?: (emotion: EmotionType) => void;
  onMemorySave?: (item: { title: string; content: string; category: 'preference' | 'task_context' | 'fact' }) => void;
  onTranscriptSave?: (userText: string, assistantText: string) => void;
}

function floatTo16BitPCMBase64(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeFloat32ToWavBase64(chunks: Float32Array[], sampleRate = 16000): string {
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const buffer = new ArrayBuffer(44 + totalLen * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + totalLen * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, totalLen * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64PCMToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const len = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  open,
  onClose,
  voiceProfile,
  language,
  emotion,
  heartEngineEnabled = true,
  naturalReactionsEnabled = true,
  listeningSensitivity = 'balanced',
  memoriesSummary,
  customGeminiKey,
  customGeminiModel,
  onEmotionChange,
  onMemorySave,
  onTranscriptSave,
}) => {
  const [status, setStatus] = useState<LiveIndicatorState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transportMode, setTransportMode] = useState<'native-live' | 'adaptive-voice'>('native-live');
  const [heartState, setHeartState] = useState<HeartStateSnapshot>(() =>
    analyzeConversationHeartState({ userText: '', previousEmotion: emotion })
  );
  const [transcripts, setTranscripts] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [fallbackInput, setFallbackInput] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const pausedRef = useRef<boolean>(false);
  const statusRef = useRef<LiveIndicatorState>('idle');
  const reconnectAttemptsRef = useRef<number>(0);
  const voiceModeRef = useRef<'native-live' | 'adaptive-voice'>('native-live');
  const vadBufferRef = useRef<Float32Array[]>([]);
  const vadSpeakingRef = useRef<boolean>(false);
  const vadLastSpeechAtRef = useRef<number>(0);
  const vadStartAtRef = useRef<number>(0);
  const noiseFloorRef = useRef<number>(0.008);
  const interruptTimerRef = useRef<number | null>(null);
  const savedMemoryTextsRef = useRef<Set<string>>(new Set());

  const profile = VOICE_PROFILES.find((v) => v.id === voiceProfile) || VOICE_PROFILES[0];
  const activeEmotion = heartEngineEnabled ? heartState.emotion : emotion;
  const activeEmotionMeta = EMOTION_META[activeEmotion] || EMOTION_META.Calm;
  const deliveryParams = computeVoiceDeliveryParams({
    emotion: activeEmotion,
    voiceProfile,
    expression: heartState.expression,
    transportMode,
  });

  const initialEmotionRef = useRef(emotion);
  initialEmotionRef.current = emotion;
  const memoriesSummaryRef = useRef(memoriesSummary);
  memoriesSummaryRef.current = memoriesSummary;
  const deliveryParamsRef = useRef(deliveryParams);
  deliveryParamsRef.current = deliveryParams;
  const onEmotionChangeRef = useRef(onEmotionChange);
  onEmotionChangeRef.current = onEmotionChange;
  const onMemorySaveRef = useRef(onMemorySave);
  onMemorySaveRef.current = onMemorySave;

  const stopPlaybackQueue = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const teardownSession = useCallback(() => {
    if (interruptTimerRef.current !== null) {
      window.clearTimeout(interruptTimerRef.current);
      interruptTimerRef.current = null;
    }
    stopPlaybackQueue();
    try {
      processorRef.current?.disconnect();
    } catch {
      // ignore
    }
    processorRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    try {
      inputCtxRef.current?.close();
    } catch {
      // ignore
    }
    inputCtxRef.current = null;

    try {
      outputCtxRef.current?.close();
    } catch {
      // ignore
    }
    outputCtxRef.current = null;

    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, [stopPlaybackQueue]);

  const schedulePCMPlayback = useCallback((base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }

    const pcm = base64PCMToFloat32(base64Audio);
    if (pcm.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, pcm.length, 24000);
    audioBuffer.copyToChannel(new Float32Array(pcm), 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.015, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0 && !pausedRef.current && statusRef.current === 'speaking') {
        statusRef.current = 'listening';
        setStatus('listening');
      }
    };
    source.start(startAt);
  }, []);

  const scheduleWavPlayback = useCallback((base64Wav: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    const binary = atob(base64Wav);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    ctx.decodeAudioData(bytes.buffer.slice(0))
      .then((buf) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);

        // Sentence-boundary gapless continuity across consecutive WAV chunks
        const now = ctx.currentTime;
        const startAt = Math.max(now + 0.01, nextStartTimeRef.current);
        nextStartTimeRef.current = startAt + buf.duration;

        activeSourcesRef.current.add(src);
        src.onended = () => {
          activeSourcesRef.current.delete(src);
          if (!pausedRef.current && activeSourcesRef.current.size === 0 && statusRef.current === 'speaking') {
            statusRef.current = 'listening';
            setStatus('listening');
          }
        };
        src.start(startAt);
      })
      .catch(() => {
        if (!pausedRef.current && activeSourcesRef.current.size === 0) {
          statusRef.current = 'listening';
          setStatus('listening');
        }
      });
  }, []);

  const triggerInterruptionIndicator = useCallback(() => {
    stopPlaybackQueue();
    if (interruptTimerRef.current !== null) {
      window.clearTimeout(interruptTimerRef.current);
    }
    statusRef.current = 'interrupted';
    setStatus('interrupted');
    interruptTimerRef.current = window.setTimeout(() => {
      if (!pausedRef.current && statusRef.current === 'interrupted') {
        statusRef.current = 'listening';
        setStatus('listening');
      }
    }, 850);
  }, [stopPlaybackQueue]);

  const startLiveSession = useCallback(async () => {
    teardownSession();
    setErrorMsg(null);
    pausedRef.current = false;
    statusRef.current = 'connecting';
    setStatus('connecting');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      await inputCtx.resume().catch(() => undefined);
      await outputCtx.resume().catch(() => undefined);
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;
      vadBufferRef.current = [];
      vadSpeakingRef.current = false;
      noiseFloorRef.current = listeningSensitivity === 'noisy_room' ? 0.015 : listeningSensitivity === 'sensitive' ? 0.005 : 0.008;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?voice=${encodeURIComponent(
        profile.geminiVoiceName
      )}&lang=${encodeURIComponent(language)}&profile=${encodeURIComponent(voiceProfile)}&emotion=${encodeURIComponent(initialEmotionRef.current)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;

        // Send Heart Engine + optional validated Custom Gemini config securely over WS frame (never URL)
        ws.send(
          JSON.stringify({
            type: 'session_init',
            customGeminiKey,
            customGeminiModel,
            memoriesSummary: memoriesSummaryRef.current,
            heartEngineEnabled,
            naturalReactionsEnabled,
          })
        );

        try {
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          const baseSpeechFloor =
            listeningSensitivity === 'noisy_room'
              ? 0.026
              : listeningSensitivity === 'sensitive'
                ? 0.012
                : 0.018;

          processor.onaudioprocess = (event) => {
            if (pausedRef.current || ws.readyState !== WebSocket.OPEN) return;
            const samples = event.inputBuffer.getChannelData(0);

            // RMS Voice Activity Detection & adaptive ambient noise floor calibration
            let sumSq = 0;
            for (let i = 0; i < samples.length; i++) {
              sumSq += samples[i] * samples[i];
            }
            const rms = Math.sqrt(sumSq / samples.length);
            const normalized = Math.min(1, rms * 6.5);
            setAudioLevel(normalized);

            if (!vadSpeakingRef.current && statusRef.current === 'listening' && rms < baseSpeechFloor * 1.4) {
              noiseFloorRef.current = noiseFloorRef.current * 0.94 + rms * 0.06;
            }

            const adaptiveThreshold = Math.max(baseSpeechFloor, noiseFloorRef.current * 2.2);
            const bargeInThreshold = Math.max(0.048, noiseFloorRef.current * 3.5);

            // Active Interruption Detection: stop speaking cleanly when user begins speaking
            if (
              rms > bargeInThreshold &&
              (activeSourcesRef.current.size > 0 || statusRef.current === 'speaking')
            ) {
              triggerInterruptionIndicator();
            }

            if (voiceModeRef.current === 'native-live') {
              // Forward live audio chunks continuously while preserving VAD/barge-in
              const b64 = floatTo16BitPCMBase64(samples);
              ws.send(
                JSON.stringify({
                  audio: b64,
                  sampleRate: inputCtx.sampleRate || 16000,
                })
              );
            } else {
              const now = Date.now();
              const copy = new Float32Array(samples);
              if (rms > adaptiveThreshold) {
                if (!vadSpeakingRef.current) {
                  vadSpeakingRef.current = true;
                  vadStartAtRef.current = now;
                  vadBufferRef.current = [];
                }
                vadLastSpeechAtRef.current = now;
                vadBufferRef.current.push(copy);
              } else if (vadSpeakingRef.current) {
                vadBufferRef.current.push(copy);
                const silenceMs = now - vadLastSpeechAtRef.current;
                const speechMs = vadLastSpeechAtRef.current - vadStartAtRef.current;
                // Natural Pause Detection: allow brief thinking pauses (< 950ms), trigger on natural end-of-turn
                if (silenceMs >= 950 || now - vadStartAtRef.current > 16000) {
                  const captured = vadBufferRef.current;
                  vadBufferRef.current = [];
                  vadSpeakingRef.current = false;
                  if (speechMs >= 320 && captured.length > 0) {
                    statusRef.current = 'processing';
                    setStatus('processing');
                    const audioTurnWav = encodeFloat32ToWavBase64(captured, inputCtx.sampleRate || 16000);
                    ws.send(JSON.stringify({ audioTurnWav }));
                  }
                }
              }
            }
          };

          source.connect(processor);
          processor.connect(inputCtx.destination);
        } catch {
          // Keep Live WebSocket text turn & audio playback active even if mic node fails to attach
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            ready?: boolean;
            mode?: 'native-live' | 'adaptive-voice';
            heartState?: HeartStateSnapshot;
            audio?: string;
            wavAudio?: string;
            speakText?: string;
            speakingRate?: number;
            interrupted?: boolean;
            turnComplete?: boolean;
            inputTranscript?: string;
            outputTranscript?: string;
            error?: string;
            closed?: boolean;
          };

          if (msg.ready) {
            const activeMode = msg.mode || 'native-live';
            voiceModeRef.current = activeMode;
            setTransportMode(activeMode);
            statusRef.current = 'listening';
            setStatus('listening');
          }

          if (msg.heartState) {
            setHeartState(msg.heartState);
            if (heartEngineEnabled) {
              onEmotionChangeRef.current?.(msg.heartState.emotion);
            }
          }

          if (msg.error) {
            setErrorMsg(msg.error);
            statusRef.current = 'error';
            setStatus('error');
            return;
          }

          if (msg.interrupted) {
            triggerInterruptionIndicator();
          }

          if (msg.audio) {
            statusRef.current = 'speaking';
            setStatus('speaking');
            schedulePCMPlayback(msg.audio);
          }

          if (msg.wavAudio) {
            statusRef.current = 'speaking';
            setStatus('speaking');
            scheduleWavPlayback(msg.wavAudio);
          }

          if (msg.speakText) {
            const cleanSpeak = sanitizeSpokenText(msg.speakText);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window && cleanSpeak) {
              window.speechSynthesis.cancel();
              const utter = new SpeechSynthesisUtterance(cleanSpeak);
              const isBn = /[\u0980-\u09FF]/.test(cleanSpeak);
              const voices = window.speechSynthesis.getVoices();
              const matchVoice = voices.find((v) =>
                isBn ? v.lang.startsWith('bn') : v.lang.startsWith('en')
              );
              if (matchVoice) utter.voice = matchVoice;
              utter.lang = isBn ? 'bn-BD' : 'en-US';
              utter.rate = msg.speakingRate || deliveryParamsRef.current.speakingRate;
              utter.pitch = deliveryParamsRef.current.pitch;
              statusRef.current = 'speaking';
              setStatus('speaking');
              utter.onend = () => {
                if (!pausedRef.current) {
                  statusRef.current = 'listening';
                  setStatus('listening');
                }
              };
              utter.onerror = () => {
                if (!pausedRef.current) {
                  statusRef.current = 'listening';
                  setStatus('listening');
                }
              };
              window.speechSynthesis.speak(utter);
            } else {
              statusRef.current = 'listening';
              setStatus('listening');
            }
          }

          if (msg.inputTranscript) {
            const cleanUser = msg.inputTranscript.trim();
            if (cleanUser) {
              const candidate = extractHeartMemoryCandidate(cleanUser);
              if (candidate && onMemorySaveRef.current && !savedMemoryTextsRef.current.has(cleanUser)) {
                savedMemoryTextsRef.current.add(cleanUser);
                onMemorySaveRef.current(candidate);
              }
            }
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'user') {
                return [...prev.slice(0, -1), { role: 'user', text: `${last.text} ${msg.inputTranscript}`.trim() }];
              }
              return [...prev, { role: 'user', text: msg.inputTranscript! }];
            });
          }

          if (msg.outputTranscript) {
            const cleanOut = msg.outputTranscript
              .replace(/\[EMOTION:[^\]]+\]/gi, '')
              .replace(/\((?:laughs?|chuckles?|sighs?|giggles?|smiles?|gasp|breath|pause)\)/gi, '')
              .replace(/\*(?:laughs?|chuckles?|sighs?|giggles?|smiles?|gasp)\*/gi, '');
            if (cleanOut) {
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return [...prev.slice(0, -1), { role: 'assistant', text: `${last.text}${cleanOut}` }];
                }
                return [...prev, { role: 'assistant', text: cleanOut.trimStart() }];
              });
            }
          }

          if (msg.turnComplete && !pausedRef.current && activeSourcesRef.current.size === 0) {
            statusRef.current = 'listening';
            setStatus('listening');
          }
        } catch {
          // ignore malformed WS frame
        }
      };

      ws.onerror = () => {
        setErrorMsg('WebSocket connection error. Check network or retry.');
        statusRef.current = 'error';
        setStatus('error');
      };

      ws.onclose = () => {
        if (statusRef.current !== 'idle' && statusRef.current !== 'error' && reconnectAttemptsRef.current < 1) {
          reconnectAttemptsRef.current += 1;
          statusRef.current = 'reconnecting';
          setStatus('reconnecting');
          setTimeout(() => {
            if (open) startLiveSessionRef.current();
          }, 1200);
        }
      };
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to initialize microphone or Live API.');
      statusRef.current = 'error';
      setStatus('error');
      teardownSession();
    }
  }, [
    customGeminiKey,
    customGeminiModel,
    heartEngineEnabled,
    language,
    listeningSensitivity,
    naturalReactionsEnabled,
    open,
    profile.geminiVoiceName,
    schedulePCMPlayback,
    scheduleWavPlayback,
    teardownSession,
    triggerInterruptionIndicator,
    voiceProfile,
  ]);

  const startLiveSessionRef = useRef(startLiveSession);
  startLiveSessionRef.current = startLiveSession;

  useEffect(() => {
    if (open) {
      startLiveSessionRef.current();
    } else {
      statusRef.current = 'idle';
      setStatus('idle');
      teardownSession();
    }
    return () => {
      teardownSession();
    };
  }, [open, teardownSession]);

  const togglePause = () => {
    if (status === 'paused') {
      pausedRef.current = false;
      statusRef.current = 'listening';
      setStatus('listening');
    } else {
      pausedRef.current = true;
      stopPlaybackQueue();
      statusRef.current = 'paused';
      setStatus('paused');
    }
  };

  const handleSendTextTurn = (e: React.FormEvent) => {
    e.preventDefault();
    const text = fallbackInput.trim();
    if (!text) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      statusRef.current = 'processing';
      setStatus('processing');

      const candidate = extractHeartMemoryCandidate(text);
      if (candidate && onMemorySave && !savedMemoryTextsRef.current.has(text)) {
        savedMemoryTextsRef.current.add(text);
        onMemorySave(candidate);
      }

      wsRef.current.send(JSON.stringify({ text }));
      setTranscripts((prev) => [...prev, { role: 'user', text }]);
      setFallbackInput('');
    }
  };

  const handleClose = () => {
    if (onTranscriptSave && transcripts.length > 0) {
      const userParts = transcripts.filter((t) => t.role === 'user').map((t) => t.text).join(' ');
      const aiParts = transcripts.filter((t) => t.role === 'assistant').map((t) => t.text).join(' ');
      if (userParts || aiParts) {
        onTranscriptSave(userParts, aiParts);
      }
    }
    teardownSession();
    onClose();
  };

  if (!open) return null;

  const statusText: Record<LiveIndicatorState, string> = {
    idle: 'Session Stopped',
    connecting: 'Connecting to Gemini Live…',
    listening: 'Listening continuously (Speak anytime)',
    processing: 'Thinking & Planning Response…',
    speaking: 'SREHA is speaking (Interrupt anytime)',
    interrupted: 'Interrupted — Listening to you',
    paused: 'Microphone Paused',
    reconnecting: 'Reconnecting Live Voice…',
    error: 'Connection Interrupted',
  };

  const indicatorStages: Array<{ id: LiveIndicatorState; label: string }> = [
    { id: 'listening', label: 'Listening' },
    { id: 'processing', label: 'Processing' },
    { id: 'speaking', label: 'Speaking' },
    { id: 'interrupted', label: 'Interruption' },
    { id: 'reconnecting', label: 'Reconnecting' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#060916]/95 backdrop-blur-xl text-white"
      role="dialog"
      aria-modal="true"
      aria-label="SREHA Live Voice Conversation"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h2 className="text-base font-bold font-display">SREHA Live Voice</h2>
          <p className="text-xs text-slate-400">
            {profile.label} ({profile.labelBn}) ·{' '}
            {transportMode === 'native-live' ? 'Gemini Live Audio' : 'Adaptive Voice Turn'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close Live Voice"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-y-auto">
        <SrehaOrb
          emotion={activeEmotion}
          isSpeaking={status === 'speaking'}
          isListening={status === 'listening' || status === 'interrupted'}
          audioLevel={audioLevel}
          size="lg"
        />

        {/* Primary Live State Readout */}
        <div className="mt-4 flex items-center gap-2.5 text-sm font-medium">
          {status === 'speaking' ? (
            <Volume2 className="w-4 h-4 text-pink-400" />
          ) : status === 'processing' ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          ) : status === 'interrupted' ? (
            <Zap className="w-4 h-4 text-cyan-400" />
          ) : status === 'reconnecting' ? (
            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
          ) : status === 'listening' ? (
            <Mic className="w-4 h-4 text-sky-400" />
          ) : (
            <MicOff className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-slate-100">{statusText[status]}</span>
        </div>

        {/* Live Session Multi-Stage Indicators + Heart Engine Mood */}
        <div
          data-testid="live-indicators-strip"
          className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px]"
        >
          {indicatorStages.map((stage) => {
            const active = status === stage.id;
            return (
              <span
                key={stage.id}
                data-active={active ? 'true' : 'false'}
                className={`px-2.5 py-0.5 rounded-md border transition-colors ${
                  active
                    ? 'border-sky-400/70 bg-sky-500/20 text-sky-100 font-semibold'
                    : 'border-white/10 bg-white/5 text-slate-400'
                }`}
              >
                {stage.label}
              </span>
            );
          })}
        </div>

        {heartEngineEnabled && (
          <div
            className="mt-2.5 flex items-center gap-2 text-xs text-slate-300"
            data-testid="heart-engine-status"
          >
            <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span>
              Heart Engine: <strong style={{ color: activeEmotionMeta.primaryColor }}>{activeEmotion}</strong> ({activeEmotionMeta.labelBn})
            </span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Activity className="w-3 h-3" />
              {deliveryParams.speakingRate}x
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 max-w-md w-full rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={startLiveSession}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium shrink-0 inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        <div className="mt-5 w-full max-w-xl max-h-44 overflow-y-auto space-y-2.5 px-2">
          {transcripts.length === 0 ? (
            <p className="text-center text-xs text-slate-400">
              বাংলায় বা ইংরেজিতে কথা বলুন — স্রেহা লাইভ শুনছে। কথা বলার মাঝখানেও আপনি থামিয়ে নতুন কথা বলতে পারবেন।
            </p>
          ) : (
            transcripts.slice(-6).map((item, idx) => (
              <div
                key={idx}
                className={`text-sm px-3.5 py-2 rounded-xl ${
                  item.role === 'user'
                    ? 'bg-blue-600/25 text-sky-100 ml-8 text-right'
                    : 'bg-white/10 text-slate-100 mr-8'
                }`}
              >
                {item.text}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="px-6 pb-8 pt-4 border-t border-white/10 flex flex-col items-center gap-4">
        {wsRef.current?.readyState === WebSocket.OPEN && (
          <form onSubmit={handleSendTextTurn} className="w-full max-w-md flex gap-2">
            <input
              type="text"
              value={fallbackInput}
              onChange={(e) => setFallbackInput(e.target.value)}
              placeholder="Or type a message into this live voice session…"
              className="flex-1 px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            >
              Send
            </button>
          </form>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePause}
            className="min-h-[48px] px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2 transition-colors"
          >
            {status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{status === 'paused' ? 'Resume' : 'Pause Mic'}</span>
          </button>

          <button
            type="button"
            onClick={startLiveSession}
            className="min-h-[48px] px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reconnect</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="min-h-[48px] px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
