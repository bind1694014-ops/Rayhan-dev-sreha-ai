import { AutomationTask, MemoryItem } from '../types/sreha';

export function shouldAutoScroll(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  thresholdPx = 110
): boolean {
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  return distanceFromBottom <= thresholdPx;
}

export function formatMessageTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function containsBengali(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

export function deriveChatTitle(firstPrompt: string): string {
  const cleaned = firstPrompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Conversation';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

export interface ParsedAutomationCommand {
  title: string;
  steps: string[];
  scheduleLabel: string;
  triggerOffsetMs?: number;
  kind: 'reminder' | 'alarm' | 'timer' | 'camera' | 'general';
}

export function parseVoiceAutomationCommand(commandText: string): ParsedAutomationCommand {
  const text = commandText.trim();
  const lower = text.toLowerCase();

  if (/camera|ক্যামেরা/.test(lower)) {
    return {
      title: containsBengali(text) ? 'ক্যামেরা এজেন্ট চালু করুন' : 'Open Camera Agent',
      steps: [
        'Verify camera permission',
        'Launch Camera preview & QR/Vision scanner',
      ],
      scheduleLabel: 'Immediate',
      kind: 'camera',
    };
  }

  const minuteMatch = text.match(/(\d+)\s*(?:min|minute|minutes|মিনিট)/i);
  if (/timer|টাইমার/.test(lower) || minuteMatch) {
    const mins = minuteMatch ? Math.max(1, parseInt(minuteMatch[1], 10)) : 5;
    return {
      title: containsBengali(text) ? `${mins} মিনিটের টাইমার` : `${mins}-minute Timer`,
      steps: [
        `Initialize ${mins}m countdown`,
        'Monitor background timer',
        'Trigger audible notification on completion',
      ],
      scheduleLabel: `In ${mins} min`,
      triggerOffsetMs: mins * 60_000,
      kind: 'timer',
    };
  }

  if (/alarm|অ্যালার্ম/.test(lower)) {
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|টা)?/i);
    const label = timeMatch ? `Scheduled ${timeMatch[0]}` : 'Scheduled Alarm';
    return {
      title: containsBengali(text) ? `অ্যালার্ম সেট (${label})` : `Set Alarm (${label})`,
      steps: [
        'Parse target alarm schedule',
        'Register WorkManager / system alarm trigger',
        'Notify user with SREHA chime',
      ],
      scheduleLabel: label,
      kind: 'alarm',
    };
  }

  if (/reminder|রিমাইন্ডার|মনে করিয়ে/.test(lower)) {
    return {
      title: containsBengali(text) ? 'রিমাইন্ডার তৈরি' : 'Create Reminder',
      steps: [
        'Extract reminder note & context',
        'Save to Memory & Automation queue',
        'Notify at scheduled time',
      ],
      scheduleLabel: 'Scheduled',
      kind: 'reminder',
    };
  }

  return {
    title: text.length > 36 ? `${text.slice(0, 36)}…` : text || 'Custom Automation',
    steps: ['Analyze command intent', 'Execute safe agent step', 'Log result'],
    scheduleLabel: 'On Demand',
    kind: 'general',
  };
}

export function transitionAutomationStatus(
  task: AutomationTask,
  action: 'pause' | 'resume' | 'cancel' | 'complete'
): AutomationTask {
  if (action === 'pause' && task.status === 'active') {
    return { ...task, status: 'paused' };
  }
  if (action === 'resume' && task.status === 'paused') {
    return { ...task, status: 'active' };
  }
  if (action === 'cancel' && task.status !== 'completed') {
    return { ...task, status: 'cancelled' };
  }
  if (action === 'complete') {
    return { ...task, status: 'completed', lastRunAt: Date.now() };
  }
  return task;
}

export function validateMemoryBackup(rawJson: string): {
  valid: boolean;
  items: MemoryItem[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    const list = Array.isArray(parsed) ? parsed : parsed?.memories;
    if (!Array.isArray(list)) {
      return { valid: false, items: [], error: 'Backup JSON must contain a memories array.' };
    }
    const sanitized: MemoryItem[] = list
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.content === 'string'
      )
      .map((item) => ({
        id: item.id,
        category: ['preference', 'note', 'fact', 'task_context', 'conversation'].includes(
          item.category
        )
          ? item.category
          : 'note',
        title: item.title,
        content: item.content,
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        sensitiveConfirmed: Boolean(item.sensitiveConfirmed),
      }));

    if (list.length > 0 && sanitized.length === 0) {
      return { valid: false, items: [], error: 'No valid memory records found in backup.' };
    }
    return { valid: true, items: sanitized };
  } catch {
    return { valid: false, items: [], error: 'Invalid JSON file.' };
  }
}
