import React, { useState, useContext } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Lock,
  Users,
  HardDriveDownload,
  X,
} from 'lucide-react';
import { useLedger } from '../../context/LedgerContext.js';
import { useDemo } from '../../context/DemoContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { formatDate } from '../../config/churchSettings.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

export const GoLiveReadinessPage: React.FC = () => {
  const {
    goLiveReadiness,
    goLiveState,
    roleTrainings,
    markRoleTrained,
    recordBackupAndRestoreTest,
    confirmGoLive,
  } = useLedger();
  const { isDemoMode, requestExitDemoMode } = useDemo();
  const { goBack, navigate, navigateToTab } = useRouter();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [treasurerSigner, setTreasurerSigner] = useState('Kofi Mensah (Treasurer)');
  const [pastorSigner, setPastorSigner] = useState('Rev. Emmanuel Addo (Senior Pastor / Elder)');
  const [permanentlyDisableDemo, setPermanentlyDisableDemo] = useState(true);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useModalEscape(isConfirmModalOpen, () => setIsConfirmModalOpen(false));

  const handleConfirmGoLive = () => {
    setConfirmError(null);
    try {
      confirmGoLive({
        treasurerName: treasurerSigner,
        pastorOrElderName: pastorSigner,
        permanentlyDisableDemoMode: permanentlyDisableDemo,
      });
      setIsConfirmModalOpen(false);
      showToast(
        'Calvary Crystal Church is now LIVE. Setup window closed and demo mode locked.',
        'success'
      );
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Could not complete Go-Live');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBack('settings')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Settings</span>
          </button>
          <div className="text-[13px] text-[var(--text-muted)]">
            <button onClick={() => navigateToTab('settings')} className="hover:underline">
              Settings
            </button>
            <span className="mx-1.5">/</span>
            <span className="text-[var(--text-primary)] font-semibold">
              Go-live readiness checklist
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('#/opening-balances')}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            Opening balances
          </button>
          <button
            onClick={() => navigate('#/imports')}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            Data import tool
          </button>
        </div>
      </div>

      {/* Header & Summary Card */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Go-live readiness checklist
              </h1>
              {goLiveReadiness.isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[12px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  LIVE BOOK OF RECORD
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[12px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Setup mode: not yet live
                </span>
              )}
            </div>
            <p className="text-[13px] text-[var(--text-muted)]">
              All 16 items below must pass before the Treasurer and a Pastor or Elder confirm Go-Live. Confirming Go-Live closes the setup window, locks demo mode, and records the official cut-over event.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-[13px] font-sans tabular-nums font-bold text-[var(--text-primary)]">
              {goLiveReadiness.passedCount} of {goLiveReadiness.totalCount} checks passed
            </div>
            {!goLiveReadiness.isLive ? (
              <button
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={!goLiveReadiness.allChecksPassed}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Go Live (Treasurer & Pastor/Elder)</span>
              </button>
            ) : (
              <div className="text-[12px] text-emerald-700 dark:text-emerald-400 font-medium text-right">
                Confirmed on {formatDate((goLiveReadiness.wentLiveAt || '2026-11-05').slice(0, 10))} by{' '}
                {goLiveReadiness.treasurerConfirmedBy} & {goLiveReadiness.pastorOrElderConfirmedBy}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 16 Live Readiness Checks Table */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            16 Required Pre-Go-Live Verification Items
          </h2>
          <span className="text-[12px] text-[var(--text-muted)]">
            Live status evaluated against the current database
          </span>
        </div>

        <table className="w-full text-[13px] font-sans tabular-nums">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
              <th className="py-2 px-3 w-12">#</th>
              <th className="py-2 px-3">Checklist item</th>
              <th className="py-2 px-3">Live verification detail</th>
              <th className="py-2 px-3 w-32">Status</th>
              <th className="py-2 px-3 text-right w-36">Screen link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {goLiveReadiness.items.map((item) => (
              <tr key={item.key} className="hover:bg-[var(--surface-subtle)]">
                <td className="py-2.5 px-3 font-bold text-[var(--text-muted)]">
                  {item.number}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-[var(--text-primary)]">{item.title}</div>
                  <div className="text-[12px] text-[var(--text-muted)]">{item.description}</div>
                </td>
                <td className="py-2.5 px-3 text-[var(--text-secondary)]">{item.statusText}</td>
                <td className="py-2.5 px-3">
                  {item.passed ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Passed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Pending</span>
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {item.key === 'DEMO_DATA_ABSENT' && isDemoMode ? (
                    <button
                      onClick={requestExitDemoMode}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 text-white text-[12px] font-semibold hover:bg-amber-700"
                    >
                      <span>Exit Demo Mode</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(item.targetRoute)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
                    >
                      <span>{item.actionLabel}</span>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Item #13 Detail: Role Training Sign-Off Table & Item #14 Backup/Restore Test Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Role training sign-off (Item #13)
              </h3>
            </div>
            <span className="text-[12px] text-[var(--text-muted)] font-sans tabular-nums">
              Every officer must be marked "Trained" with date
            </span>
          </div>

          <table className="w-full text-[13px] font-sans tabular-nums">
            <thead>
              <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                <th className="py-2 px-3">User</th>
                <th className="py-2 px-3">Assigned role</th>
                <th className="py-2 px-3">Training date</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {roleTrainings.map((rt) => (
                <tr key={rt.userId} className="hover:bg-[var(--surface-subtle)]">
                  <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">
                    {rt.userName}
                  </td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">{rt.role}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">
                    {rt.trained && rt.trainedDate ? formatDate(rt.trainedDate) : 'Not yet trained'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rt.trained}
                        onChange={(e) => {
                          markRoleTrained(rt.userId, e.target.checked, '2026-10-29');
                          showToast(
                            `${rt.userName} (${rt.role}) marked ${e.target.checked ? 'Trained' : 'Untrained'}`,
                            'neutral'
                          );
                        }}
                        className="rounded border-[var(--surface-border)] text-[var(--accent)]"
                      />
                      <span className="font-semibold text-[12px]">
                        {rt.trained ? 'Trained' : 'Mark trained'}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Item #14: First Encrypted Backup & Restore Test Verification */}
        <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2">
            <HardDriveDownload className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Backup & restore test (Item #14)
            </h3>
          </div>

          <p className="text-[13px] text-[var(--text-muted)]">
            A backup that has never been restored is not a backup. Both an encrypted snapshot export and a verified restore test are required before Go-Live.
          </p>

          <div className="space-y-3 text-[13px] font-sans tabular-nums">
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between">
              <div>
                <div className="font-semibold text-[var(--text-primary)]">1. Encrypted backup taken</div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  {goLiveState.backupTaken
                    ? `Verified on ${formatDate(goLiveState.lastBackupDate)}`
                    : 'Not yet taken'}
                </div>
              </div>
              <button
                onClick={() => {
                  recordBackupAndRestoreTest('BACKUP');
                  showToast('Encrypted pre-go-live backup recorded', 'success');
                }}
                className="px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
              >
                Run backup
              </button>
            </div>

            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between">
              <div>
                <div className="font-semibold text-[var(--text-primary)]">2. Restore test completed</div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  {goLiveState.restoreTested
                    ? `Verified on ${formatDate(goLiveState.lastRestoreTestDate)}`
                    : 'Not yet tested'}
                </div>
              </div>
              <button
                onClick={() => {
                  recordBackupAndRestoreTest('RESTORE_TEST');
                  showToast('Sandbox restore verification test passed', 'success');
                }}
                className="px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
              >
                Verify restore
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Centred Dialog: Go-Live Dual Confirmation */}
      {isConfirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="golive-confirm-title"
        >
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
                <h3 id="golive-confirm-title" className="text-base font-bold text-[var(--text-primary)]">
                  Confirm Go-Live and close setup window
                </h3>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[var(--text-secondary)]">
              <p>
                All 16 Go-Live readiness checks have passed. Confirming Go-Live will:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Make Calvary Crystal Church the official live book of record from the cut-over date.</li>
                <li>Close the one-time setup window (any subsequent imports or opening adjustments require Treasurer + reason + Pastor/Elder approval).</li>
                <li>Lock Demo Mode and remove the "Setup mode: not yet live" banner.</li>
              </ul>

              <div className="space-y-2.5 pt-2">
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-1">
                    Treasurer sign-off <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={treasurerSigner}
                    onChange={(e) => setTreasurerSigner(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-1">
                    Pastor or Elder confirmation <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={pastorSigner}
                    onChange={(e) => setPastorSigner(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium"
                  />
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permanentlyDisableDemo}
                    onChange={(e) => setPermanentlyDisableDemo(e.target.checked)}
                    className="rounded border-[var(--surface-border)] text-[var(--accent)]"
                  />
                  <span className="text-[12px] font-medium text-[var(--text-primary)]">
                    Lock and permanently disable Demo Mode on live terminals (Admin setting)
                  </span>
                </label>
              </div>

              {confirmError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[12px] font-medium">
                  {confirmError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-3.5 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGoLive}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Confirm Go-Live</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
