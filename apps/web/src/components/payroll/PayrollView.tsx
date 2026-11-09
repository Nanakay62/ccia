/**
 * PayrollView Component.
 * Church staff registry, monthly payroll execution with Ghana statutory SSNIT and PAYE deductions,
 * separation of duties approval workflow, statutory remittances, and individual printable payslips.
 * Meets UI Polish Spec A1 to A10.
 */

import React, { useState, useMemo, useContext } from 'react';
import {
  Printer,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Download,
  Lock,
  Smartphone,
  Info,
} from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext.js';
import type { EmploymentType, PayrollItem, StaffMember, Payslip } from '@church/domain';
import { useAuth } from '../../context/AuthContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { defaultChurchSettings, formatMoneyAmount, formatDate } from '../../config/churchSettings.js';

export const PayrollView: React.FC = () => {
  const {
    staffList,
    payrollRuns,
    activeRun,
    setActiveRunId,
    rateTable,
    salaryHistory,
    addStaffMember,
    runMonthlyPayroll,
    submitPayrollForApproval,
    approvePayrollRun,
    markPayrollAsPaid,
    markStatutoryAsPaid,
    setTaxOverride,
    getPayslipsForRun,
    logPayrollAudit,
  } = usePayroll();

  const { currentUser } = useAuth();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  // Role permissions
  const canViewPayroll =
    currentUser.role === 'Treasurer' ||
    currentUser.role === 'Finance Secretary' ||
    currentUser.role === 'Pastor / Elder' ||
    currentUser.role === 'Auditor';

  const canPrepare = currentUser.role === 'Treasurer' || currentUser.role === 'Finance Secretary';
  const canApprove = currentUser.role === 'Treasurer' || currentUser.role === 'Pastor / Elder';
  const isAuditorReadOnly = currentUser.role === 'Auditor';

  // Navigation Tabs: Payroll runs · Staff · Payslips (Rule A3)
  const [activeTab, setActiveTab] = useState<'RUNS' | 'STAFF' | 'PAYSLIPS'>('RUNS');

  // Selected staff for SlideOver detail drawer
  const [selectedStaffItem, setSelectedStaffItem] = useState<{
    item: PayrollItem;
    staff?: StaffMember;
  } | null>(null);

  // Masked reveal states (logs every reveal per Section 2.2 / 3.3)
  const [revealedStaffIds, setRevealedStaffIds] = useState<Record<string, boolean>>({});

  // Modals state
  const [isNewRunOpen, setIsNewRunOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);
  const [isStatutoryModalOpen, setIsStatutoryModalOpen] = useState<{
    type: 'SSNIT' | 'GRA';
    isOpen: boolean;
  }>({ type: 'SSNIT', isOpen: false });
  const [previewPayslip, setPreviewPayslip] = useState<Payslip | null>(null);

  // Modal forms state
  const [markPaidRef, setMarkPaidRef] = useState('');
  const [markPaidDate, setMarkPaidDate] = useState(() => '2026-10-28');
  const [statutoryRef, setStatutoryRef] = useState('');
  const [statutoryDate, setStatutoryDate] = useState(() => '2026-11-02');

  // Tax override state inside drawer
  const [taxOverrideGhs, setTaxOverrideGhs] = useState('');
  const [taxOverrideReason, setTaxOverrideReason] = useState('');

  // New Payroll Run Form State
  const [runMonth, setRunMonth] = useState(10);
  const [runYear, setRunYear] = useState(2026);
  const [runPayDate, setRunPayDate] = useState('2026-10-28');

  // Add Staff Form State
  const [newTitle, setNewTitle] = useState('Brother');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDept, setNewDept] = useState('Pastoral');
  const [newType, setNewType] = useState<EmploymentType>('FULL_TIME_STAFF');
  const [newStartDate, setNewStartDate] = useState('2026-01-15');
  const [newBasicGhs, setNewBasicGhs] = useState('');
  const [newHousingGhs, setNewHousingGhs] = useState('');
  const [newTransportGhs, setNewTransportGhs] = useState('');
  const [newPastoralGhs, setNewPastoralGhs] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newBankAcct, setNewBankAcct] = useState('');
  const [newMomoNet, setNewMomoNet] = useState<'MTN' | 'VODAFONE' | 'AIRTELTIGO'>('MTN');
  const [newMomoPhone, setNewMomoPhone] = useState('');
  const [newTin, setNewTin] = useState('');
  const [newSsnit, setNewSsnit] = useState('');

  useModalEscape(isNewRunOpen, () => setIsNewRunOpen(false));
  useModalEscape(isAddStaffOpen, () => setIsAddStaffOpen(false));
  useModalEscape(isMarkPaidModalOpen, () => setIsMarkPaidModalOpen(false));
  useModalEscape(isStatutoryModalOpen.isOpen, () =>
    setIsStatutoryModalOpen({ type: 'SSNIT', isOpen: false })
  );
  useModalEscape(Boolean(previewPayslip), () => setPreviewPayslip(null));

  const currentRun = activeRun || payrollRuns[0];
  const payslips = currentRun ? getPayslipsForRun(currentRun.id) : [];

  const staffMap = useMemo(() => {
    return new Map(staffList.map((s) => [s.id, s]));
  }, [staffList]);

  // Handle masking toggle with audit logging
  const handleToggleMask = (staffId: string, staffName: string) => {
    const isCurrentlyRevealed = Boolean(revealedStaffIds[staffId]);
    if (!isCurrentlyRevealed) {
      logPayrollAudit(`revealed confidential payment coordinates for ${staffName}`, staffId);
    }
    setRevealedStaffIds((prev) => ({
      ...prev,
      [staffId]: !isCurrentlyRevealed,
    }));
  };

  // Mask string helper
  const maskText = (val?: string): string => {
    if (!val) return '—';
    if (val.length <= 4) return '••••';
    return `•••• •••• ${val.slice(-4)}`;
  };

  // Mask phone helper
  const maskPhone = (val?: string): string => {
    if (!val) return '—';
    if (val.length < 7) return '••••••';
    return `${val.slice(0, 3)} ••• ••${val.slice(-2)}`;
  };

  // Restrict access for non-financial roles
  if (!canViewPayroll) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 my-12 bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)]">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-center text-[var(--text-muted)]">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">Access restricted</h2>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Church staff compensation, statutory withholdings and payroll records are restricted to authorized finance roles (Treasurer, Finance Secretary, Pastor / Elder, Auditor).
          </p>
        </div>
      </div>
    );
  }

  // Handle workflow actions
  const handleSubmitForApproval = () => {
    if (!currentRun) return;
    submitPayrollForApproval(currentRun.id);
    showToast({ message: `Payroll run ${currentRun.payrollNumber} submitted for Pastoral / Elder approval.` });
  };

  const handleApproveRun = () => {
    if (!currentRun) return;
    try {
      approvePayrollRun(currentRun.id, 'Approved for disbursement per budget.');
      showToast({ message: `Payroll run ${currentRun.payrollNumber} approved. Journal entry posted to ledger.` });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmMarkAsPaid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRun) return;
    try {
      markPayrollAsPaid(currentRun.id, markPaidRef, markPaidDate);
      setIsMarkPaidModalOpen(false);
      showToast({ message: `Payroll run ${currentRun.payrollNumber} marked as paid (Ref: ${markPaidRef}).` });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmStatutoryPaid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRun) return;
    try {
      markStatutoryAsPaid(currentRun.id, isStatutoryModalOpen.type, statutoryRef, statutoryDate);
      setIsStatutoryModalOpen({ type: 'SSNIT', isOpen: false });
      showToast({
        message: `${isStatutoryModalOpen.type} statutory remittance marked as paid (Ref: ${statutoryRef}).`,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleApplyTaxOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRun || !selectedStaffItem) return;
    const num = parseFloat(taxOverrideGhs);
    if (isNaN(num) || num < 0) {
      alert('Enter a valid non-negative tax amount in GHS.');
      return;
    }
    if (!taxOverrideReason.trim()) {
      alert('A required justification reason must be documented for tax overrides.');
      return;
    }

    const pesewas = BigInt(Math.round(num * 100));
    setTaxOverride(currentRun.id, selectedStaffItem.item.staffId, pesewas, taxOverrideReason.trim());
    showToast({
      message: `Tax override applied for ${selectedStaffItem.item.fullName}: GHS ${num.toFixed(2)}.`,
    });
    setTaxOverrideGhs('');
    setTaxOverrideReason('');
  };

  // Export Bank payment schedule CSV
  const handleExportBankSchedule = () => {
    if (!currentRun) return;
    const rows = [
      ['Staff Number', 'Staff Name', 'Bank Name', 'Account Number', 'Net Pay (GHS)', 'Payment Reference'],
      ...currentRun.items
        .filter((it) => it.paymentMethod === 'BANK')
        .map((it) => {
          const s = staffMap.get(it.staffId);
          return [
            it.staffNumber,
            it.fullName,
            s?.bankName || 'GCB Bank',
            s?.bankAccountNumber || '—',
            (Number(it.netSalaryPesewas) / 100).toFixed(2),
            `${currentRun.payrollNumber}-${it.staffNumber}`,
          ];
        }),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bank_Payment_Schedule_${currentRun.payrollNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logPayrollAudit(`exported bank payment schedule CSV for ${currentRun.payrollNumber}`, currentRun.id);
    showToast({ message: 'Bank payment schedule CSV exported.' });
  };

  // Export MoMo Bulk Transfer CSV
  const handleExportMomoBulk = () => {
    if (!currentRun) return;
    const rows = [
      ['Staff Number', 'Staff Name', 'Network', 'MoMo Number', 'Amount (GHS)', 'Reference'],
      ...currentRun.items
        .filter((it) => it.paymentMethod === 'MOMO')
        .map((it) => {
          const s = staffMap.get(it.staffId);
          return [
            it.staffNumber,
            it.fullName,
            s?.momoNetwork || 'MTN',
            s?.momoNumber || '—',
            (Number(it.netSalaryPesewas) / 100).toFixed(2),
            `${currentRun.payrollNumber}-${it.staffNumber}`,
          ];
        }),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MoMo_Bulk_Transfer_${currentRun.payrollNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logPayrollAudit(`exported MoMo bulk transfer CSV for ${currentRun.payrollNumber}`, currentRun.id);
    showToast({ message: 'MoMo bulk transfer CSV exported.' });
  };

  // Handle new staff registration
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newRole.trim()) {
      alert('Please enter staff name and role designation.');
      return;
    }

    const toPesewas = (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) || num <= 0 ? 0n : BigInt(Math.round(num * 100));
    };

    addStaffMember({
      branchId: currentUser.branchId,
      title: newTitle.trim() || undefined,
      fullName: newFullName.trim(),
      roleTitle: newRole.trim(),
      department: newDept,
      employmentType: newType,
      startDate: newStartDate,
      basicSalaryPesewas: toPesewas(newBasicGhs),
      housingAllowancePesewas: toPesewas(newHousingGhs),
      transportAllowancePesewas: toPesewas(newTransportGhs),
      pastoralResponsibilityPesewas: toPesewas(newPastoralGhs),
      bankName: newBank.trim() || undefined,
      bankAccountNumber: newBankAcct.trim() || undefined,
      momoNetwork: newMomoNet,
      momoNumber: newMomoPhone.trim() || undefined,
      tinNumber: newTin.trim() || undefined,
      ssnitNumber: newSsnit.trim() || undefined,
      isActive: true,
    });

    setIsAddStaffOpen(false);
    setNewFullName('');
    setNewRole('');
    setNewBasicGhs('');
    setNewHousingGhs('');
    setNewTransportGhs('');
    setNewPastoralGhs('');
    setNewBankAcct('');
    setNewMomoPhone('');
    setNewTin('');
    setNewSsnit('');
    showToast({ message: 'New church staff member registered.' });
  };

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* 1. Header and Status Line (Rule A1, Section 3.3) */}
      <div className="space-y-3 pb-2 border-b border-[var(--surface-border)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">
              Payroll
            </h2>

            {/* Month Selector Dropdown */}
            {payrollRuns.length > 0 && (
              <select
                value={currentRun?.id || ''}
                onChange={(e) => setActiveRunId(e.target.value)}
                className="px-2.5 py-1 text-[13px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-medium focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {payrollRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.periodMonth === 10 ? 'October 2026' : `Period ${r.periodMonth}/${r.periodYear}`} ({r.payrollNumber})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Action Button Based on State */}
            {currentRun?.status === 'DRAFT' && canPrepare && (
              <button
                onClick={handleSubmitForApproval}
                className="px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-medium transition hover:opacity-95 shadow-xs"
              >
                Submit for approval
              </button>
            )}

            {currentRun?.status === 'SUBMITTED' && canApprove && (
              <button
                onClick={handleApproveRun}
                className="px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-medium transition hover:opacity-95 shadow-xs"
              >
                Approve run
              </button>
            )}

            {currentRun?.status === 'APPROVED' && canPrepare && (
              <button
                onClick={() => setIsMarkPaidModalOpen(true)}
                className="px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-medium transition hover:opacity-95 shadow-xs"
              >
                Mark as paid
              </button>
            )}

            {/* Secondary Export & Add Staff Actions */}
            <button
              onClick={handleExportBankSchedule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] text-[13px] font-medium transition"
              title="Download Bank Payment Schedule CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Bank schedule (CSV)</span>
            </button>

            <button
              onClick={handleExportMomoBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] text-[13px] font-medium transition"
              title="Download MoMo Bulk Transfer CSV"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>MoMo file (CSV)</span>
            </button>

            {canPrepare && (
              <button
                onClick={() => setIsNewRunOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] text-[13px] font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Prepare run</span>
              </button>
            )}
          </div>
        </div>

        {/* Single status line under the header (no tinted box, Rule A1, Section 3.3) */}
        {currentRun && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            {currentRun.status === 'APPROVED' ? (
              <>
                <AlertCircle className="w-4 h-4 text-[var(--status-amber)] shrink-0" />
                <span>
                  October 2026 · Approved 28 Oct 2026 by {currentRun.approvedByName || 'Rev. Emmanuel Addo'} ·{' '}
                  <span className="text-[var(--status-red)] font-medium">Overdue</span> · Awaiting payment · Posted as{' '}
                  <span className="underline decoration-dotted text-[var(--text-primary)] cursor-pointer">
                    {currentRun.journalEntryId || 'JE-0231'}
                  </span>
                </span>
              </>
            ) : currentRun.status === 'PAID' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[var(--status-green)] shrink-0" />
                <span>
                  October 2026 · Paid {formatDate(currentRun.paidAt)} · Reference: {currentRun.paidReference} · Posted as{' '}
                  {currentRun.journalEntryId}
                </span>
              </>
            ) : currentRun.status === 'SUBMITTED' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--status-amber)] inline-block shrink-0" />
                <span>October 2026 · Submitted {formatDate(currentRun.submittedAt)} · Awaiting Pastor / Elder sign-off</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] inline-block shrink-0" />
                <span>October 2026 · Draft prepared by {currentRun.preparedByName} · Awaiting submission</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Underline Tabs (Rule A3): Payroll runs · Staff · Payslips */}
      <nav className="flex space-x-6 border-b border-[var(--surface-border)] text-[13px]">
        <button
          onClick={() => setActiveTab('RUNS')}
          className={`pb-2.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'RUNS'
              ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Payroll runs ({payrollRuns.length})
        </button>
        <button
          onClick={() => setActiveTab('STAFF')}
          className={`pb-2.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'STAFF'
              ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Staff ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('PAYSLIPS')}
          className={`pb-2.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'PAYSLIPS'
              ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Payslips ({payslips.length})
        </button>
      </nav>

      {/* TAB 1: PAYROLL RUNS */}
      {activeTab === 'RUNS' && currentRun && (
        <div className="space-y-6">
          {/* Executive Summary: One plain row of neutral numbers (Section 3.3) */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)]/40 border border-[var(--surface-border)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-[13px]">
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]">Gross pay</span>
                <div className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  GHS {formatMoneyAmount(currentRun.totalGrossPesewas)}
                </div>
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]">Employee SSNIT (5.5%)</span>
                <div className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  GHS {formatMoneyAmount(currentRun.totalEmployeeSsnitPesewas)}
                </div>
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]">PAYE</span>
                <div className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  GHS {formatMoneyAmount(currentRun.totalPayePesewas)}
                </div>
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]">Net pay</span>
                <div className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  GHS {formatMoneyAmount(currentRun.totalNetPayPesewas)}
                </div>
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]">Employer SSNIT (13%)</span>
                <div className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  GHS {formatMoneyAmount(currentRun.totalEmployerSsnitPesewas)}
                </div>
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]">Total cost to church</span>
                <div className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  GHS {formatMoneyAmount(currentRun.totalPayrollCostPesewas)}
                </div>
              </div>
            </div>
          </div>

          {/* Payroll Items Table (Section 3.3) */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-[12px]">
                    <th className="py-2.5 px-4 text-left font-medium">Staff</th>
                    <th className="py-2.5 px-4 text-right font-medium">Basic (GHS)</th>
                    <th className="py-2.5 px-4 text-right font-medium">Allowances</th>
                    <th className="py-2.5 px-4 text-right font-medium">Gross</th>
                    <th className="py-2.5 px-4 text-right font-medium">SSNIT (employee)</th>
                    <th className="py-2.5 px-4 text-right font-medium">PAYE</th>
                    <th className="py-2.5 px-4 text-right font-medium">Net pay</th>
                    <th className="py-2.5 px-4 text-center font-medium">Paid via</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {currentRun.items.map((item) => {
                    const staff = staffMap.get(item.staffId);
                    return (
                      <tr
                        key={item.staffId}
                        onClick={() => setSelectedStaffItem({ item, staff })}
                        className="hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4 text-left">
                          <div className="font-medium text-[var(--text-primary)]">
                            {staff?.title ? `${staff.title} ` : ''}
                            {item.fullName}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {item.staffNumber} · {item.roleTitle}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)]">
                          {formatMoneyAmount(item.basicSalaryPesewas)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.totalAllowancesPesewas)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(item.grossSalaryPesewas)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.ssnitTier1EmployeePesewas)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.payeTaxPesewas)}
                          {item.taxOverridden && (
                            <span className="ml-1 text-[10px] text-[var(--status-amber)] font-medium">
                              (override)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)] font-semibold">
                          {formatMoneyAmount(item.netSalaryPesewas)}
                        </td>
                        <td className="py-2.5 px-4 text-center text-[var(--text-secondary)]">
                          {item.paymentMethod === 'BANK' ? 'Bank' : item.paymentMethod === 'MOMO' ? 'MoMo' : 'Cash'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals Row */}
                <tfoot>
                  <tr className="border-t-2 border-[var(--surface-border)] bg-[var(--surface-subtle)]/70 font-semibold text-[var(--text-primary)]">
                    <td className="py-2.5 px-4 text-left">Total</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {formatMoneyAmount(currentRun.totalBasicPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {formatMoneyAmount(currentRun.totalAllowancesPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {formatMoneyAmount(currentRun.totalGrossPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {formatMoneyAmount(currentRun.totalEmployeeSsnitPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {formatMoneyAmount(currentRun.totalPayePesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {formatMoneyAmount(currentRun.totalNetPayPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-center text-[11px] text-[var(--text-secondary)]">
                      {currentRun.items.length} staff
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Statutory Remittances Block (Section 3.3) */}
          <div className="space-y-3">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Statutory Remittances
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SSNIT Card */}
              <div className="p-4 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-[14px] font-medium text-[var(--text-primary)]">
                      Social Security & National Insurance Trust (SSNIT)
                    </h4>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Tier 1 statutory contribution (Employee 5.5% + Employer 13.0%)
                    </p>
                  </div>
                  <span className="text-[12px] flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        currentRun.statutorySsnitPaid ? 'bg-[var(--status-green)]' : 'bg-[var(--status-amber)]'
                      }`}
                    />
                    {currentRun.statutorySsnitPaid ? 'Paid' : 'Pending remittance'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px] pt-2 border-t border-[var(--surface-border)]">
                  <div>
                    <span className="text-[var(--text-secondary)]">Employee 5.5%:</span>
                    <div className="font-medium tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(currentRun.totalEmployeeSsnitPesewas)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Employer 13.0%:</span>
                    <div className="font-medium tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(currentRun.totalEmployerSsnitPesewas)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-border)] text-[13px]">
                  <div>
                    <span className="text-[12px] text-[var(--text-secondary)]">Total due (by 14 Nov 2026):</span>
                    <div className="font-semibold tabular-nums text-[var(--text-primary)]">
                      GHS{' '}
                      {formatMoneyAmount(
                        currentRun.totalEmployeeSsnitPesewas + currentRun.totalEmployerSsnitPesewas
                      )}
                    </div>
                  </div>

                  {!currentRun.statutorySsnitPaid && canPrepare && (
                    <button
                      onClick={() => setIsStatutoryModalOpen({ type: 'SSNIT', isOpen: true })}
                      className="px-3 py-1 rounded-[var(--radius)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[12px] font-medium text-[var(--text-primary)] transition"
                    >
                      Mark as paid
                    </button>
                  )}
                  {currentRun.statutorySsnitPaid && (
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Ref: {currentRun.statutorySsnitPaidRef}
                    </span>
                  )}
                </div>
              </div>

              {/* GRA PAYE Card */}
              <div className="p-4 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-[14px] font-medium text-[var(--text-primary)]">
                      Ghana Revenue Authority (GRA)
                    </h4>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Statutory Pay-As-You-Earn (PAYE) income tax withholding
                    </p>
                  </div>
                  <span className="text-[12px] flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        currentRun.statutoryPayePaid ? 'bg-[var(--status-green)]' : 'bg-[var(--status-amber)]'
                      }`}
                    />
                    {currentRun.statutoryPayePaid ? 'Paid' : 'Pending remittance'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px] pt-2 border-t border-[var(--surface-border)]">
                  <div>
                    <span className="text-[var(--text-secondary)]">Chargeable income:</span>
                    <div className="font-medium tabular-nums text-[var(--text-primary)]">
                      GHS{' '}
                      {formatMoneyAmount(
                        currentRun.totalGrossPesewas - currentRun.totalEmployeeSsnitPesewas
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Tax withholding:</span>
                    <div className="font-medium tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(currentRun.totalPayePesewas)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-border)] text-[13px]">
                  <div>
                    <span className="text-[12px] text-[var(--text-secondary)]">Total due (by 15 Nov 2026):</span>
                    <div className="font-semibold tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(currentRun.totalPayePesewas)}
                    </div>
                  </div>

                  {!currentRun.statutoryPayePaid && canPrepare && (
                    <button
                      onClick={() => setIsStatutoryModalOpen({ type: 'GRA', isOpen: true })}
                      className="px-3 py-1 rounded-[var(--radius)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[12px] font-medium text-[var(--text-primary)] transition"
                    >
                      Mark as paid
                    </button>
                  )}
                  {currentRun.statutoryPayePaid && (
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Ref: {currentRun.statutoryPayePaidRef}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rate table verification notice (Section 3.1) */}
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] pt-1">
              <Info className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span>
                Rate table version: <span className="font-medium">{rateTable.version}</span> (effective{' '}
                {rateTable.effectiveDate}) · Pending Chief Accountant sign-off against current GRA & SSNIT gazette.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF REGISTRY */}
      {activeTab === 'STAFF' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Staff Registry</h3>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Active church clergy and administrative staff with employment records and compensation.
              </p>
            </div>

            {canPrepare && (
              <button
                onClick={() => setIsAddStaffOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-medium transition hover:opacity-95 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add staff member</span>
              </button>
            )}
          </div>

          {/* Staff Table */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-[12px]">
                    <th className="py-2.5 px-4 text-left font-medium">Staff #</th>
                    <th className="py-2.5 px-4 text-left font-medium">Name & Title</th>
                    <th className="py-2.5 px-4 text-left font-medium">Designation</th>
                    <th className="py-2.5 px-4 text-left font-medium">Department</th>
                    <th className="py-2.5 px-4 text-left font-medium">Start Date</th>
                    <th className="py-2.5 px-4 text-right font-medium">Basic (GHS)</th>
                    <th className="py-2.5 px-4 text-right font-medium">Allowances</th>
                    <th className="py-2.5 px-4 text-left font-medium">SSNIT #</th>
                    <th className="py-2.5 px-4 text-left font-medium">TIN</th>
                    <th className="py-2.5 px-4 text-left font-medium">Payment details</th>
                    <th className="py-2.5 px-4 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {staffList.map((s) => {
                    const isRevealed = Boolean(revealedStaffIds[s.id]);
                    const totalAllowances =
                      s.housingAllowancePesewas +
                      s.transportAllowancePesewas +
                      s.pastoralResponsibilityPesewas;
                    const paymentCoords = s.bankAccountNumber
                      ? `${s.bankName} · ${isRevealed ? s.bankAccountNumber : maskText(s.bankAccountNumber)}`
                      : s.momoNumber
                      ? `${s.momoNetwork} · ${isRevealed ? s.momoNumber : maskPhone(s.momoNumber)}`
                      : 'Cash';

                    return (
                      <tr key={s.id} className="hover:bg-[var(--surface-subtle)] transition-colors">
                        <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">{s.staffNumber}</td>
                        <td className="py-2.5 px-4 text-left font-medium text-[var(--text-primary)]">
                          {s.title ? `${s.title} ` : ''}
                          {s.fullName}
                        </td>
                        <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">{s.roleTitle}</td>
                        <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">{s.department}</td>
                        <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">
                          {formatDate(s.startDate)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(s.basicSalaryPesewas)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                          {formatMoneyAmount(totalAllowances)}
                        </td>
                        <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">
                          {s.ssnitNumber || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">
                          {s.tinNumber || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1.5">
                            <span>{paymentCoords}</span>
                            {(s.bankAccountNumber || s.momoNumber) && (
                              <button
                                onClick={() => handleToggleMask(s.id, s.fullName)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                                title={isRevealed ? 'Hide details' : 'Show details (logged)'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {s.isActive ? (
                            <span className="text-[12px] text-[var(--text-secondary)]">Active</span>
                          ) : (
                            <span className="text-[12px] text-[var(--status-red)]">Inactive</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Salary History Table (Section 3.3) */}
          <div className="space-y-3 pt-4 border-t border-[var(--surface-border)]">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Salary Adjustment History</h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Audit trail of compensation revisions, approvals, and budget justifications.
            </p>

            <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-[12px]">
                    <th className="py-2 px-4 text-left font-medium">Effective Date</th>
                    <th className="py-2 px-4 text-left font-medium">Staff Member</th>
                    <th className="py-2 px-4 text-right font-medium">Previous Basic</th>
                    <th className="py-2 px-4 text-right font-medium">New Basic</th>
                    <th className="py-2 px-4 text-left font-medium">Changed By</th>
                    <th className="py-2 px-4 text-left font-medium">Approved By</th>
                    <th className="py-2 px-4 text-left font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {salaryHistory.map((hist) => (
                    <tr key={hist.id} className="hover:bg-[var(--surface-subtle)]/50">
                      <td className="py-2 px-4 text-left text-[var(--text-secondary)]">{formatDate(hist.effectiveDate)}</td>
                      <td className="py-2 px-4 text-left font-medium text-[var(--text-primary)]">{hist.fullName}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                        GHS {formatMoneyAmount(hist.previousBasicPesewas)}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-[var(--text-primary)] font-medium">
                        GHS {formatMoneyAmount(hist.newBasicPesewas)}
                      </td>
                      <td className="py-2 px-4 text-left text-[var(--text-secondary)]">{hist.changedBy}</td>
                      <td className="py-2 px-4 text-left text-[var(--text-secondary)]">{hist.approvedBy}</td>
                      <td className="py-2 px-4 text-left text-[var(--text-secondary)]">{hist.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF PAYSLIPS */}
      {activeTab === 'PAYSLIPS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Staff Payslips</h3>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Monthly printable payslips with church letterhead, allowances breakdown, and statutory withholdings.
              </p>
            </div>
          </div>

          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-[12px]">
                  <th className="py-2.5 px-4 text-left font-medium">Payslip #</th>
                  <th className="py-2.5 px-4 text-left font-medium">Staff Member</th>
                  <th className="py-2.5 px-4 text-left font-medium">Designation</th>
                  <th className="py-2.5 px-4 text-right font-medium">Gross Pay</th>
                  <th className="py-2.5 px-4 text-right font-medium">Total Deductions</th>
                  <th className="py-2.5 px-4 text-right font-medium">Net Disbursed</th>
                  <th className="py-2.5 px-4 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {payslips.map((slip) => (
                  <tr key={slip.payslipNumber} className="hover:bg-[var(--surface-subtle)] transition-colors">
                    <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">{slip.payslipNumber}</td>
                    <td className="py-2.5 px-4 text-left font-medium text-[var(--text-primary)]">{slip.fullName}</td>
                    <td className="py-2.5 px-4 text-left text-[var(--text-secondary)]">{slip.roleTitle}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(slip.grossSalaryPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                      -GHS {formatMoneyAmount(slip.totalDeductionsPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)] font-semibold">
                      GHS {formatMoneyAmount(slip.netSalaryPesewas)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => setPreviewPayslip(slip)}
                        className="px-2.5 py-1 rounded-[var(--radius)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[12px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Preview & Print</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Staff Detail SlideOverPanel (Rule A9, Section 3.3) */}
      <SlideOverPanel
        isOpen={Boolean(selectedStaffItem)}
        onClose={() => setSelectedStaffItem(null)}
        title={selectedStaffItem?.item.fullName || 'Staff Member'}
        subtitle={`${selectedStaffItem?.item.staffNumber} · ${selectedStaffItem?.item.roleTitle} · ${selectedStaffItem?.staff?.department || 'Pastoral'}`}
        width="max-w-[480px]"
        actions={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                if (!selectedStaffItem) return;
                const slip = payslips.find((p) => p.staffNumber === selectedStaffItem.item.staffNumber);
                if (slip) setPreviewPayslip(slip);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[13px] font-medium text-[var(--text-primary)] transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print payslip</span>
            </button>
            <button
              onClick={() => setSelectedStaffItem(null)}
              className="px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[13px] font-medium text-[var(--text-primary)] transition"
            >
              Done
            </button>
          </div>
        }
      >
        {selectedStaffItem && (
          <div className="space-y-6 text-[13px]">
            {/* Compensation & Allowances Itemization */}
            <div className="space-y-2">
              <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Earnings Breakdown
              </h4>
              <div className="p-3.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Basic Salary:</span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    GHS {formatMoneyAmount(selectedStaffItem.item.basicSalaryPesewas)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">Housing Allowance:</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    GHS {formatMoneyAmount(selectedStaffItem.item.housingAllowancePesewas)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">Transport Allowance:</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    GHS {formatMoneyAmount(selectedStaffItem.item.transportAllowancePesewas)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">Pastoral Responsibility:</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    GHS {formatMoneyAmount(selectedStaffItem.item.pastoralResponsibilityPesewas)}
                  </span>
                </div>
                <div className="pt-2 border-t border-[var(--surface-border)] flex justify-between font-semibold">
                  <span className="text-[var(--text-primary)]">Gross Salary:</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    GHS {formatMoneyAmount(selectedStaffItem.item.grossSalaryPesewas)}
                  </span>
                </div>
              </div>
            </div>

            {/* Deductions & Statutory Taxes */}
            <div className="space-y-2">
              <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Statutory Deductions & Net Pay
              </h4>
              <div className="p-3.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">SSNIT Employee (5.5%):</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    -GHS {formatMoneyAmount(selectedStaffItem.item.ssnitTier1EmployeePesewas)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">Chargeable Income:</span>
                  <span className="tabular-nums text-[var(--text-secondary)]">
                    GHS{' '}
                    {formatMoneyAmount(
                      selectedStaffItem.item.taxableIncomePesewas ??
                        (selectedStaffItem.item.grossSalaryPesewas -
                          selectedStaffItem.item.ssnitTier1EmployeePesewas)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    PAYE Income Tax:
                    {selectedStaffItem.item.taxOverridden && (
                      <span className="ml-1 text-[11px] text-[var(--status-amber)] font-medium">
                        (Manual override)
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    -GHS {formatMoneyAmount(selectedStaffItem.item.payeTaxPesewas)}
                  </span>
                </div>
                {selectedStaffItem.item.taxOverrideReason && (
                  <p className="text-[11px] text-[var(--text-secondary)] italic bg-[var(--surface-subtle)] p-2 rounded">
                    Override reason: {selectedStaffItem.item.taxOverrideReason}
                  </p>
                )}
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">Total Deductions:</span>
                  <span className="tabular-nums text-[var(--text-secondary)]">
                    -GHS {formatMoneyAmount(selectedStaffItem.item.totalDeductionsPesewas)}
                  </span>
                </div>
                <div className="pt-2 border-t border-[var(--surface-border)] flex justify-between font-bold text-[14px]">
                  <span className="text-[var(--text-primary)]">Net Pay Disbursed:</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    GHS {formatMoneyAmount(selectedStaffItem.item.netSalaryPesewas)}
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Tax Override (Section 3.1) */}
            {canPrepare && !isAuditorReadOnly && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Manual Tax Override
                </h4>
                <form
                  onSubmit={handleApplyTaxOverride}
                  className="p-3.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)]/40 space-y-2.5"
                >
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Allows adjusting calculated PAYE with chief accountant or tax office clearance. A documented reason is required and logged.
                  </p>
                  <div>
                    <label className="text-[12px] font-medium text-[var(--text-primary)]">
                      Override PAYE Amount (GHS)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={taxOverrideGhs}
                      onChange={(e) => setTaxOverrideGhs(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-[13px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[var(--text-primary)]">
                      Reason for Override *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Tax relief allowance approved by GRA"
                      value={taxOverrideReason}
                      onChange={(e) => setTaxOverrideReason(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-[13px]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] text-[12px] font-medium transition hover:opacity-95"
                  >
                    Apply Tax Override
                  </button>
                </form>
              </div>
            )}

            {/* Confidential Payment Routing Coordinates */}
            <div className="space-y-2">
              <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Payment Routing Coordinates
              </h4>
              <div className="p-3.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Method:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedStaffItem.item.paymentMethod === 'BANK'
                      ? 'Bank Transfer'
                      : selectedStaffItem.item.paymentMethod === 'MOMO'
                      ? 'Mobile Money'
                      : 'Cash'}
                  </span>
                </div>
                {selectedStaffItem.staff?.bankName && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Bank:</span>
                    <span className="text-[var(--text-primary)]">{selectedStaffItem.staff.bankName}</span>
                  </div>
                )}
                {selectedStaffItem.staff?.bankAccountNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Account:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums text-[var(--text-primary)] font-medium">
                        {revealedStaffIds[selectedStaffItem.item.staffId]
                          ? selectedStaffItem.staff.bankAccountNumber
                          : maskText(selectedStaffItem.staff.bankAccountNumber)}
                      </span>
                      <button
                        onClick={() =>
                          handleToggleMask(selectedStaffItem.item.staffId, selectedStaffItem.item.fullName)
                        }
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                      >
                        {revealedStaffIds[selectedStaffItem.item.staffId] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                {selectedStaffItem.staff?.momoNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">MoMo Number:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums text-[var(--text-primary)] font-medium">
                        {revealedStaffIds[selectedStaffItem.item.staffId]
                          ? selectedStaffItem.staff.momoNumber
                          : maskPhone(selectedStaffItem.staff.momoNumber)}
                      </span>
                      <button
                        onClick={() =>
                          handleToggleMask(selectedStaffItem.item.staffId, selectedStaffItem.item.fullName)
                        }
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                      >
                        {revealedStaffIds[selectedStaffItem.item.staffId] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* 4. Modal: Mark Payroll Run as Paid */}
      {isMarkPaidModalOpen && currentRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Disburse Payroll — {currentRun.payrollNumber}
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Enter bank batch transmission code or mobile money disbursement reference to mark all salaries as paid.
            </p>

            <form onSubmit={handleConfirmMarkAsPaid} className="space-y-4 text-[13px]">
              <div>
                <label className="font-medium text-[var(--text-primary)]">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={markPaidDate}
                  onChange={(e) => setMarkPaidDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="font-medium text-[var(--text-primary)]">
                  Payment Reference (Bank Batch or MoMo ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GCB-BATCH-91024 or MTN-MOMO-TX-492"
                  value={markPaidRef}
                  onChange={(e) => setMarkPaidRef(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                />
              </div>

              <div className="p-3 bg-[var(--surface-subtle)] rounded-[var(--radius)] text-[12px] text-[var(--text-secondary)]">
                Total net salaries to disburse:{' '}
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  GHS {formatMoneyAmount(currentRun.totalNetPayPesewas)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsMarkPaidModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] font-medium transition hover:opacity-95"
                >
                  Confirm Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Mark Statutory Payment as Paid */}
      {isStatutoryModalOpen.isOpen && currentRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Record {isStatutoryModalOpen.type} Remittance
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Document the official payment receipt or electronic clearing reference for{' '}
              {isStatutoryModalOpen.type === 'SSNIT' ? 'SSNIT Tier 1 contributions' : 'GRA PAYE monthly taxes'}.
            </p>

            <form onSubmit={handleConfirmStatutoryPaid} className="space-y-4 text-[13px]">
              <div>
                <label className="font-medium text-[var(--text-primary)]">Remittance Date *</label>
                <input
                  type="date"
                  required
                  value={statutoryDate}
                  onChange={(e) => setStatutoryDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="font-medium text-[var(--text-primary)]">
                  Official Transaction Receipt / Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    isStatutoryModalOpen.type === 'SSNIT'
                      ? 'e.g. SSNIT-EPAY-819203'
                      : 'e.g. GRA-TP-RCPT-2026-10-891'
                  }
                  value={statutoryRef}
                  onChange={(e) => setStatutoryRef(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsStatutoryModalOpen({ type: 'SSNIT', isOpen: false })}
                  className="px-3.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] font-medium transition hover:opacity-95"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Add Staff Member */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none overflow-y-auto animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-lg p-6 space-y-4 shadow-xl my-8">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">Register Church Staff Member</h3>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3.5 text-[13px]">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Title</label>
                  <select
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    <option value="Pastor">Pastor</option>
                    <option value="Rev.">Rev.</option>
                    <option value="Elder">Elder</option>
                    <option value="Deacon">Deacon</option>
                    <option value="Deaconess">Deaconess</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="font-medium text-[var(--text-primary)]">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Emmanuel Mensah"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Designation / Role *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Media & Sound Lead"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    <option value="Pastoral">Pastoral</option>
                    <option value="Administration">Administration</option>
                    <option value="Music">Music & Media</option>
                    <option value="Youth Ministry">Youth Ministry</option>
                    <option value="Facilities">Facilities</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Employment Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as EmploymentType)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    <option value="PASTORAL_CLERGY">Pastoral Clergy</option>
                    <option value="FULL_TIME_STAFF">Full Time Staff</option>
                    <option value="PART_TIME_STAFF">Part Time Staff</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Appointment Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--surface-border)]">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Basic Salary (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newBasicGhs}
                    onChange={(e) => setNewBasicGhs(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] tabular-nums"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Housing Allowance (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newHousingGhs}
                    onChange={(e) => setNewHousingGhs(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Transport Allowance (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newTransportGhs}
                    onChange={(e) => setNewTransportGhs(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] tabular-nums"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Pastoral Responsibility (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newPastoralGhs}
                    onChange={(e) => setNewPastoralGhs(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--surface-border)]">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">SSNIT Number</label>
                  <input
                    type="text"
                    placeholder="e.g. C049283019"
                    value={newSsnit}
                    onChange={(e) => setNewSsnit(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Taxpayer TIN</label>
                  <input
                    type="text"
                    placeholder="e.g. P0052910394"
                    value={newTin}
                    onChange={(e) => setNewTin(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--surface-border)]">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. GCB Bank"
                    value={newBank}
                    onChange={(e) => setNewBank(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Bank Account #</label>
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={newBankAcct}
                    onChange={(e) => setNewBankAcct(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">MoMo Network</label>
                  <select
                    value={newMomoNet}
                    onChange={(e) => setNewMomoNet(e.target.value as any)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="VODAFONE">Telecel (Vodafone) Cash</option>
                    <option value="AIRTELTIGO">AirtelTigo Money</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">MoMo Phone #</label>
                  <input
                    type="text"
                    placeholder="0244..."
                    value={newMomoPhone}
                    onChange={(e) => setNewMomoPhone(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-3.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] font-medium transition hover:opacity-95"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Prepare New Payroll Run */}
      {isNewRunOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Prepare Monthly Payroll Run
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Prepares a draft payroll run with Ghana SSNIT and PAYE deductions for Pastoral / Elder review.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  runMonthlyPayroll({
                    periodMonth: Number(runMonth),
                    periodYear: Number(runYear),
                    payDate: runPayDate,
                    fundId: 'fund-gen',
                    expenseAccountId: 'acct-5010',
                    bankAccountId: 'acct-1030',
                  });
                  setIsNewRunOpen(false);
                  showToast({ message: 'Draft monthly payroll run prepared.' });
                } catch (err) {
                  alert(err instanceof Error ? err.message : String(err));
                }
              }}
              className="space-y-4 text-[13px]"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Period Month</label>
                  <select
                    value={runMonth}
                    onChange={(e) => setRunMonth(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        Month {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Period Year</label>
                  <input
                    type="number"
                    value={runYear}
                    onChange={(e) => setRunYear(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[var(--text-primary)]">Target Pay Date</label>
                <input
                  type="date"
                  value={runPayDate}
                  onChange={(e) => setRunPayDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                />
              </div>

              <div className="p-3 bg-[var(--surface-subtle)] rounded-[var(--radius)] text-[12px] text-[var(--text-secondary)] space-y-1">
                <span className="font-medium text-[var(--text-primary)]">Deduction Rules Applied:</span>
                <p>SSNIT Tier 1 (5.5% employee / 13% employer) + GRA graduated PAYE brackets.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsNewRunOpen(false)}
                  className="px-3.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] font-medium transition hover:opacity-95"
                >
                  Generate Draft Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal: Printable Payslip (Section 3.3, Letterhead) */}
      {previewPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none overflow-y-auto animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-2xl p-8 space-y-6 shadow-2xl my-6">
            {/* Payslip Header with Church Identity from Settings (Rule 1.2) */}
            <div className="flex items-start justify-between border-b border-[var(--surface-border)] pb-4">
              <div>
                <h3 className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
                  {defaultChurchSettings.churchName}
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)]">{defaultChurchSettings.branchName}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">{defaultChurchSettings.address}</p>
                {defaultChurchSettings.taxRegNumber && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {defaultChurchSettings.taxRegNumber}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold text-[var(--accent)] tracking-wider">
                  STAFF PAYSLIP
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  Ref: {previewPayslip.payslipNumber}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] font-medium">
                  {previewPayslip.periodLabel}
                </div>
              </div>
            </div>

            {/* Staff Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-[13px] bg-[var(--surface-subtle)] p-3.5 rounded-[var(--radius)]">
              <div>
                <span className="text-[11px] text-[var(--text-secondary)]">Staff Member:</span>
                <div className="font-semibold text-[var(--text-primary)]">{previewPayslip.fullName}</div>
                <div className="text-[12px] text-[var(--text-secondary)]">{previewPayslip.roleTitle}</div>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)]">Department & Staff #:</span>
                <div className="font-medium text-[var(--text-primary)]">
                  {previewPayslip.department} ({previewPayslip.staffNumber})
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]">
                  SSNIT: {previewPayslip.ssnitNumber || '—'}
                </div>
              </div>
            </div>

            {/* Earnings & Deductions Tables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[13px]">
              {/* Earnings */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Gross Earnings
                </h4>
                <div className="divide-y divide-[var(--surface-border)] border border-[var(--surface-border)] rounded-[var(--radius)] p-3 space-y-2">
                  <div className="flex justify-between pt-1">
                    <span className="text-[var(--text-secondary)]">Basic Salary:</span>
                    <span className="tabular-nums font-medium text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.basicSalaryPesewas)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 text-[12px]">
                    <span className="text-[var(--text-secondary)]">Housing:</span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.housingAllowancePesewas)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 text-[12px]">
                    <span className="text-[var(--text-secondary)]">Transport:</span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.transportAllowancePesewas)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 text-[12px]">
                    <span className="text-[var(--text-secondary)]">Pastoral Resp.:</span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.pastoralResponsibilityPesewas)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--surface-border)] font-semibold">
                    <span className="text-[var(--text-primary)]">Total Earnings:</span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.grossSalaryPesewas)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Statutory Deductions
                </h4>
                <div className="divide-y divide-[var(--surface-border)] border border-[var(--surface-border)] rounded-[var(--radius)] p-3 space-y-2">
                  <div className="flex justify-between pt-1">
                    <span className="text-[var(--text-secondary)]">SSNIT Tier 1 (5.5%):</span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.ssnitEmployeePesewas)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-[var(--text-secondary)]">GRA PAYE Tax:</span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.payeTaxPesewas)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--surface-border)] font-semibold">
                    <span className="text-[var(--text-primary)]">Total Deductions:</span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(previewPayslip.totalDeductionsPesewas)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Pay Box */}
            <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between">
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]">Net Salary Disbursed:</span>
                <div className="text-[18px] font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                  GHS {formatMoneyAmount(previewPayslip.netSalaryPesewas)}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] italic mt-1">
                  {previewPayslip.netSalaryInWords}
                </div>
              </div>
              <div className="text-right text-[12px] text-[var(--text-secondary)]">
                <div>Payment Method: {previewPayslip.bankOrMomoDetails}</div>
                <div>Disbursement Date: {formatDate(previewPayslip.payDate)}</div>
              </div>
            </div>

            {/* Signatures line (Section 3.2) */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-[var(--surface-border)] text-[12px]">
              <div>
                <span className="text-[var(--text-secondary)]">Prepared By:</span>
                <div className="font-medium text-[var(--text-primary)] mt-1">
                  Akosua Osei (Finance Secretary)
                </div>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Authorized By:</span>
                <div className="font-medium text-[var(--text-primary)] mt-1">
                  Rev. Emmanuel Addo (Senior Pastor / Elder)
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => setPreviewPayslip(null)}
                className="px-4 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium text-[13px]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] font-medium text-[13px] transition hover:opacity-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Payslip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
