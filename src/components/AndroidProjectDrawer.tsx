import React, { useMemo, useState } from 'react';
import { Download, FileCode2, FolderTree, Terminal, X, Check, Copy } from 'lucide-react';
import { ANDROID_MODULES, generateAndroidProjectFiles } from '../utils/androidProjectGenerator';

interface AndroidProjectDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const AndroidProjectDrawer: React.FC<AndroidProjectDrawerProps> = ({ open, onClose }) => {
  const files = useMemo(() => generateAndroidProjectFiles(), []);
  const [selectedPath, setSelectedPath] = useState<string>('README-BN.md');
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!open) return null;

  const activeFile = files.find((f) => f.path === selectedPath) || files[0];

  const handleCopyCmd = async () => {
    try {
      await navigator.clipboard.writeText('gradle wrapper --gradle-version 8.11.1 && gradlew.bat assembleDebug');
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Native Android Kotlin Project Explorer"
    >
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D142B] shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
              Native Android Kotlin + Jetpack Compose Project
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ANDROID_MODULES.length} Gradle Modules · {files.length} Source & Build Files · Windows CMD Ready
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/android/download-zip"
              download="SREHA-AI-AGENT-Android.zip"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close Android Project Explorer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Terminal className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              Windows CMD Build (JDK 17 + Android SDK 35 required locally):{' '}
              <code className="font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                gradlew.bat assembleDebug
              </code>
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCmd}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-sky-400 hover:underline"
          >
            {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCmd ? 'Copied CMD' : 'Copy CMD'}</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-3 max-h-56 md:max-h-none">
            <div className="flex items-center gap-1.5 px-2 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <FolderTree className="w-3.5 h-3.5" />
              <span>Project Files ({files.length})</span>
            </div>
            <div className="space-y-1">
              {files.map((file) => {
                const active = file.path === activeFile.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedPath(file.path)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono truncate flex items-center gap-2 transition-colors ${
                      active
                        ? 'bg-blue-600/15 text-blue-700 dark:text-sky-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                    <span className="truncate">{file.path}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-8 flex flex-col min-h-0 bg-slate-950 text-slate-100">
            <div className="px-4 py-2.5 border-b border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>{activeFile.path}</span>
              <span>Module: {activeFile.module}</span>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed font-mono text-slate-200">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
