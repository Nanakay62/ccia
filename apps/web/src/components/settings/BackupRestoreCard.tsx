import React, { useState } from 'react';
import { useSync } from '../../context/SyncContext.js';
import {
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  Cpu,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCcw,
} from 'lucide-react';

export const BackupRestoreCard: React.FC = () => {
  const {
    exportEncryptedBackup,
    restoreFromEncryptedBackup,
    simulateMultiDeviceScenario,
    simulationLog,
    clearSimulationLog,
  } = useSync();

  // Export state
  const [exportPassphrase, setExportPassphrase] = useState('AccraGrace2026!');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Restore state
  const [restorePassphrase, setRestorePassphrase] = useState('AccraGrace2026!');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    isBalanced?: boolean;
  } | null>(null);

  // Simulation state
  const [isRunningSim, setIsRunningSim] = useState(false);

  const handleExport = async () => {
    if (!exportPassphrase.trim()) {
      alert('Please enter a passphrase to encrypt your backup.');
      return;
    }
    setIsExporting(true);
    setExportSuccess(null);
    try {
      const blob = await exportEncryptedBackup(exportPassphrase);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `church-backup-${new Date().toISOString().slice(0, 10)}.chbak`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess('Encrypted backup successfully exported with AES-256-GCM.');
    } catch (err) {
      alert('Export failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      alert('Please select a .chbak file to restore.');
      return;
    }
    if (!restorePassphrase.trim()) {
      alert('Please enter the decryption passphrase.');
      return;
    }
    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const text = await restoreFile.text();
      const res = await restoreFromEncryptedBackup(text, restorePassphrase);
      setRestoreResult({
        success: res.success,
        message: res.message,
        isBalanced: res.isTrialBalanceHealthy,
      });
    } catch (err) {
      setRestoreResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to read backup file',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const runSimulation = async (
    scenario: 'CONCURRENT_NON_CONFLICTING' | 'CONCURRENT_CONFLICT' | 'REJECTION_IN_QUEUE'
  ) => {
    setIsRunningSim(true);
    try {
      await simulateMultiDeviceScenario(scenario);
    } finally {
      setIsRunningSim(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Offline Encrypted Backup Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-2.5 text-blue-600 font-bold text-lg">
          <HardDrive className="w-6 h-6" />
          <h3>Encrypted Local Backups (USB / Offline Storage)</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Export full database snapshots encrypted on-device using Web Crypto AES-256-GCM with 100,000 PBKDF2 iterations and SHA-256 integrity checksums. Restores are subjected to an immediate Trial Balance Doctor diagnostic before loading.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Column */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export Encrypted Snapshot (.chbak)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Backs up all accounts, funds, journal entries, periods, exchange rates, and members.
            </p>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Encryption Passphrase
              </label>
              <input
                type="password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isExporting ? 'Encrypting & Packaging...' : 'Download Encrypted Backup'}</span>
            </button>
            {exportSuccess && (
              <div className="p-2.5 rounded bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{exportSuccess}</span>
              </div>
            )}
          </div>

          {/* Restore Column */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Restore from Encrypted File</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Decrypts file, verifies SHA-256 checksum, and runs Doctor check before restore.
            </p>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Select .chbak Backup File
              </label>
              <input
                type="file"
                accept=".chbak,.json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white file:cursor-pointer text-slate-600 dark:text-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Decryption Passphrase
              </label>
              <input
                type="password"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleRestore}
              disabled={isRestoring || !restoreFile}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 text-white font-medium text-xs transition shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? 'Decrypting & Verifying...' : 'Restore & Verify via Doctor'}</span>
            </button>

            {restoreResult && (
              <div
                className={`p-2.5 rounded border text-[11px] flex items-start gap-1.5 ${
                  restoreResult.success
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}
              >
                {restoreResult.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{restoreResult.message}</div>
                  {restoreResult.isBalanced !== undefined && (
                    <div className="mt-0.5">
                      Doctor Verification:{' '}
                      <span className="font-bold">
                        {restoreResult.isBalanced ? 'CLEAN (Books Balanced)' : 'DIAGNOSTIC ISSUES DETECTED'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Multi-Device Offline Simulation Sandbox */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-blue-600 font-bold text-lg">
            <Cpu className="w-6 h-6" />
            <h3>Multi-Device Offline Simulation Sandbox</h3>
          </div>
          {simulationLog.length > 0 && (
            <button
              onClick={clearSimulationLog}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Console</span>
            </button>
          )}
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Simulate offline multi-device scenarios in accordance with Phase 3 specifications: non-conflicting concurrent postings, optimistic locking conflicts (<code className="text-blue-500">row_version</code>), and non-blocking rejection isolation.
        </p>

        {/* Action Triggers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => runSimulation('CONCURRENT_NON_CONFLICTING')}
            disabled={isRunningSim}
            className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-left transition space-y-1.5"
          >
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-xs">
              <Play className="w-3.5 h-3.5" />
              <span>Scenario 1: Non-Conflicting Sync</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              2 devices offline post offering & donation. Both reconnect, sync in interleaved batches, and Doctor confirms books balance.
            </p>
          </button>

          <button
            onClick={() => runSimulation('CONCURRENT_CONFLICT')}
            disabled={isRunningSim}
            className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-left transition space-y-1.5"
          >
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-xs">
              <Play className="w-3.5 h-3.5" />
              <span>Scenario 2: Optimistic Locking Conflict</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Offline device updates member record with stale version 1. Server rejects with VERSION_CONFLICT; diff is stored for resolution.
            </p>
          </button>

          <button
            onClick={() => runSimulation('REJECTION_IN_QUEUE')}
            disabled={isRunningSim}
            className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-left transition space-y-1.5"
          >
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold text-xs">
              <Play className="w-3.5 h-3.5" />
              <span>Scenario 3: Non-Blocking Rejection</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              A closed-period entry fails server check, routed to Needs Attention without blocking valid entries in the upload queue.
            </p>
          </button>
        </div>

        {/* Live Execution Console */}
        {simulationLog.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5 text-slate-300 max-h-56 overflow-y-auto">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider pb-1 border-b border-slate-800">
              Simulation Console Output:
            </div>
            {simulationLog.map((line, idx) => (
              <div key={idx} className="leading-relaxed">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
