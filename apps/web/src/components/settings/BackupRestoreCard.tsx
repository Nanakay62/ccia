import React, { useState } from 'react';
import { useSync } from '../../context/SyncContext.js';
import { useDemo } from '../../context/DemoContext.js';
import {
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';

export const BackupRestoreCard: React.FC = () => {
  const {
    exportEncryptedBackup,
    restoreFromEncryptedBackup,
    simulateMultiDeviceScenario,
    simulationLog,
    clearSimulationLog,
  } = useSync();
  const { isDemoMode } = useDemo();

  // Export state
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Restore state
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
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
      alert('Please enter a passphrase to lock your backup.');
      return;
    }
    if (confirmPassphrase && exportPassphrase !== confirmPassphrase) {
      alert('Passphrases do not match. Please re-enter.');
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
      setExportSuccess('Encrypted backup successfully downloaded.');
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
      {/* 1. Offline Encrypted Backup Card (Section 5.3) */}
      <div className="p-6 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-[var(--accent)] font-bold text-base">
          <HardDrive className="w-5 h-5" />
          <h3>Encrypted Local Backups</h3>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Backups are locked with a passphrase you choose. Keep it safe: if it is lost, the backup cannot be opened.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Column */}
          <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-3">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13px]">
              <Download className="w-4 h-4 text-[var(--accent)]" />
              <span>Export Encrypted Snapshot (.chbak)</span>
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">
              Backs up all accounts, funds, journal entries, periods, exchange rates, and members.
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Passphrase
                </label>
                <div className="relative">
                  <input
                    type={showExportPassword ? 'text' : 'password'}
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    placeholder="Enter passphrase"
                    className="w-full text-[13px] px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-primary)] focus:outline-none pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  >
                    {showExportPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Confirm passphrase
                </label>
                <input
                  type={showExportPassword ? 'text' : 'password'}
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Confirm passphrase"
                  className="w-full text-[13px] px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || !exportPassphrase}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white font-medium text-[13px] transition shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isExporting ? 'Encrypting...' : 'Download Encrypted Backup'}</span>
            </button>
            {exportSuccess && (
              <div className="p-2.5 rounded-[var(--radius-sm)] bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{exportSuccess}</span>
              </div>
            )}
          </div>

          {/* Restore Column */}
          <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-3">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[13px]">
              <Upload className="w-4 h-4 text-[var(--accent)]" />
              <span>Restore from Encrypted File</span>
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">
              Verifies backup integrity and runs trial balance diagnostics before loading.
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Select .chbak Backup File
                </label>
                <input
                  type="file"
                  accept=".chbak,.json"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="w-full text-[12px] file:mr-2 file:py-1 file:px-2.5 file:rounded-[var(--radius-sm)] file:border-0 file:text-[11px] file:font-semibold file:bg-[var(--accent)] file:text-white file:cursor-pointer text-[var(--text-secondary)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Decryption Passphrase
                </label>
                <div className="relative">
                  <input
                    type={showRestorePassword ? 'text' : 'password'}
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="Enter passphrase"
                    className="w-full text-[13px] px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-primary)] focus:outline-none pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRestorePassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  >
                    {showRestorePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={handleRestore}
              disabled={isRestoring || !restoreFile || !restorePassphrase}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)] border border-[var(--surface-border)] font-medium text-[13px] transition shadow-sm disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? 'Decrypting...' : 'Restore & Verify via Doctor'}</span>
            </button>

            {restoreResult && (
              <div
                className={`p-2.5 rounded-[var(--radius-sm)] border text-[12px] flex items-start gap-1.5 ${
                  restoreResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
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

      {/* 2. Multi-Device Offline Simulation Sandbox (Section 5.4: Strictly demo mode training only) */}
      {isDemoMode && (
        <div className="p-6 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[var(--accent)] font-bold text-base">
              <ShieldCheck className="w-5 h-5" />
              <h3>Multi-Device Offline Simulation Sandbox</h3>
            </div>
            {simulationLog.length > 0 && (
              <button
                onClick={clearSimulationLog}
                className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Console</span>
              </button>
            )}
          </div>

          <p className="text-[13px] text-[var(--text-secondary)]">
            Training walkthrough demonstrating how devices work offline and reconcile on reconnect.
          </p>

          {/* Action Triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => runSimulation('CONCURRENT_NON_CONFLICTING')}
              disabled={isRunningSim}
              className="p-3.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)]/40 text-left transition space-y-1"
            >
              <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold text-[13px]">
                <Play className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Scenario 1: Non-Conflicting Sync</span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                2 devices offline post offering & donation. Both reconnect, sync in interleaved batches, and Doctor confirms books balance.
              </p>
            </button>

            <button
              onClick={() => runSimulation('CONCURRENT_CONFLICT')}
              disabled={isRunningSim}
              className="p-3.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)]/40 text-left transition space-y-1"
            >
              <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold text-[13px]">
                <Play className="w-3.5 h-3.5 text-amber-600" />
                <span>Scenario 2: Optimistic Locking Conflict</span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                Offline device updates member record with stale version. Server detects version conflict and routes to resolution queue.
              </p>
            </button>

            <button
              onClick={() => runSimulation('REJECTION_IN_QUEUE')}
              disabled={isRunningSim}
              className="p-3.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)]/40 text-left transition space-y-1"
            >
              <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold text-[13px]">
                <Play className="w-3.5 h-3.5 text-rose-600" />
                <span>Scenario 3: Non-Blocking Rejection</span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                A closed-period entry fails server check, routed to Needs Attention without blocking valid entries in the upload queue.
              </p>
            </button>
          </div>

          {/* Live Execution Console */}
          {simulationLog.length > 0 && (
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-mono text-[12px] space-y-1 max-h-56 overflow-y-auto">
              <div className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider pb-1 border-b border-[var(--surface-border)]">
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
      )}
    </div>
  );
};
