import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  AlarmClock,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  FolderCode,
  Globe,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Trash2,
  Wifi,
  XCircle,
} from 'lucide-react';
import { AutomationTask, PendingAgentAction } from '../types/sreha';
import { parseVoiceAutomationCommand } from '../utils/chatHelpers';

interface ToolsViewProps {
  tasks: AutomationTask[];
  onCreateTask: (task: AutomationTask) => void;
  onTaskAction: (id: string, action: 'pause' | 'resume' | 'cancel' | 'complete') => void;
  onDeleteTask: (id: string) => void;
  onOpenAndroidExplorer: () => void;
  onSaveToMemory: (title: string, content: string) => void;
}

export const ToolsView: React.FC<ToolsViewProps> = ({
  tasks,
  onCreateTask,
  onTaskAction,
  onDeleteTask,
  onOpenAndroidExplorer,
  onSaveToMemory,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'automation' | 'agent' | 'files_camera' | 'network'>('automation');

  // Automation state
  const [commandInput, setCommandInput] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAgentAction | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null);

  // File & Camera Agent state
  const [analysisOutput, setAnalysisOutput] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState<{ name: string; size: number; type: string } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qrScanResult, setQrScanResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Network & QR Generator state
  const [qrInput, setQrInput] = useState('https://sreha-ai-agent.app');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [speedResult, setSpeedResult] = useState<{ latencyMs: number; mbps: number } | null>(null);
  const [testingSpeed, setTestingSpeed] = useState(false);

  // Ticking active timer
  useEffect(() => {
    if (timerSecondsLeft === null) return;
    if (timerSecondsLeft <= 0) {
      setTimerSecondsLeft(null);
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 660;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } catch {
        // ignore audio failure
      }
      return;
    }
    const id = setTimeout(() => setTimerSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [timerSecondsLeft]);

  // Generate QR Code whenever qrInput changes
  useEffect(() => {
    if (!qrInput.trim()) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(qrInput.trim(), { width: 220, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [qrInput]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCreateAutomation = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = commandInput.trim();
    if (!raw) return;
    const parsed = parseVoiceAutomationCommand(raw);
    const task: AutomationTask = {
      id: `task_${Date.now()}`,
      title: parsed.title,
      command: raw,
      steps: parsed.steps,
      scheduleLabel: parsed.scheduleLabel,
      triggerAt: parsed.triggerOffsetMs ? Date.now() + parsed.triggerOffsetMs : undefined,
      status: 'active',
      createdAt: Date.now(),
    };
    onCreateTask(task);
    if (parsed.kind === 'timer' && parsed.triggerOffsetMs) {
      setTimerSecondsLeft(Math.round(parsed.triggerOffsetMs / 1000));
    }
    setCommandInput('');
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.actionType === 'timer') {
      const mins = Number(pendingAction.payload.minutes || 5);
      setTimerSecondsLeft(mins * 60);
      onCreateTask({
        id: `task_${Date.now()}`,
        title: `${mins}-minute Timer`,
        command: pendingAction.description,
        steps: ['Start browser countdown', 'Play completion chime'],
        scheduleLabel: `In ${mins} min`,
        status: 'active',
        createdAt: Date.now(),
      });
    } else if (pendingAction.actionType === 'reminder') {
      onSaveToMemory(pendingAction.title, pendingAction.description);
      onCreateTask({
        id: `task_${Date.now()}`,
        title: pendingAction.title,
        command: pendingAction.description,
        steps: ['Saved to Memory Vault', 'Scheduled reminder alert'],
        scheduleLabel: 'Reminder Active',
        status: 'active',
        createdAt: Date.now(),
      });
    } else if (pendingAction.actionType === 'camera') {
      setActiveSubTab('files_camera');
      startCamera();
    }
    setPendingAction(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileInfo({ name: file.name, size: file.size, type: file.type || 'application/octet-stream' });
    setAnalyzing(true);
    setAnalysisOutput('');

    try {
      let body: Record<string, string> = {
        prompt: `Analyze "${file.name}" (${file.type || 'file'}). Summarize key information clearly.`,
      };

      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.split(',')[1] || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        body = { ...body, mimeType: file.type, base64Data };

        if (file.type.startsWith('image/')) {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height);
              if (code) setQrScanResult(code.data);
            }
            URL.revokeObjectURL(img.src);
          };
        }
      } else {
        const textContent = await file.text();
        body = { ...body, textContent };
      }

      const res = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { analysis?: string; error?: string };
      setAnalysisOutput(json.analysis || json.error || 'No analysis returned.');
    } catch (err) {
      setAnalysisOutput(err instanceof Error ? err.message : 'File analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setQrScanResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraStreamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Camera permission denied or unavailable.');
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setCameraActive(false);
  };

  const captureAndAnalyzeFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Check QR first
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = jsQR(imgData.data, imgData.width, imgData.height);
    if (qr) {
      setQrScanResult(qr.data);
    }

    const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    setAnalyzing(true);
    try {
      const res = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Describe what is visible in this camera capture and extract any visible text.',
          mimeType: 'image/jpeg',
          base64Data,
        }),
      });
      const json = (await res.json()) as { analysis?: string; error?: string };
      setAnalysisOutput(json.analysis || json.error || 'No analysis available.');
    } catch (err) {
      setAnalysisOutput(err instanceof Error ? err.message : 'Vision capture failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const runSpeedTest = async () => {
    setTestingSpeed(true);
    try {
      const t0 = performance.now();
      await fetch('/api/network/ping');
      const latencyMs = Math.round(performance.now() - t0);

      const t1 = performance.now();
      const payloadRes = await fetch('/api/network/ping?sizeKb=256');
      const txt = await payloadRes.text();
      const elapsedSec = Math.max((performance.now() - t1) / 1000, 0.01);
      const mbps = Number((((txt.length * 8) / 1_000_000) / elapsedSec).toFixed(2));
      setSpeedResult({ latencyMs, mbps });
    } catch {
      setSpeedResult(null);
    } finally {
      setTestingSpeed(false);
    }
  };

  const netInfo =
    typeof navigator !== 'undefined'
      ? (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number } }).connection
      : undefined;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">
              Agent Tools & Automation
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Permission-based controls, multi-step automation, file & camera intelligence, network utilities & Android APK source
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAndroidExplorer}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FolderCode className="w-4 h-4" />
            <span>Android Project & ZIP</span>
          </button>
        </div>

        {/* Sub-tab Bar */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-slate-800/75 w-fit">
          {[
            { id: 'automation', label: 'Automation Engine' },
            { id: 'agent', label: 'Phone Agent' },
            { id: 'files_camera', label: 'File & Camera' },
            { id: 'network', label: 'Network & QR' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'bg-white dark:bg-[#111936] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Confirmation Dialog for Agent Action */}
        {pendingAction && (
          <div className="rounded-2xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Confirm Agent Action: {pendingAction.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {pendingAction.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingAction}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Approve & Execute
              </button>
            </div>
          </div>
        )}

        {/* Active Timer Banner */}
        {timerSecondsLeft !== null && (
          <div className="rounded-2xl border border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlarmClock className="w-5 h-5 text-blue-600 dark:text-sky-400" />
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                Active Timer: {Math.floor(timerSecondsLeft / 60)}m {String(timerSecondsLeft % 60).padStart(2, '0')}s
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTimerSecondsLeft(null)}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
            >
              Stop Timer
            </button>
          </div>
        )}

        {activeSubTab === 'automation' && (
          <div className="space-y-5">
            <form
              onSubmit={handleCreateAutomation}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-3"
            >
              <label
                htmlFor="automation-cmd"
                className="block text-sm font-semibold text-slate-900 dark:text-white"
              >
                Create Multi-Step Automation (Bengali or English)
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  id="automation-cmd"
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder='e.g. "স্রেহা, আগামীকাল সকাল ৮টার জন্য Alarm সেট করো" or "Start 5 minute timer"'
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1124] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap"
                >
                  Create Task
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  'স্রেহা, আমার জন্য একটা Reminder তৈরি করো',
                  'স্রেহা, Camera ওপেন করো',
                  'Start a 2 minute timer',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setCommandInput(sample)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </form>

            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No scheduled tasks yet. Enter a Bengali or English command above to create a multi-step automation.
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold uppercase tracking-wide text-blue-600 dark:text-sky-400">
                          {task.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{task.scheduleLabel}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Steps: {task.steps.join(' → ')}
                      </p>
                      {task.errorLog && (
                        <p className="text-xs text-rose-500">Error: {task.errorLog}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => onTaskAction(task.id, 'pause')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </button>
                      )}
                      {task.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => onTaskAction(task.id, 'resume')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Resume
                        </button>
                      )}
                      {(task.status === 'active' || task.status === 'paused') && (
                        <>
                          <button
                            type="button"
                            onClick={() => onTaskAction(task.id, 'complete')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-blue-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Run Now
                          </button>
                          <button
                            type="button"
                            onClick={() => onTaskAction(task.id, 'cancel')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                        aria-label={`Delete task ${task.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'agent' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                Web-Executable Agent Tools (Confirmation Required)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                These actions run directly inside your browser session after your explicit confirmation.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPendingAction({
                      id: 'act_timer',
                      actionType: 'timer',
                      title: 'Start 5-Minute Focus Timer',
                      description: 'Starts an active 5-minute countdown with audible completion chime.',
                      payload: { minutes: 5 },
                    })
                  }
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <AlarmClock className="w-5 h-5 text-blue-500 mb-2" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Start Timer</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Live 5m countdown</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPendingAction({
                      id: 'act_rem',
                      actionType: 'reminder',
                      title: 'Save Daily Reminder',
                      description: 'Saves a reminder in Memory Vault and schedules an active task.',
                      payload: {},
                    })
                  }
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <Sparkles className="w-5 h-5 text-purple-500 mb-2" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Create Reminder</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Memory + Task Alert</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPendingAction({
                      id: 'act_cam',
                      actionType: 'camera',
                      title: 'Open Camera Agent',
                      description: 'Requests camera permission to scan QR codes or analyze scenes.',
                      payload: {},
                    })
                  }
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <Camera className="w-5 h-5 text-pink-500 mb-2" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Open Camera</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Permission-gated preview</div>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-500" />
                    <span>Android OS-Level Controls (Implemented in Kotlin APK Export)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Web browsers cannot alter device system volume, screen brightness, Wi-Fi/Bluetooth settings, or launch installed Android apps for security reasons. All of these are genuinely implemented in <code className="font-mono">PhoneAgentExecutor.kt</code> inside the downloadable Native Android project:
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600 dark:text-slate-300">
                {[
                  'App Launcher',
                  'System Settings',
                  'Set Volume (AudioManager)',
                  'Adjust Brightness',
                  'Wi-Fi Settings Intent',
                  'Bluetooth Settings',
                  'Location Settings',
                  'AlarmClock / Timer Intent',
                ].map((item) => (
                  <div
                    key={item}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1124]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'files_camera' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  File Reader & Document Analysis
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a PDF, image, text, JSON, or code file. SREHA extracts metadata and analyzes contents using Gemini.
              </p>
              <input
                type="file"
                onChange={handleFileUpload}
                aria-label="Upload file for analysis"
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {selectedFileInfo && (
                <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  {selectedFileInfo.name} · {(selectedFileInfo.size / 1024).toFixed(1)} KB · {selectedFileInfo.type}
                </div>
              )}
              {analyzing && <p className="text-xs text-blue-500">Analyzing with SREHA Vision…</p>}
              {qrScanResult && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
                  QR Decoded: <span className="font-mono break-all">{qrScanResult}</span>
                </div>
              )}
              {analysisOutput && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1124] border border-slate-200 dark:border-slate-800 text-xs leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {analysisOutput}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-pink-500" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Camera Agent & Live QR Scanner
                  </h2>
                </div>
                {cameraActive ? (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
                  >
                    Stop Camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium"
                  >
                    Enable Camera
                  </button>
                )}
              </div>

              {cameraError && (
                <p className="text-xs text-rose-500">{cameraError}</p>
              )}

              {cameraActive ? (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-xl bg-black aspect-video object-cover"
                  />
                  <button
                    type="button"
                    onClick={captureAndAnalyzeFrame}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    Capture, Scan QR & Analyze Frame
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 aspect-video flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 px-4 text-center">
                  Camera stays off until you explicitly click Enable Camera.
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'network' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-blue-500" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Network Status & Speed Test
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={runSpeedTest}
                  disabled={testingSpeed}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingSpeed ? 'animate-spin' : ''}`} />
                  <span>{testingSpeed ? 'Testing…' : 'Run Speed Test'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1124] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">Online Status</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {typeof navigator !== 'undefined' && navigator.onLine ? 'Connected' : 'Offline'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1124] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">Link Estimate</div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">
                    {netInfo?.effectiveType ? `${netInfo.effectiveType.toUpperCase()} (${netInfo.downlink ?? '?'} Mbps)` : 'Browser Standard'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1124] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">Server Latency</div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">
                    {speedResult ? `${speedResult.latencyMs} ms` : 'Run test'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1124] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">Throughput</div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">
                    {speedResult ? `${speedResult.mbps} Mbps` : 'Run test'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Globe className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Wi-Fi signal strength & authorized local scanner run natively via Android <code className="font-mono">ConnectivityManager</code> in <code className="font-mono">NetworkTools.kt</code>. Protected Wi-Fi passwords are never accessed.
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-purple-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  QR Code Generator
                </h2>
              </div>
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Enter URL, Wi-Fi text, or note…"
                aria-label="QR Code text"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1124] text-sm text-slate-900 dark:text-slate-100"
              />
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={qrDataUrl}
                    alt="Generated QR Code"
                    className="w-44 h-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2"
                  />
                  <a
                    href={qrDataUrl}
                    download="sreha-qr.png"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-sky-400 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR PNG</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
