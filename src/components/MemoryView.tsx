import React, { useMemo, useRef, useState } from 'react';
import { Download, Plus, Search, Trash2, Upload, ShieldCheck } from 'lucide-react';
import { MemoryCategory, MemoryItem } from '../types/sreha';
import { formatMessageTime, validateMemoryBackup } from '../utils/chatHelpers';

interface MemoryViewProps {
  memories: MemoryItem[];
  memoryConsent: boolean;
  onAddMemory: (item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteMemory: (id: string) => void;
  onRestoreBackup: (items: MemoryItem[]) => void;
}

const CATEGORIES: Array<{ id: 'all' | MemoryCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'preference', label: 'Preferences' },
  { id: 'note', label: 'Saved Notes' },
  { id: 'fact', label: 'Important Info' },
  { id: 'task_context', label: 'Task Context' },
  { id: 'conversation', label: 'History' },
];

export const MemoryView: React.FC<MemoryViewProps> = ({
  memories,
  memoryConsent,
  onAddMemory,
  onDeleteMemory,
  onRestoreBackup,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | MemoryCategory>('all');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('note');
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return memories.filter((m) => {
      const catOk = category === 'all' || m.category === category;
      const qOk =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [memories, search, category]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryConsent) {
      setFeedback('Enable Memory Storage Consent in Settings before saving new memories.');
      return;
    }
    if (!title.trim() || !content.trim()) {
      setFeedback('Please enter both a title and memory content.');
      return;
    }
    onAddMemory({
      category: newCategory,
      title: title.trim(),
      content: content.trim(),
      sensitiveConfirmed: true,
    });
    setTitle('');
    setContent('');
    setFeedback('Saved to SREHA Long-Term Memory.');
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleExport = () => {
    const payload = JSON.stringify({ exportedAt: Date.now(), memories }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sreha-memory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = validateMemoryBackup(text);
    if (!res.valid) {
      setFeedback(res.error || 'Backup file could not be parsed.');
      return;
    }
    onRestoreBackup(res.items);
    setFeedback(`Restored ${res.items.length} memory items.`);
    e.target.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">
              SREHA Memory Vault
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Persistent preferences, notes, task context & JSON backup · Stored locally (Room DB in Android APK)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Export Backup</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              <span>Restore Backup</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800/60">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
          <span>
            Privacy Guard: Sensitive information is never stored without your explicit action or permission.
          </span>
        </div>

        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-5 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Memory title (e.g., Language Preference)"
              aria-label="Memory title"
              className="sm:col-span-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1124] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
              aria-label="Memory category"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1124] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="preference">User Preference</option>
              <option value="note">Saved Note</option>
              <option value="fact">Important Information</option>
              <option value="task_context">Task Context</option>
            </select>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder="Write what SREHA should remember (Bengali or English)…"
            aria-label="Memory content"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1124] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {feedback || `${memories.length} memories stored`}
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Save Memory</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  category === c.id
                    ? 'bg-white dark:bg-[#111936] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memory…"
              aria-label="Search memory"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111936] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No matching memories found. Add a note or preference above for SREHA to remember across conversations.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111936] p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onDeleteMemory(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      aria-label={`Delete memory ${item.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {item.content}
                  </p>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 tabular-nums">
                  <span className="capitalize">{item.category.replace('_', ' ')}</span>
                  <span aria-hidden="true">·</span>
                  <span>Updated {formatMessageTime(item.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
