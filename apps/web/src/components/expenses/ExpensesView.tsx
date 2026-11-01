import React, { useState } from 'react';
import { useExpenses } from '../../context/ExpensesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import {
  calculateWithholdingTax,
  type WithholdingTaxRate,
  type VoucherPaymentMethod,
  type AssetCategory,
  type Requisition,
  type PaymentVoucher,
} from '@church/domain';
import {
  Receipt,
  FileText,
  CreditCard,
  Coins,
  Store,
  Package,
  Plus,
  CheckCircle,
  Check,
  X,
  Printer,
} from 'lucide-react';
import { PrintableVoucherModal } from './PrintableVoucherModal.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { EmptyState } from '../ui/EmptyState.js';

export const ExpensesView: React.FC = () => {
  const { currentUser } = useAuth();
  const { funds, accounts } = useLedger();
  const {
    requisitions,
    vouchers,
    vendors,
    pettyCashFloat,
    pettyCashTransactions,
    assets,
    submitRequisition,
    approveRequisition,
    rejectRequisition,
    createPaymentVoucher,
    disbursePettyCash,
    replenishPettyCash,
    addVendor,
    addAsset,
    getAssetSummary,
  } = useExpenses();

  const [activeTab, setActiveTab] = useState<
    'REQUISITIONS' | 'VOUCHERS' | 'PETTY_CASH' | 'VENDORS' | 'ASSETS'
  >('REQUISITIONS');

  // Print Voucher Modal State
  const [selectedPrintVoucher, setSelectedPrintVoucher] = useState<PaymentVoucher | null>(null);

  // Requisitions Form State
  const [isNewReqOpen, setIsNewReqOpen] = useState(false);
  const [reqDept, setReqDept] = useState('Music & Choir');
  const [reqFundId, setReqFundId] = useState('fund-gen');
  const [reqPurpose, setReqPurpose] = useState('');
  const [reqAmountGhs, setReqAmountGhs] = useState('');
  const [reqQuotes, setReqQuotes] = useState('');

  // Payment Voucher Form State
  const [isNewVoucherOpen, setIsNewVoucherOpen] = useState(false);
  const [vPayee, setVPayee] = useState('');
  const [vVendorId, setVVendorId] = useState('');
  const [vReqId, setVReqId] = useState('');
  const [vFundId, setVFundId] = useState('fund-gen');
  const [vExpenseAccountId, setVExpenseAccountId] = useState('acct-5030');
  const [vPurpose, setVPurpose] = useState('');
  const [vPaymentMethod, setVPaymentMethod] = useState<VoucherPaymentMethod>('BANK_GHS');
  const [vGrossGhs, setVGrossGhs] = useState('');
  const [vWhtRate, setVWhtRate] = useState<WithholdingTaxRate>(0);
  const [vChequeNum, setVChequeNum] = useState('');
  const [vMomoNet, setVMomoNet] = useState('MTN');
  const [vMomoRef, setVMomoRef] = useState('');
  const [vMomoPhone, setVMomoPhone] = useState('');

  // Petty Cash Form State
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [pcDesc, setPcDesc] = useState('');
  const [pcCategory, setPcCategory] = useState('Utilities');
  const [pcExpenseAccId, setPcExpenseAccId] = useState('acct-5020');
  const [pcAmtGhs, setPcAmtGhs] = useState('');
  const [pcPaidTo, setPcPaidTo] = useState('');
  const [pcReceiptNum, setPcReceiptNum] = useState('');

  // Vendor Form State
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [venName, setVenName] = useState('');
  const [venCat, setVenCat] = useState('Maintenance');
  const [venPhone, setVenPhone] = useState('');
  const [venTin, setVenTin] = useState('');
  const [venMomo, setVenMomo] = useState('');

  // Asset Form State
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [astTag, setAstTag] = useState('');
  const [astName, setAstName] = useState('');
  const [astCat, setAstCat] = useState<AssetCategory>('Musical Instruments');
  const [astLocation, setAstLocation] = useState('Auditorium Main Stage');
  const [astCostGhs, setAstCostGhs] = useState('');
  const [astFundId, setAstFundId] = useState('fund-bld');
  const [astYears, setAstYears] = useState('5');
  const [astSerial, setAstSerial] = useState('');

  // Success / error banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Asset register summary
  const assetSummary = getAssetSummary();

  // Escape key handlers for all modal dialogs (Phase 6 Accessibility)
  useModalEscape(isNewReqOpen, () => setIsNewReqOpen(false));
  useModalEscape(isNewVoucherOpen, () => setIsNewVoucherOpen(false));
  useModalEscape(isDisburseOpen, () => setIsDisburseOpen(false));
  useModalEscape(isAddVendorOpen, () => setIsAddVendorOpen(false));
  useModalEscape(isAddAssetOpen, () => setIsAddAssetOpen(false));

  // Helper: Open Voucher modal prepopulated from Requisition
  const handlePrepareVoucherFromReq = (req: Requisition) => {
    setVReqId(req.id);
    setVPayee(req.submittedByName);
    setVFundId(req.fundId);
    setVPurpose(req.purpose);
    setVGrossGhs((Number(req.estimatedAmountPesewas) / 100).toFixed(2));
    setActiveTab('VOUCHERS');
    setIsNewVoucherOpen(true);
  };

  // Submit Requisition Handler
  const handleSaveRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(reqAmountGhs);
    if (!reqPurpose.trim() || isNaN(amt) || amt <= 0) {
      alert('Please enter valid purpose and estimated amount.');
      return;
    }
    const fund = funds.find((f) => f.id === reqFundId);
    submitRequisition({
      branchId: currentUser.branchId,
      departmentId: `dept-${reqDept.toLowerCase().slice(0, 4)}`,
      departmentName: reqDept,
      fundId: reqFundId,
      fundName: fund?.name || 'General Fund',
      purpose: reqPurpose.trim(),
      currency: 'GHS',
      estimatedAmountPesewas: BigInt(Math.round(amt * 100)),
      quotesNotes: reqQuotes.trim() || undefined,
    });
    setIsNewReqOpen(false);
    setReqPurpose('');
    setReqAmountGhs('');
    setReqQuotes('');
    setSuccessBanner('Requisition submitted for Pastoral / Elder approval.');
  };

  // Live WHT Calculation in Voucher Form
  const grossPesewas = BigInt(Math.round((parseFloat(vGrossGhs) || 0) * 100));
  const { whtPesewas, netPesewas } = calculateWithholdingTax(grossPesewas, vWhtRate);

  // Submit Payment Voucher Handler
  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vPayee.trim() || grossPesewas <= 0n) {
      alert('Please enter valid payee and gross amount.');
      return;
    }

    const expAcc = accounts.find((a) => a.id === vExpenseAccountId);

    try {
      const { voucher } = createPaymentVoucher({
        requisitionId: vReqId || undefined,
        vendorId: vVendorId || undefined,
        payeeName: vPayee.trim(),
        fundId: vFundId,
        expenseAccountId: vExpenseAccountId,
        expenseAccountName: expAcc?.name || 'Expenses',
        purpose: vPurpose.trim() || 'Church operating expenditure',
        paymentMethod: vPaymentMethod,
        currency: 'GHS',
        grossAmountPesewas: grossPesewas,
        withholdingTaxRate: vWhtRate,
        chequeNumber: vChequeNum.trim() || undefined,
        momoNetwork: vMomoNet,
        momoReference: vMomoRef.trim() || undefined,
        momoRecipientPhone: vMomoPhone.trim() || undefined,
      });

      setIsNewVoucherOpen(false);
      setVPayee('');
      setVPurpose('');
      setVGrossGhs('');
      setVChequeNum('');
      setVMomoRef('');
      setSelectedPrintVoucher(voucher);
      setSuccessBanner(
        `Payment Voucher ${voucher.voucherNumber} created. Net payable: GHS ${(Number(netPesewas) / 100).toFixed(2)}${whtPesewas > 0n ? ` (WHT GHS ${(Number(whtPesewas) / 100).toFixed(2)} posted to Tax Payable)` : ''}. Journal entry linked!`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Disburse Petty Cash Handler
  const handleDisbursePettyCash = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(pcAmtGhs);
    if (!pcDesc.trim() || isNaN(amt) || amt <= 0) {
      alert('Please enter valid description and amount.');
      return;
    }

    disbursePettyCash({
      description: pcDesc.trim(),
      category: pcCategory,
      expenseAccountId: pcExpenseAccId,
      amountPesewas: BigInt(Math.round(amt * 100)),
      paidTo: pcPaidTo.trim() || 'Vendor',
      receiptNumber: pcReceiptNum.trim() || undefined,
    });

    setIsDisburseOpen(false);
    setPcDesc('');
    setPcAmtGhs('');
    setPcPaidTo('');
    setPcReceiptNum('');
    setSuccessBanner('Petty cash disbursed and logged. Float updated in real time.');
  };

  // Replenish Petty Cash Handler
  const handleReplenishPettyCash = () => {
    try {
      const res = replenishPettyCash('acct-1030'); // Bank Account GHS
      setSuccessBanner(
        `Petty cash float replenished to GHS ${(Number(pettyCashFloat.targetFloatPesewas) / 100).toFixed(2)}. Total reimbursed: GHS ${(Number(res.totalGhs) / 100).toFixed(2)}. Ledger updated!`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Add Vendor Handler
  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!venName.trim()) {
      alert('Please enter vendor name.');
      return;
    }
    addVendor({
      branchId: currentUser.branchId,
      name: venName.trim(),
      category: venCat,
      contactPhone: venPhone.trim() || undefined,
      tinOrGhanaCard: venTin.trim() || undefined,
      momoNumber: venMomo.trim() || undefined,
    });
    setIsAddVendorOpen(false);
    setVenName('');
    setVenPhone('');
    setVenTin('');
    setVenMomo('');
    setSuccessBanner('Vendor added to directory.');
  };

  // Add Asset Handler
  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(astCostGhs);
    const yrs = parseInt(astYears) || 5;
    if (!astName.trim() || isNaN(cost) || cost <= 0) {
      alert('Please enter valid asset name and purchase cost.');
      return;
    }
    const tag = astTag.trim() || `AST-${Date.now().toString().slice(-4)}`;
    const fund = funds.find((f) => f.id === astFundId);

    addAsset({
      branchId: currentUser.branchId,
      assetTag: tag,
      name: astName.trim(),
      category: astCat,
      location: astLocation.trim(),
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchaseCostPesewas: BigInt(Math.round(cost * 100)),
      currency: 'GHS',
      fundId: astFundId,
      fundName: fund?.name || 'Building Fund',
      usefulLifeYears: yrs,
      residualValuePesewas: 0n,
      condition: 'EXCELLENT',
      serialNumber: astSerial.trim() || undefined,
    });

    setIsAddAssetOpen(false);
    setAstTag('');
    setAstName('');
    setAstCostGhs('');
    setAstSerial('');
    setSuccessBanner('Asset registered into fixed asset schedule.');
  };

  const isPastorOrTreasurer =
    currentUser.role === 'Pastor / Elder' ||
    currentUser.role === 'Treasurer' ||
    currentUser.role === 'Admin';

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Expenditure & Procurement Workflow
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Department requisitions, Pastoral approvals, Payment Vouchers (with WHT), Petty Cash Imprest, and Asset Register.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('REQUISITIONS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'REQUISITIONS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Requisitions & Approvals ({requisitions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('VOUCHERS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'VOUCHERS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment Vouchers & WHT ({vouchers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PETTY_CASH')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'PETTY_CASH'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Petty Cash Imprest</span>
          </button>

          <button
            onClick={() => setActiveTab('VENDORS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'VENDORS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Vendor Directory ({vendors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ASSETS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'ASSETS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Fixed Asset Register ({assets.length})</span>
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: REQUISITIONS & APPROVALS */}
      {activeTab === 'REQUISITIONS' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Expenditure Requisitions
              </h3>
              <p className="text-xs text-slate-500">
                Department Heads submit requests → Pastor / Elder approves → Finance issues voucher.
              </p>
            </div>
            <button
              onClick={() => setIsNewReqOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Requisition</span>
            </button>
          </div>

          {requisitions.length === 0 ? (
            <EmptyState
              message="No expenditure requisitions submitted yet."
              actionLabel="Submit Requisition"
              onAction={() => setIsNewReqOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Req No.</th>
                    <th className="p-2.5">Department</th>
                    <th className="p-2.5">Purpose</th>
                    <th className="p-2.5">Fund</th>
                    <th className="p-2.5 text-right">Est. Amount</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {requisitions.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {req.reqNumber}
                      </td>
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                        {req.departmentName}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {req.purpose}
                        {req.quotesNotes && (
                          <div className="text-[10px] text-slate-400 italic">{req.quotesNotes}</div>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-500">{req.fundName}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        GHS {(Number(req.estimatedAmountPesewas) / 100).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : req.status === 'PENDING'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse'
                              : req.status === 'PAID'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {req.status === 'PENDING' && isPastorOrTreasurer && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => approveRequisition(req.id)}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                              title="Approve Requisition"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => rejectRequisition(req.id, 'Budget ceiling reached')}
                              className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white"
                              title="Reject Requisition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {req.status === 'APPROVED' && (
                          <button
                            onClick={() => handlePrepareVoucherFromReq(req)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold"
                          >
                            Issue Voucher
                          </button>
                        )}

                        {req.status === 'PAID' && (
                          <span className="text-[11px] text-slate-400 font-mono">Voucher Issued</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT VOUCHERS (WITH WHT) */}
      {activeTab === 'VOUCHERS' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Payment Vouchers & Withholding Tax (WHT)
              </h3>
              <p className="text-xs text-slate-500">
                Official payment vouchers with automatic Ghana WHT liability deduction and ledger posting.
              </p>
            </div>
            <button
              onClick={() => setIsNewVoucherOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Payment Voucher</span>
            </button>
          </div>

          {vouchers.length === 0 ? (
            <EmptyState
              message="No payment vouchers prepared yet."
              actionLabel="New Payment Voucher"
              onAction={() => setIsNewVoucherOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Voucher No.</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Payee & Purpose</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5 text-right">Gross Amount</th>
                    <th className="p-2.5 text-right">WHT Deducted</th>
                    <th className="p-2.5 text-right">Net Disbursed</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {v.voucherNumber}
                      </td>
                      <td className="p-2.5 text-slate-500">{v.voucherDate}</td>
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{v.payeeName}</div>
                        <div className="text-[11px] text-slate-500">{v.purpose}</div>
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-300">
                        <span className="font-semibold">{v.paymentMethod}</span>
                        {v.chequeNumber && <span className="block text-[10px] text-slate-400 font-mono">#{v.chequeNumber}</span>}
                        {v.momoReference && <span className="block text-[10px] text-slate-400 font-mono">Ref: {v.momoReference}</span>}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        GHS {(Number(v.grossAmountPesewas) / 100).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                        {v.withholdingTaxPesewas > 0n ? (
                          <>
                            GHS {(Number(v.withholdingTaxPesewas) / 100).toFixed(2)}
                            <span className="text-[10px] text-slate-400 block">({v.withholdingTaxRate}%)</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        GHS {(Number(v.netPayablePesewas) / 100).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPrintVoucher(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--surface-border)] transition"
                          title="View and print official payment voucher"
                        >
                          <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PETTY CASH IMPREST */}
      {activeTab === 'PETTY_CASH' && (
        <div className="space-y-6">
          {/* Imprest Status Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Fixed Imprest Float</span>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                GHS {(Number(pettyCashFloat.targetFloatPesewas) / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400">Custodian: {pettyCashFloat.custodianName}</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase">Cash In Box (Available)</span>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                GHS {(Number(pettyCashFloat.cashOnHandPesewas) / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400">Physical Float Box</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-semibold text-amber-600 uppercase">Unreimbursed Receipts</span>
              <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                GHS {(Number(pettyCashFloat.unreimbursedReceiptsPesewas) / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400">Disbursed with Receipts</span>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-blue-200 uppercase">Replenishment Needed</span>
                <div className="text-lg font-black font-mono text-white mt-1">
                  GHS {(Number(pettyCashFloat.unreimbursedReceiptsPesewas) / 100).toFixed(2)}
                </div>
              </div>
              <button
                onClick={handleReplenishPettyCash}
                disabled={pettyCashFloat.unreimbursedReceiptsPesewas === 0n}
                className="mt-2 w-full py-1.5 px-3 bg-white hover:bg-blue-50 disabled:bg-slate-700 text-blue-900 disabled:text-slate-400 rounded-lg text-xs font-bold transition shadow-sm"
              >
                Replenish Float
              </button>
            </div>
          </div>

          {/* Petty Cash Transactions Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Petty Cash Disbursement Log ({pettyCashTransactions.length})
              </h3>
              <button
                onClick={() => setIsDisburseOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Disburse Minor Expense</span>
              </button>
            </div>

            {pettyCashTransactions.length === 0 ? (
              <EmptyState
                message="No petty cash disbursements recorded for this float."
                actionLabel="Disburse Minor Expense"
                onAction={() => setIsDisburseOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Paid To</th>
                      <th className="p-2.5 text-right">Amount (GHS)</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {pettyCashTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 text-slate-500">{tx.date}</td>
                        <td className="p-2.5 font-medium text-slate-900 dark:text-white">
                          {tx.description}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">{tx.category}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">{tx.paidTo}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          GHS {(Number(tx.amountPesewas) / 100).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              tx.isReplenished
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {tx.isReplenished ? 'Replenished' : 'Pending Replenishment'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VENDOR DIRECTORY */}
      {activeTab === 'VENDORS' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Church Vendor & Contractor Directory
              </h3>
              <p className="text-xs text-slate-500">
                Registered suppliers with Ghana TIN / Card numbers and cumulative payment history.
              </p>
            </div>
            <button
              onClick={() => setIsAddVendorOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register Vendor</span>
            </button>
          </div>

          {vendors.length === 0 ? (
            <EmptyState
              message="No church vendors or contractors registered yet."
              actionLabel="Register Vendor"
              onAction={() => setIsAddVendorOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {vendors.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{v.name}</div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                      {v.category}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-600 dark:text-slate-400">
                    {v.contactPhone && <div>Phone: {v.contactPhone}</div>}
                    {v.tinOrGhanaCard && <div>TIN / Ghana Card: <span className="font-mono text-slate-800 dark:text-slate-200">{v.tinOrGhanaCard}</span></div>}
                    {v.momoNumber && <div>MoMo: {v.momoNumber}</div>}
                    {v.bankDetails && <div>Bank: {v.bankDetails}</div>}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex justify-between items-baseline">
                    <span className="text-[11px] text-slate-500">Total Disbursed:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      GHS {(Number(v.totalPaidGhsPesewas) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FIXED ASSET REGISTER */}
      {activeTab === 'ASSETS' && (
        <div className="space-y-6">
          {/* Asset Portfolio Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Fixed Assets</span>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {assetSummary.totalAssetsCount} Items
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Historical Cost (GHS)</span>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                GHS {(Number(assetSummary.totalCostPesewas) / 100).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-semibold text-rose-600 uppercase">Accumulated Depreciation</span>
              <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                GHS {(Number(assetSummary.totalAccumulatedDepreciationPesewas) / 100).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase">Net Book Value (NBV)</span>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                GHS {(Number(assetSummary.totalNetBookValuePesewas) / 100).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Asset Register Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Church Asset Register & Straight-Line Depreciation
                </h3>
                <p className="text-xs text-slate-500">
                  Fixed asset inventory with tag numbers, useful life, monthly depreciation, and carrying value.
                </p>
              </div>
              <button
                onClick={() => setIsAddAssetOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Register Fixed Asset</span>
              </button>
            </div>

            {assets.length === 0 ? (
              <EmptyState
                message="No fixed assets logged in the church asset register yet."
                actionLabel="Register Fixed Asset"
                onAction={() => setIsAddAssetOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">Asset Tag</th>
                      <th className="p-2.5">Asset Name & Category</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Purchased</th>
                      <th className="p-2.5 text-right">Cost (GHS)</th>
                      <th className="p-2.5 text-right">Annual Dep.</th>
                      <th className="p-2.5 text-right">Acc. Dep.</th>
                      <th className="p-2.5 text-right">Net Book Value</th>
                      <th className="p-2.5 text-center">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {assets.map((ast) => {
                      const dep = assetSummary.results.find((r) => r.assetId === ast.id);
                      return (
                        <tr key={ast.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {ast.assetTag}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900 dark:text-white">{ast.name}</div>
                            <div className="text-[11px] text-slate-500">{ast.category}</div>
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{ast.location}</td>
                          <td className="p-2.5 text-slate-500">{ast.purchaseDate}</td>
                          <td className="p-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            GHS {(Number(ast.purchaseCostPesewas) / 100).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-500">
                            GHS {(Number(dep?.annualDepreciationPesewas || 0n) / 100).toFixed(2)}/yr
                          </td>
                          <td className="p-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                            GHS {(Number(dep?.accumulatedDepreciationPesewas || 0n) / 100).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            GHS {(Number(dep?.netBookValuePesewas || 0n) / 100).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold">
                              {ast.condition}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT REQUISITION */}
      {isNewReqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Submit Department Requisition</span>
              </h3>
              <button onClick={() => setIsNewReqOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequisition} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Department</label>
                <select
                  value={reqDept}
                  onChange={(e) => setReqDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="Music & Choir">Music & Choir</option>
                  <option value="Administration">Administration & Secretariat</option>
                  <option value="Youth Ministry">Youth Ministry</option>
                  <option value="Welfare">Welfare & Benevolence</option>
                  <option value="Outreach & Missions">Outreach & Missions</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Fund</label>
                <select
                  value={reqFundId}
                  onChange={(e) => setReqFundId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                >
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Purpose / Justification</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Detail the expenditure need and purpose..."
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Estimated Amount (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={reqAmountGhs}
                  onChange={(e) => setReqAmountGhs(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Supplier Quotes / Attachment Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Attached proforma invoice from vendor"
                  value={reqQuotes}
                  onChange={(e) => setReqQuotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewReqOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW PAYMENT VOUCHER */}
      {isNewVoucherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4 my-8">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Issue Payment Voucher (with Ghana WHT)</span>
              </h3>
              <button onClick={() => setIsNewVoucherOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Payee Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Akwasi Sound Ltd"
                    value={vPayee}
                    onChange={(e) => setVPayee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Or Select Registered Vendor</label>
                  <select
                    value={vVendorId}
                    onChange={(e) => {
                      setVVendorId(e.target.value);
                      const sel = vendors.find((v) => v.id === e.target.value);
                      if (sel) setVPayee(sel.name);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="">-- Manual Payee --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Expenditure Purpose</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Auditorium acoustic mixer servicing"
                  value={vPurpose}
                  onChange={(e) => setVPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Expense Account</label>
                  <select
                    value={vExpenseAccountId}
                    onChange={(e) => setVExpenseAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="acct-5010">5010 - Salaries and Allowances</option>
                    <option value="acct-5020">5020 - Utilities</option>
                    <option value="acct-5030">5030 - Maintenance & Repairs</option>
                    <option value="acct-5040">5040 - Outreach and Missions</option>
                    <option value="acct-5050">5050 - Welfare Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Fund</label>
                  <select
                    value={vFundId}
                    onChange={(e) => setVFundId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Gross Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={vGrossGhs}
                    onChange={(e) => setVGrossGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Withholding Tax (WHT)</label>
                  <select
                    value={vWhtRate}
                    onChange={(e) => setVWhtRate(parseFloat(e.target.value) as WithholdingTaxRate)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="0">0% - Exempt / Standard</option>
                    <option value="3">3% - Supply of Goods</option>
                    <option value="5">5% - Supply of Services</option>
                    <option value="7.5">7.5% - Rent on Premises</option>
                    <option value="10">10% - Contract Works / Consultancy</option>
                  </select>
                </div>
              </div>

              {/* Live WHT Breakdown Box */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Gross Invoice Total:</span>
                  <span>GHS {(Number(grossPesewas) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>WHT Deducted ({vWhtRate}%):</span>
                  <span>- GHS {(Number(whtPesewas) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-slate-800 text-xs">
                  <span>Net Amount Disbursed to Payee:</span>
                  <span>GHS {(Number(netPesewas) / 100).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Payment Method</label>
                <select
                  value={vPaymentMethod}
                  onChange={(e) => setVPaymentMethod(e.target.value as VoucherPaymentMethod)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="BANK_GHS">Bank Transfer (GHS 1030)</option>
                  <option value="CHEQUE">Bank Cheque (GHS 1030)</option>
                  <option value="MOMO">Mobile Money (MoMo 1050)</option>
                  <option value="CASH_GHS">Cash on Hand (GHS 1010)</option>
                </select>
              </div>

              {vPaymentMethod === 'CHEQUE' && (
                <div>
                  <label className="block text-slate-300 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CHQ-009941"
                    value={vChequeNum}
                    onChange={(e) => setVChequeNum(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-white"
                  />
                </div>
              )}

              {vPaymentMethod === 'MOMO' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Network</label>
                    <select
                      value={vMomoNet}
                      onChange={(e) => setVMomoNet(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                    >
                      <option value="MTN">MTN MoMo</option>
                      <option value="VODAFONE">Telecel Cash</option>
                      <option value="AIRTELTIGO">AirtelTigo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Recipient MoMo Phone</label>
                    <input
                      type="text"
                      placeholder="+233 24 000 0000"
                      value={vMomoPhone}
                      onChange={(e) => setVMomoPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Transaction Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. MTN-99201"
                      value={vMomoRef}
                      onChange={(e) => setVMomoRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-white"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewVoucherOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">
                  Authorize & Post Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISBURSE PETTY CASH */}
      {isDisburseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Disburse Minor Petty Cash Expense</span>
              </h3>
              <button onClick={() => setIsDisburseOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisbursePettyCash} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Expense Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generator diesel fuel, tea for elders"
                  value={pcDesc}
                  onChange={(e) => setPcDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Expense Account</label>
                  <select
                    value={pcExpenseAccId}
                    onChange={(e) => {
                      setPcExpenseAccId(e.target.value);
                      if (e.target.value === 'acct-5020') setPcCategory('Utilities');
                      if (e.target.value === 'acct-5030') setPcCategory('Maintenance & Repairs');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="acct-5020">5020 - Utilities</option>
                    <option value="acct-5030">5030 - Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={pcAmtGhs}
                    onChange={(e) => setPcAmtGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Paid To</label>
                  <input
                    type="text"
                    required
                    placeholder="Vendor / Shop Name"
                    value={pcPaidTo}
                    onChange={(e) => setPcPaidTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Receipt No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="Receipt #"
                    value={pcReceiptNum}
                    onChange={(e) => setPcReceiptNum(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold">
                  Disburse Cash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VENDOR */}
      {isAddVendorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-400" />
                <span>Register Vendor</span>
              </h3>
              <button onClick={() => setIsAddVendorOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Company / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ghana Telecom / Telecel"
                  value={venName}
                  onChange={(e) => setVenName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select
                    value={venCat}
                    onChange={(e) => setVenCat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="Utilities">Utilities</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Audio/Visual">Audio / Visual & Music</option>
                    <option value="Fuel & Transport">Fuel & Transport</option>
                    <option value="Office Supplies">Office Supplies</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+233 24 000 0000"
                    value={venPhone}
                    onChange={(e) => setVenPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">TIN / Ghana Card</label>
                  <input
                    type="text"
                    placeholder="C0001234567"
                    value={venTin}
                    onChange={(e) => setVenTin(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">MoMo Number</label>
                  <input
                    type="text"
                    placeholder="+233 24 000 0000"
                    value={venMomo}
                    onChange={(e) => setVenMomo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddVendorOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER ASSET */}
      {isAddAssetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>Register Fixed Asset</span>
              </h3>
              <button onClick={() => setIsAddAssetOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Asset Tag</label>
                  <input
                    type="text"
                    placeholder="AST-004"
                    value={astTag}
                    onChange={(e) => setAstTag(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select
                    value={astCat}
                    onChange={(e) => setAstCat(e.target.value as AssetCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="Musical Instruments">Musical Instruments</option>
                    <option value="Audio / Visual Equipment">Audio / Visual</option>
                    <option value="Power & Generators">Power & Generators</option>
                    <option value="Vehicles & Transport">Vehicles & Transport</option>
                    <option value="Buildings & Infrastructure">Buildings</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Asset Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shure Wireless Microphone System"
                  value={astName}
                  onChange={(e) => setAstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Purchase Cost (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={astCostGhs}
                    onChange={(e) => setAstCostGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Useful Life (Years)</label>
                  <input
                    type="number"
                    min="1"
                    value={astYears}
                    onChange={(e) => setAstYears(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={astLocation}
                    onChange={(e) => setAstLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Fund Used</label>
                  <select
                    value={astFundId}
                    onChange={(e) => setAstFundId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Serial Number</label>
                  <input
                    type="text"
                    placeholder="SN-12345"
                    value={astSerial}
                    onChange={(e) => setAstSerial(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAssetOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE VOUCHER */}
      <PrintableVoucherModal
        voucher={selectedPrintVoucher}
        isOpen={!!selectedPrintVoucher}
        onClose={() => setSelectedPrintVoucher(null)}
      />
    </div>
  );
};
