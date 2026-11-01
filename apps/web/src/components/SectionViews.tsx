import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { canViewIndividualGiving } from '@church/domain';
import {
  BookOpen,
  Calculator,
  Receipt,
  Users,
  BarChart3,
  Stethoscope,
  Settings,
  ShieldAlert,
  ShieldCheck,
  FileText,
} from 'lucide-react';

export const LedgerView: React.FC = () => (
  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
    <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
      <BookOpen className="w-6 h-6" />
      <h2>Double-Entry General Ledger</h2>
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Strict append-only double-entry ledger. Posted entries cannot be updated or deleted; corrections are executed via linked reversals.
    </p>
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
      <div className="font-semibold text-slate-800 dark:text-slate-200">Enforced Database Constraints:</div>
      <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
        <li>Deferred trigger checks Total Debits == Total Credits in base GHS at commit</li>
        <li>Fund accounting rule: entries must balance per fund or use interfund clearing (2020)</li>
        <li>Immutability trigger rejects any UPDATE or DELETE statement on journal_entries & lines</li>
        <li>Period locking trigger blocks postings into closed months</li>
      </ul>
    </div>
  </div>
);

export const CountingView: React.FC = () => (
  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
    <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
      <Calculator className="w-6 h-6" />
      <h2>Weekly Counting Sheet (Service-Day Offering)</h2>
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Denomination counting breakdown (GHS and USD) for service offerings and tithes.
    </p>
    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs space-y-1 text-amber-900 dark:text-amber-200">
      <span className="font-bold">Two-Counter Sign-off Enforced:</span> Two distinct Counters must digitally sign the sheet before it can post to the ledger. Counter A and Counter B must be different user UUIDs.
    </div>
  </div>
);

export const ExpensesView: React.FC = () => (
  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
    <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
      <Receipt className="w-6 h-6" />
      <h2>Requisitions, Approvals & Payment Vouchers</h2>
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Requisition workflow: Department Head submits requisition → Pastor / Elder approves or rejects → Treasurer / Finance Secretary issues payment voucher.
    </p>
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
      Vouchers generate offline with device prefix sequence (e.g. <span className="font-mono font-semibold">PV-FS-D01-000042</span>) and printable PDF receipt layout.
    </div>
  </div>
);

export const GivingView: React.FC = () => {
  const { currentUser } = useAuth();
  const canSeeGiving = canViewIndividualGiving(currentUser.role);

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
          <Users className="w-6 h-6" />
          <h2>Member Directory & Giving</h2>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${
            canSeeGiving
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
          }`}
        >
          {canSeeGiving ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          {canSeeGiving ? 'Full Giving Records Authorized' : 'Confidential: Totals Only'}
        </span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Member contact details and individual tithe records. Encrypted locally with Web Crypto API AES-GCM.
      </p>
    </div>
  );
};

export const ReportsView: React.FC = () => (
  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
    <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
      <BarChart3 className="w-6 h-6" />
      <h2>Financial Reports & Denomination USD Summary</h2>
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Complete suite of 11 financial statements operating offline from SQLite:
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      {[
        '1. Income and Expenditure Statement',
        '2. Balance Sheet / Financial Position',
        '3. Fund Balance Report (Restricted vs. Unrestricted)',
        '4. Budget vs. Actual',
        '5. Cash Flow Summary',
        '6. Giving Summary by Fund & Category',
        '7. Pledge Status Report',
        '8. Trial Balance & General Ledger',
        '9. Bank & Cash Reconciliation',
        '10. Audit Log Report',
        '11. Denomination USD Summary Report (Translated at period closing rate with rate disclosure)',
      ].map((rep, idx) => (
        <div
          key={idx}
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
        >
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{rep}</span>
        </div>
      ))}
    </div>
  </div>
);

export const DoctorView: React.FC = () => (
  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
    <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
      <Stethoscope className="w-6 h-6" />
      <h2>Trial Balance Doctor (Section 3.5 Diagnostic Engine)</h2>
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Runs 10 ordered diagnostic checks offline to detect where and why books do not balance, ranking causes without ever auto-fixing:
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        1. Summary: debits, credits, difference per fund & month
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        2. Unbalanced entries (lines not netting to zero)
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        3. Structural problems (orphans, missing accounts)
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        4. Sync gaps (line_count mismatch, device checksums)
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        5. Currency integrity (rate conversion, rounding &lt; 1p)
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        6. Duplicates and flawed reversals
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        7. Pattern detection on D: single line, D/2 swap, div-by-9 transposition, decimal slip
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        8. Time bisect: first date balance broke
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        9. Source breakdown (by user, device, sync batch)
      </div>
      <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        10. Opening balances and import verification
      </div>
    </div>
  </div>
);

import { BackupRestoreCard } from './settings/BackupRestoreCard.js';

export const SettingsView: React.FC = () => (
  <div className="space-y-6">
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
        <Settings className="w-6 h-6" />
        <h2>System Administration & Append-Only Audit Log</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Manage church users, device prefixes, local encrypted backup exports, and inspect the immutable audit log.
      </p>
    </div>

    {/* Encrypted Backup & Multi-Device Simulation */}
    <BackupRestoreCard />
  </div>
);
