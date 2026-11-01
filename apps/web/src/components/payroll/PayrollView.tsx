/**
 * PayrollView Component.
 * Church staff registry, monthly payroll execution with Ghana statutory SSNIT and PAYE deductions,
 * automated balanced ledger postings, and individual printable payslips.
 */

import React, { useState } from 'react';
import {
  Users,
  CreditCard,
  Printer,
  Plus,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext.js';
import type { EmploymentType } from '@church/domain';
import { useAuth } from '../../context/AuthContext.js';

export const PayrollView: React.FC = () => {
  const { staffList, payrollRuns, activeRun, addStaffMember, runMonthlyPayroll, getPayslipsForRun } = usePayroll();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'RUNS' | 'STAFF' | 'PAYSLIPS'>('RUNS');
  const [isNewRunOpen, setIsNewRunOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

  // New Payroll Run Form State
  const [runMonth, setRunMonth] = useState(10);
  const [runYear, setRunYear] = useState(2026);
  const [runPayDate, setRunPayDate] = useState('2026-10-28');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Add Staff Form State
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDept, setNewDept] = useState('Pastoral');
  const [newType, setNewType] = useState<EmploymentType>('FULL_TIME_STAFF');
  const [newBasicGhs, setNewBasicGhs] = useState('');
  const [newHousingGhs, setNewHousingGhs] = useState('');
  const [newTransportGhs, setNewTransportGhs] = useState('');
  const [newPastoralGhs, setNewPastoralGhs] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newBankAcct, setNewBankAcct] = useState('');
  const [newMomoNet, setNewMomoNet] = useState<'MTN' | 'VODAFONE' | 'AIRTELTIGO'>('MTN');
  const [newMomoPhone, setNewMomoPhone] = useState('');

  const currentRun = activeRun || payrollRuns[0];
  const payslips = currentRun ? getPayslipsForRun(currentRun.id) : [];

  const handleCreateRun = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = runMonthlyPayroll({
        periodMonth: Number(runMonth),
        periodYear: Number(runYear),
        payDate: runPayDate,
        fundId: 'fund-gen',
        expenseAccountId: 'acct-5010',
        bankAccountId: 'acct-1030',
      });

      setIsNewRunOpen(false);
      setSuccessBanner(
        `Payroll ${res.payrollRun.payrollNumber} executed! Total Net Disbursed: GHS ${(Number(res.payrollRun.totalNetPayPesewas) / 100).toFixed(2)}. Balanced ledger entry posted.`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newRole.trim()) {
      alert('Please enter staff name and role title.');
      return;
    }

    const toPesewas = (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) || num <= 0 ? 0n : BigInt(Math.round(num * 100));
    };

    addStaffMember({
      branchId: currentUser.branchId,
      fullName: newFullName.trim(),
      roleTitle: newRole.trim(),
      department: newDept,
      employmentType: newType,
      basicSalaryPesewas: toPesewas(newBasicGhs),
      housingAllowancePesewas: toPesewas(newHousingGhs),
      transportAllowancePesewas: toPesewas(newTransportGhs),
      pastoralResponsibilityPesewas: toPesewas(newPastoralGhs),
      bankName: newBank.trim() || undefined,
      bankAccountNumber: newBankAcct.trim() || undefined,
      momoNetwork: newMomoNet,
      momoNumber: newMomoPhone.trim() || undefined,
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
    setSuccessBanner('New church staff member registered successfully.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Church Staff Payroll & Allowances Management
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ghana SSNIT Tier 1 (5.5% employee / 13% employer), graduated PAYE tax withholding, payslips, and balanced ledger postings.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsNewRunOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>Run Monthly Payroll</span>
            </button>
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff</span>
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-500 hover:text-emerald-700">
              ×
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('RUNS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'RUNS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Monthly Payroll Runs ({payrollRuns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('STAFF')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'STAFF'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Registry ({staffList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('PAYSLIPS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'PAYSLIPS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Staff Payslips ({payslips.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Monthly Payroll Runs */}
      {activeTab === 'RUNS' && currentRun && (
        <div className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Basic</span>
              <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                GHS {(Number(currentRun.totalBasicPesewas) / 100).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Allowances</span>
              <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                GHS {(Number(currentRun.totalAllowancesPesewas) / 100).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Gross Salaries</span>
              <div className="text-base font-black text-blue-600 mt-1">
                GHS {(Number(currentRun.totalGrossPesewas) / 100).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">SSNIT (Emp 5.5%)</span>
              <div className="text-base font-black text-amber-600 mt-1">
                GHS {(Number(currentRun.totalEmployeeSsnitPesewas) / 100).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">PAYE Tax</span>
              <div className="text-base font-black text-rose-600 mt-1">
                GHS {(Number(currentRun.totalPayePesewas) / 100).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Net Disbursed</span>
              <div className="text-base font-black text-emerald-600 mt-1">
                GHS {(Number(currentRun.totalNetPayPesewas) / 100).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Payroll Items Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Payroll Itemization — {currentRun.payrollNumber}
                </h3>
                <p className="text-xs text-slate-400">Pay Date: {currentRun.payDate} • Status: {currentRun.status}</p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                GL Post: Balanced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-400 font-semibold">
                    <th className="py-2 text-left">Staff #</th>
                    <th className="py-2 text-left">Name & Designation</th>
                    <th className="py-2 text-right">Basic (GHS)</th>
                    <th className="py-2 text-right">Allowances</th>
                    <th className="py-2 text-right">Gross (GHS)</th>
                    <th className="py-2 text-right">SSNIT (5.5%)</th>
                    <th className="py-2 text-right">PAYE</th>
                    <th className="py-2 text-right">Net Pay (GHS)</th>
                    <th className="py-2 text-center">Channel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentRun.items.map((item) => (
                    <tr key={item.staffId} className="hover:bg-slate-50/50">
                      <td className="py-2 font-mono text-slate-400">{item.staffNumber}</td>
                      <td className="py-2">
                        <div className="font-bold text-slate-900 dark:text-white">{item.fullName}</div>
                        <div className="text-[10px] text-slate-400">{item.roleTitle}</div>
                      </td>
                      <td className="py-2 font-mono text-right">{(Number(item.basicSalaryPesewas) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right text-slate-500">{(Number(item.totalAllowancesPesewas) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right font-bold text-blue-600">{(Number(item.grossSalaryPesewas) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right text-amber-600">{(Number(item.ssnitTier1EmployeePesewas) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right text-rose-600">{(Number(item.payeTaxPesewas) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right font-black text-emerald-600">{(Number(item.netSalaryPesewas) / 100).toFixed(2)}</td>
                      <td className="py-2 text-center">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {item.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Staff Registry */}
      {activeTab === 'STAFF' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Active Church Staff & Pastoral Registry</h3>
            <span className="text-xs text-slate-400">{staffList.length} staff registered</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffList.map((s) => (
              <div key={s.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border space-y-3 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] text-blue-600 font-bold">{s.staffNumber}</span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{s.fullName}</h4>
                    <p className="text-slate-500">{s.roleTitle} • {s.department}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.employmentType === 'PASTORAL_CLERGY' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {s.employmentType.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
                  <div>
                    <span className="text-slate-400">Basic Salary:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      GHS {(Number(s.basicSalaryPesewas) / 100).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Allowances:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      GHS {((Number(s.housingAllowancePesewas + s.transportAllowancePesewas + s.pastoralResponsibilityPesewas)) / 100).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 pt-1 border-t flex justify-between">
                  <span>Pay routing: {s.bankAccountNumber ? `${s.bankName} (A/C ${s.bankAccountNumber})` : s.momoNumber ? `${s.momoNetwork} MoMo ${s.momoNumber}` : 'Cash'}</span>
                  <span>SSNIT: {s.ssnitNumber || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Staff Payslips */}
      {activeTab === 'PAYSLIPS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {payslips.map((slip) => (
              <div
                key={slip.payslipNumber}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-blue-600">{slip.payslipNumber}</span>
                  <span className="text-[10px] text-slate-400">{slip.periodLabel}</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{slip.fullName}</h4>
                  <p className="text-[11px] text-slate-400">{slip.roleTitle}</p>
                </div>
                <div className="pt-2 border-t space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Gross Salary:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      GHS {(Number(slip.grossSalaryPesewas) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Total Deductions:</span>
                    <span className="font-mono font-bold">
                      -GHS {(Number(slip.totalDeductionsPesewas) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-black text-emerald-600 pt-1 border-t">
                    <span>Net Pay:</span>
                    <span className="font-mono text-sm">{slip.netSalaryFigures}</span>
                  </div>
                </div>
                <div className="text-[10px] italic text-slate-400 truncate">
                  {slip.netSalaryInWords}
                </div>
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Payslip</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Run Monthly Payroll */}
      {isNewRunOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Execute Monthly Church Staff Payroll
            </h3>

            <form onSubmit={handleCreateRun} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Period Month</label>
                  <select
                    value={runMonth}
                    onChange={(e) => setRunMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        Month {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Period Year</label>
                  <input
                    type="number"
                    value={runYear}
                    onChange={(e) => setRunYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Pay Date</label>
                <input
                  type="date"
                  value={runPayDate}
                  onChange={(e) => setRunPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 space-y-1">
                <div className="font-semibold text-blue-900 dark:text-blue-200">Statutory Deductions Computed:</div>
                <ul className="list-disc pl-4 text-slate-600 dark:text-slate-400 space-y-0.5">
                  <li>SSNIT Tier 1 Employee (5.5%) & Employer (13.0%)</li>
                  <li>Ghana GRA graduated monthly PAYE income tax</li>
                  <li>Automatic double-entry posting to General Fund</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewRunOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Authorize & Disburse Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Staff Member */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Register Church Staff Member</h3>

            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pastor David Quaye"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Role / Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Associate Pastor"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold">Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Pastoral">Pastoral</option>
                    <option value="Administration">Administration</option>
                    <option value="Music">Music & Media</option>
                    <option value="Youth">Youth Ministry</option>
                    <option value="Facilities">Facilities & Security</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Employment Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as EmploymentType)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="PASTORAL_CLERGY">Pastoral Clergy</option>
                    <option value="FULL_TIME_STAFF">Full Time Staff</option>
                    <option value="PART_TIME_STAFF">Part Time Staff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold">Basic Salary (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newBasicGhs}
                    onChange={(e) => setNewBasicGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Housing Allowance (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newHousingGhs}
                    onChange={(e) => setNewHousingGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold">Transport Allowance (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newTransportGhs}
                    onChange={(e) => setNewTransportGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Pastoral Responsibility (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newPastoralGhs}
                    onChange={(e) => setNewPastoralGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t">
                <div className="space-y-1">
                  <label className="font-semibold">Bank Name (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. GCB Bank"
                    value={newBank}
                    onChange={(e) => setNewBank(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Bank Account #</label>
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={newBankAcct}
                    onChange={(e) => setNewBankAcct(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold">MoMo Network</label>
                  <select
                    value={newMomoNet}
                    onChange={(e) => setNewMomoNet(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="VODAFONE">Telecel (Vodafone) Cash</option>
                    <option value="AIRTELTIGO">AirtelTigo Money</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">MoMo Phone #</label>
                  <input
                    type="text"
                    placeholder="0244..."
                    value={newMomoPhone}
                    onChange={(e) => setNewMomoPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
