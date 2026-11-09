import React, { useState, useMemo } from 'react';
import { useExpenses } from '../../context/ExpensesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  calculateWithholdingTax,
  type WithholdingTaxRate,
  type VoucherPaymentMethod,
  type AssetCategory,
  type Requisition,
  type PaymentVoucher,
} from '@church/domain';
import {
  Plus,
  Printer,
  X,
  FileText,
  ShieldCheck,
  Edit2,
} from 'lucide-react';
import { useApprovals } from '../../context/ApprovalContext.js';
import { PrintableVoucherModal } from './PrintableVoucherModal.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { UnderlineTabs, type UnderlineTabItem } from '../ui/UnderlineTabs.js';
import { DataTable, type Column } from '../ui/DataTable.js';
import { StatusDot, CategoryTag } from '../ui/StatusDot.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate } from '../../config/churchSettings.js';
import { shortDocNumber } from '../../utils/formatters.js';
import { useRouter } from '../../context/RouterContext.js';

export const ExpensesView: React.FC = () => {
  const { currentUser } = useAuth();
  const { funds, accounts } = useLedger();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const {
    requisitions,
    vouchers,
    vendors,
    pettyCashFloat,
    pettyCashTransactions,
    assets,
    submitRequisition,
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

  // Requisition Filters
  const [reqStatusFilter, setReqStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'>('ALL');
  const [reqFundFilter, setReqFundFilter] = useState('ALL');

  // Payment Voucher Form State
  const [isNewVoucherOpen, setIsNewVoucherOpen] = useState(false);
  const [vPayee, setVPayee] = useState('');
  const [vVendorId, setVVendorId] = useState('');
  const vReqId = '';
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

  // Controlled Payment Details State (Spec Section C4)
  const {
    getPendingChangesForEntity,
    getRecentApprovedChangeForEntity,
    submitDetailChange,
    approveDetailChange,
  } = useApprovals();

  const [editDetailModal, setEditDetailModal] = useState<{
    isOpen: boolean;
    vendorId: string;
    vendorName: string;
    detailType: 'BANK_ACCOUNT' | 'MOMO_NUMBER';
    oldValue: string;
    newValue: string;
  }>({
    isOpen: false,
    vendorId: '',
    vendorName: '',
    detailType: 'MOMO_NUMBER',
    oldValue: '',
    newValue: '',
  });

  const handleOpenEditPaymentDetails = (v: (typeof vendors)[0]) => {
    const currentVal = v.momoNumber || v.bankDetails || '';
    const type = v.momoNumber ? 'MOMO_NUMBER' : 'BANK_ACCOUNT';
    setEditDetailModal({
      isOpen: true,
      vendorId: v.id,
      vendorName: v.name,
      detailType: type,
      oldValue: currentVal,
      newValue: currentVal,
    });
  };

  const handleSavePaymentDetailChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDetailModal.newValue.trim()) {
      showToast('Please enter the updated payment detail.', 'error');
      return;
    }
    if (editDetailModal.newValue.trim() === editDetailModal.oldValue.trim()) {
      showToast('New value must differ from the current value.', 'error');
      return;
    }
    try {
      submitDetailChange({
        entityType: 'VENDOR',
        entityId: editDetailModal.vendorId,
        entityName: editDetailModal.vendorName,
        detailType: editDetailModal.detailType,
        oldValue: editDetailModal.oldValue,
        newValue: editDetailModal.newValue.trim(),
      });
      showToast(
        `Payment detail modification submitted for ${editDetailModal.vendorName}. Under Spec C4, a 2nd person must approve it before payment use.`,
        'success'
      );
      setEditDetailModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit modification', 'error');
    }
  };

  const handleApprovePaymentDetailChange = (changeId: string) => {
    try {
      const res = approveDetailChange(changeId);
      if (!res.success) {
        showToast(res.error || 'Cannot approve', 'error');
      } else {
        showToast('Payment detail change approved by dual-control officer.', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cannot approve', 'error');
    }
  };

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

  // Asset register summary
  const assetSummary = getAssetSummary();

  // Escape key handlers for all modal dialogs
  useModalEscape(isNewReqOpen, () => setIsNewReqOpen(false));
  useModalEscape(isNewVoucherOpen, () => setIsNewVoucherOpen(false));
  useModalEscape(isDisburseOpen, () => setIsDisburseOpen(false));
  useModalEscape(isAddVendorOpen, () => setIsAddVendorOpen(false));
  useModalEscape(isAddAssetOpen, () => setIsAddAssetOpen(false));

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
    showToast({
      message: 'Requisition submitted for Pastoral / Elder approval.',
    });
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

      showToast({
        message: `Payment Voucher ${voucher.voucherNumber} created. Net payable: GHS ${(Number(netPesewas) / 100).toFixed(2)}${whtPesewas > 0n ? ` (WHT GHS ${(Number(whtPesewas) / 100).toFixed(2)} posted to Tax Payable)` : ''}. Journal entry linked!`,
      });
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
    showToast({
      message: 'Petty cash disbursed and logged. Float updated in real time.',
    });
  };

  // Replenish Petty Cash Handler
  const handleReplenishPettyCash = () => {
    try {
      const res = replenishPettyCash('acct-1030'); // Bank Account GHS
      showToast({
        message: `Petty cash float replenished to GHS ${(Number(pettyCashFloat.targetFloatPesewas) / 100).toFixed(2)}. Total reimbursed: GHS ${(Number(res.totalGhs) / 100).toFixed(2)}. Ledger updated!`,
      });
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
    showToast({
      message: 'Vendor added to directory.',
    });
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
    showToast({
      message: 'Asset registered into fixed asset schedule.',
    });
  };

  // 1. Underline Tabs Specification (B2.1)
  const tabs: UnderlineTabItem[] = [
    { id: 'REQUISITIONS', label: 'Requisitions', count: requisitions.length },
    { id: 'VOUCHERS', label: 'Payment Vouchers & WHT', count: vouchers.length },
    { id: 'PETTY_CASH', label: 'Petty Cash Imprest' },
    { id: 'VENDORS', label: 'Vendors', count: vendors.length },
    { id: 'ASSETS', label: 'Fixed Asset Register', count: assets.length },
  ];

  // 2. Requisition Summary Strip Metrics (B2.5)
  const pendingRequisitions = requisitions.filter((r) => r.status === 'PENDING');
  const approvedRequisitions = requisitions.filter((r) => r.status === 'APPROVED');
  const paidRequisitions = requisitions.filter((r) => r.status === 'PAID');

  const pendingCount = pendingRequisitions.length;
  const pendingTotalPesewas = pendingRequisitions.reduce((sum, r) => sum + r.estimatedAmountPesewas, 0n);

  const approvedCount = approvedRequisitions.length;
  const approvedTotalPesewas = approvedRequisitions.reduce((sum, r) => sum + r.estimatedAmountPesewas, 0n);

  const paidCount = paidRequisitions.length;
  const paidTotalPesewas = paidRequisitions.reduce((sum, r) => sum + r.estimatedAmountPesewas, 0n);

  // Filtered Requisitions for Table
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      if (reqStatusFilter !== 'ALL' && r.status !== reqStatusFilter) return false;
      if (reqFundFilter !== 'ALL' && r.fundId !== reqFundFilter) return false;
      return true;
    });
  }, [requisitions, reqStatusFilter, reqFundFilter]);

  // Requisitions DataTable Columns (B2.2)
  const requisitionColumns: Column<Requisition>[] = [
    {
      key: 'reqNumber',
      header: 'Requisition',
      sortable: true,
      render: (req) => (
        <span className="font-sans tabular-nums font-medium text-[var(--text-primary)]">
          {shortDocNumber(req.reqNumber)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (req) => (
        <span className="text-[var(--text-secondary)] whitespace-nowrap">
          {formatDate(req.createdAt.slice(0, 10))}
        </span>
      ),
    },
    {
      key: 'departmentName',
      header: 'Department',
      sortable: true,
      render: (req) => (
        <span className="font-medium text-[var(--text-primary)]">
          {req.departmentName}
        </span>
      ),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (req) => (
        <div className="max-w-xs md:max-w-md">
          <p className="line-clamp-2 text-xs text-[var(--text-primary)] leading-snug">
            {req.purpose}
          </p>
          {req.quotesNotes && (
            <span className="text-xs text-[var(--text-muted)] block mt-0.5 truncate italic">
              {req.quotesNotes}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'fundName',
      header: 'Fund',
      sortable: true,
      render: (req) => <CategoryTag>{req.fundName}</CategoryTag>,
    },
    {
      key: 'estimatedAmountPesewas',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (req) => (
        <MoneyCell amountPesewas={req.estimatedAmountPesewas} align="right" size="sm" />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (req) => {
        const dotStatus =
          req.status === 'PENDING'
            ? 'pending'
            : req.status === 'APPROVED'
            ? 'approved'
            : req.status === 'PAID'
            ? 'posted'
            : 'rejected';
        const label =
          req.status === 'PENDING'
            ? 'Pending'
            : req.status === 'APPROVED'
            ? 'Approved'
            : req.status === 'PAID'
            ? 'Paid'
            : 'Rejected';
        return (
          <div className="flex items-center">
            <StatusDot status={dotStatus} label={label} />
            <span className="sr-only">{req.status}</span>
          </div>
        );
      },
    },
    {
      key: 'nextStep',
      header: 'Next step',
      render: (req) => {
        if (req.status === 'PENDING') {
          return <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Awaiting Pastor</span>;
        }
        if (req.status === 'APPROVED') {
          return <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Ready for voucher</span>;
        }
        if (req.status === 'PAID') {
          return <span className="text-xs text-[var(--text-muted)]">Paid</span>;
        }
        return <span className="text-xs text-rose-700 dark:text-rose-400">Declined</span>;
      },
    },
  ];

  // Vouchers DataTable Columns (B2.6)
  const voucherColumns: Column<PaymentVoucher>[] = [
    {
      key: 'voucherNumber',
      header: 'Voucher',
      sortable: true,
      render: (v) => (
        <span className="font-sans tabular-nums font-medium text-[var(--text-primary)]">
          {shortDocNumber(v.voucherNumber)}
        </span>
      ),
    },
    {
      key: 'voucherDate',
      header: 'Date',
      sortable: true,
      render: (v) => (
        <span className="text-[var(--text-secondary)] whitespace-nowrap">
          {formatDate(v.voucherDate)}
        </span>
      ),
    },
    {
      key: 'payeeName',
      header: 'Payee & Purpose',
      render: (v) => (
        <div>
          <div className="font-medium text-[var(--text-primary)]">{v.payeeName}</div>
          <div className="line-clamp-1 text-xs text-[var(--text-secondary)] mt-0.5">{v.purpose}</div>
        </div>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Disbursement channel',
      render: (v) => (
        <div className="text-xs">
          <span className="font-medium text-[var(--text-primary)]">{v.paymentMethod}</span>
          {v.chequeNumber && (
            <span className="block text-xs text-[var(--text-muted)] font-sans tabular-nums">#{v.chequeNumber}</span>
          )}
          {v.momoReference && (
            <span className="block text-xs text-[var(--text-muted)] font-sans tabular-nums">Ref: {v.momoReference}</span>
          )}
        </div>
      ),
    },
    {
      key: 'grossAmountPesewas',
      header: 'Gross Amount',
      align: 'right',
      sortable: true,
      render: (v) => <MoneyCell amountPesewas={v.grossAmountPesewas} align="right" size="sm" />,
    },
    {
      key: 'withholdingTaxPesewas',
      header: 'Withholding tax (WHT)',
      align: 'right',
      render: (v) => (
        <div className="text-right">
          {v.withholdingTaxPesewas > 0n ? (
            <>
              <span className="font-sans tabular-nums text-amber-700 dark:text-amber-400 font-medium">
                - GHS {(Number(v.withholdingTaxPesewas) / 100).toFixed(2)}
              </span>
              <span className="text-xs text-[var(--text-muted)] block">
                ({v.withholdingTaxRate}%)
              </span>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'netPayablePesewas',
      header: 'Net Disbursed',
      align: 'right',
      sortable: true,
      render: (v) => <MoneyCell amountPesewas={v.netPayablePesewas} align="right" size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      render: (v) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPrintVoucher(v);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] border border-[var(--surface-border)] transition"
          title="View and print official payment voucher"
        >
          <Printer className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Print</span>
        </button>
      ),
    },
  ];

  // Petty Cash DataTable Columns
  const pettyCashColumns: Column<(typeof pettyCashTransactions)[0]>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (tx) => (
        <span className="text-[var(--text-secondary)]">{formatDate(tx.date)}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (tx) => (
        <span className="font-medium text-[var(--text-primary)]">{tx.description}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (tx) => <CategoryTag>{tx.category}</CategoryTag>,
    },
    {
      key: 'paidTo',
      header: 'Paid To',
      render: (tx) => <span className="text-[var(--text-secondary)]">{tx.paidTo}</span>,
    },
    {
      key: 'amountPesewas',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (tx) => <MoneyCell amountPesewas={tx.amountPesewas} align="right" size="sm" />,
    },
    {
      key: 'isReplenished',
      header: 'Status',
      align: 'center',
      render: (tx) => (
        <StatusDot
          status={tx.isReplenished ? 'posted' : 'pending'}
          label={tx.isReplenished ? 'Replenished' : 'Pending Replenishment'}
        />
      ),
    },
  ];

  // Vendor DataTable Columns
  const vendorColumns: Column<(typeof vendors)[0]>[] = [
    {
      key: 'name',
      header: 'Vendor Name',
      sortable: true,
      render: (v) => <span className="font-medium text-[var(--text-primary)]">{v.name}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (v) => <CategoryTag>{v.category}</CategoryTag>,
    },
    {
      key: 'contactPhone',
      header: 'Phone',
      render: (v) => (
        <span className="text-[var(--text-secondary)]">{v.contactPhone || '—'}</span>
      ),
    },
    {
      key: 'tinOrGhanaCard',
      header: 'TIN / Ghana Card',
      render: (v) => (
        <span className="font-sans tabular-nums text-xs text-[var(--text-primary)]">
          {v.tinOrGhanaCard || '—'}
        </span>
      ),
    },
    {
      key: 'momoNumber',
      header: 'Payment Details & Controls',
      render: (v) => {
        const pendingList = getPendingChangesForEntity(v.id);
        const pending = pendingList[0];
        const recentApproved = getRecentApprovedChangeForEntity(v.id);
        const isProposer = pending && currentUser.id === pending.changedByUserId;

        return (
          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-primary)]">
              {v.momoNumber ? `MoMo: ${v.momoNumber}` : v.bankDetails ? `Bank: ${v.bankDetails}` : '—'}
            </div>
            {pending && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Pending 2nd person approval: {pending.newValue}
                </span>
                {!isProposer ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprovePaymentDetailChange(pending.id);
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 transition cursor-pointer"
                  >
                    Approve
                  </button>
                ) : (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                    Awaiting 2nd officer
                  </span>
                )}
              </div>
            )}
            {recentApproved && !pending && (
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                Verified & authorized
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'totalPaidGhsPesewas',
      header: 'Total Disbursed',
      align: 'right',
      sortable: true,
      render: (v) => (
        <MoneyCell amountPesewas={v.totalPaidGhsPesewas} align="right" size="sm" />
      ),
    },
    {
      key: 'id' as any,
      header: 'Actions',
      align: 'right',
      render: (v) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenEditPaymentDetails(v);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-sm)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
        >
          <Edit2 className="w-3 h-3" />
          <span>Edit details</span>
        </button>
      ),
    },
  ];

  // Asset DataTable Columns
  const assetColumns: Column<(typeof assets)[0]>[] = [
    {
      key: 'assetTag',
      header: 'Asset Tag',
      sortable: true,
      render: (ast) => (
        <span className="font-sans tabular-nums font-medium text-[var(--text-primary)]">
          {shortDocNumber(ast.assetTag)}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Asset Name & Category',
      render: (ast) => (
        <div>
          <div className="font-medium text-[var(--text-primary)]">{ast.name}</div>
          <div className="text-xs text-[var(--text-secondary)]">{ast.category}</div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (ast) => <span className="text-[var(--text-secondary)]">{ast.location}</span>,
    },
    {
      key: 'purchaseDate',
      header: 'Purchased',
      render: (ast) => (
        <span className="text-[var(--text-secondary)]">{formatDate(ast.purchaseDate)}</span>
      ),
    },
    {
      key: 'purchaseCostPesewas',
      header: 'Cost',
      align: 'right',
      sortable: true,
      render: (ast) => (
        <MoneyCell amountPesewas={ast.purchaseCostPesewas} align="right" size="sm" />
      ),
    },
    {
      key: 'annualDepreciation',
      header: 'Annual Dep.',
      align: 'right',
      render: (ast) => {
        const dep = assetSummary.results.find((r) => r.assetId === ast.id);
        return (
          <MoneyCell
            amountPesewas={dep?.annualDepreciationPesewas || 0n}
            align="right"
            size="sm"
            subdued
          />
        );
      },
    },
    {
      key: 'accumulatedDepreciation',
      header: 'Acc. Dep.',
      align: 'right',
      render: (ast) => {
        const dep = assetSummary.results.find((r) => r.assetId === ast.id);
        return (
          <MoneyCell
            amountPesewas={dep?.accumulatedDepreciationPesewas || 0n}
            align="right"
            size="sm"
            subdued
          />
        );
      },
    },
    {
      key: 'netBookValue',
      header: 'Net Book Value',
      align: 'right',
      sortable: true,
      render: (ast) => {
        const dep = assetSummary.results.find((r) => r.assetId === ast.id);
        return (
          <MoneyCell
            amountPesewas={dep?.netBookValuePesewas || 0n}
            align="right"
            size="sm"
          />
        );
      },
    },
    {
      key: 'condition',
      header: 'Condition',
      align: 'center',
      render: (ast) => (
        <span className="px-2 py-0.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--surface-border)] text-xs font-medium">
          {ast.condition}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header (B2.1): Title "Expenditure", no icon tile, no subtitle */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Expenditure
          </h1>
        </div>

        {/* Underline Tabs Navigation */}
        <UnderlineTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as any)}
          ariaLabel="Expenditure Sections"
          tabRole="button"
        />
      </div>

      {/* 2. REQUISITIONS TAB */}
      {activeTab === 'REQUISITIONS' && (
        <div className="space-y-4">
          {/* Summary Strip (B2.5): Plain text, no cards, hairline dividers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--surface-border)] border-y border-[var(--surface-border)] py-3 text-xs">
            <div className="px-3 py-1">
              <span className="text-[var(--text-muted)] block text-xs normal-case font-medium">
                Awaiting approval
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {pendingCount} {pendingCount === 1 ? 'request' : 'requests'}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="font-sans tabular-nums text-sm font-medium text-[var(--text-primary)]">
                  GHS {(Number(pendingTotalPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="px-3 py-1 sm:pl-5">
              <span className="text-[var(--text-muted)] block text-xs normal-case font-medium">
                Approved not paid
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {approvedCount} {approvedCount === 1 ? 'request' : 'requests'}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="font-sans tabular-nums text-sm font-medium text-[var(--text-primary)]">
                  GHS {(Number(approvedTotalPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="px-3 py-1 sm:pl-5">
              <span className="text-[var(--text-muted)] block text-xs normal-case font-medium">
                Paid this month
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {paidCount} {paidCount === 1 ? 'voucher' : 'vouchers'}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="font-sans tabular-nums text-sm font-medium text-[var(--text-primary)]">
                  GHS {(Number(paidTotalPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Table Heading & Toolbar (B2.2) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Expenditure Requisitions
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <select
                value={reqStatusFilter}
                onChange={(e) => setReqStatusFilter(e.target.value as any)}
                aria-label="Filter by status"
                className="px-2.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="REJECTED">Rejected</option>
              </select>

              {/* Fund Filter */}
              <select
                value={reqFundFilter}
                onChange={(e) => setReqFundFilter(e.target.value)}
                aria-label="Filter by fund"
                className="px-2.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)]"
              >
                <option value="ALL">All Funds</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {/* Primary Action Button (Full page per Requirement 1) */}
              <button
                type="button"
                onClick={() => {
                  setIsNewReqOpen(true);
                  try {
                    navigate('#/requisitions/new');
                  } catch {}
                }}
                aria-label="Submit Requisition"
                title="Submit Requisition"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit Requisition</span>
              </button>
            </div>
          </div>

          {/* DataTable Component (B2.2 - opens full page, zero drawers) */}
          <DataTable<Requisition>
            columns={requisitionColumns}
            data={filteredRequisitions}
            keyExtractor={(req) => req.id}
            onRowClick={(req) =>
              navigate(`#/requisitions/${req.id}`, {
                listKey: 'requisitions',
                listItemIds: filteredRequisitions.map((r) => r.id),
              })
            }
            searchable={true}
            searchPlaceholder="Search requisitions by department, purpose, or requisition number..."
            searchFilter={(req, q) =>
              req.reqNumber.toLowerCase().includes(q) ||
              req.departmentName.toLowerCase().includes(q) ||
              req.purpose.toLowerCase().includes(q) ||
              req.fundName.toLowerCase().includes(q)
            }
            emptyMessage="No expenditure requisitions found."
            emptyActionLabel="Submit Requisition"
            onEmptyAction={() => navigate('#/requisitions/new')}
          />
        </div>
      )}

      {/* 3. PAYMENT VOUCHERS TAB (B2.6) */}
      {activeTab === 'VOUCHERS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Payment Vouchers & Withholding Tax (WHT)
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Official payment vouchers with automatic Ghana Withholding Tax (WHT) liability deduction and ledger posting.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsNewVoucherOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Payment Voucher</span>
            </button>
          </div>

          <DataTable<PaymentVoucher>
            columns={voucherColumns}
            data={vouchers}
            keyExtractor={(v) => v.id}
            onRowClick={(v) =>
              navigate(`#/vouchers/${v.id}`, {
                listKey: 'vouchers',
                listItemIds: vouchers.map((x) => x.id),
              })
            }
            searchable={true}
            searchPlaceholder="Search vouchers by voucher number, payee, or purpose..."
            searchFilter={(v, q) =>
              v.voucherNumber.toLowerCase().includes(q) ||
              v.payeeName.toLowerCase().includes(q) ||
              v.purpose.toLowerCase().includes(q)
            }
            emptyMessage="No payment vouchers prepared yet."
            emptyActionLabel="New Payment Voucher"
            onEmptyAction={() => setIsNewVoucherOpen(true)}
          />
        </div>
      )}

      {/* 4. PETTY CASH IMPREST TAB */}
      {activeTab === 'PETTY_CASH' && (
        <div className="space-y-5">
          {/* Imprest Status Quiet Strip: hairline dividers, no cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--surface-border)] border-y border-[var(--surface-border)] py-3 text-xs">
            <div className="px-3 py-1">
              <span className="text-[var(--text-muted)] block text-xs font-semibold">
                Fixed imprest float
              </span>
              <div className="mt-1 font-sans tabular-nums text-base font-semibold text-[var(--text-primary)]">
                GHS {(Number(pettyCashFloat.targetFloatPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                Custodian: {pettyCashFloat.custodianName}
              </span>
            </div>

            <div className="px-3 py-1 sm:pl-5">
              <span className="text-[var(--text-muted)] block text-xs font-semibold">
                Cash in box (available)
              </span>
              <div className="mt-1 font-sans tabular-nums text-base font-semibold text-emerald-600 dark:text-emerald-400">
                GHS {(Number(pettyCashFloat.cashOnHandPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-[var(--text-muted)] block mt-0.5">Physical float box</span>
            </div>

            <div className="px-3 py-1 sm:pl-5">
              <span className="text-[var(--text-muted)] block text-xs font-semibold">
                Unreimbursed receipts
              </span>
              <div className="mt-1 font-sans tabular-nums text-base font-semibold text-amber-600 dark:text-amber-400">
                GHS {(Number(pettyCashFloat.unreimbursedReceiptsPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-[var(--text-muted)] block mt-0.5">Disbursed with receipts</span>
            </div>

            <div className="px-3 py-1 sm:pl-5 flex flex-col justify-between">
              <div>
                <span className="text-[var(--text-muted)] block text-xs font-semibold">
                  Replenishment needed
                </span>
                <div className="mt-1 font-sans tabular-nums text-base font-semibold text-[var(--text-primary)]">
                  GHS {(Number(pettyCashFloat.unreimbursedReceiptsPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                type="button"
                onClick={handleReplenishPettyCash}
                disabled={pettyCashFloat.unreimbursedReceiptsPesewas === 0n}
                className="mt-2 w-full py-1.5 px-3 bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] disabled:opacity-40 text-[var(--text-primary)] border border-[var(--surface-border)] rounded-[var(--radius)] text-xs font-semibold transition"
              >
                Replenish Float
              </button>
            </div>
          </div>

          {/* Petty Cash Disbursements Table */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Petty Cash Disbursement Log ({pettyCashTransactions.length})
              </h2>

              <button
                type="button"
                onClick={() => setIsDisburseOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Disburse Minor Expense</span>
              </button>
            </div>

            <DataTable<(typeof pettyCashTransactions)[0]>
              columns={pettyCashColumns}
              data={pettyCashTransactions}
              keyExtractor={(tx) => tx.id}
              searchable={true}
              searchPlaceholder="Search disbursements by description, category, or recipient..."
              searchFilter={(tx, q) =>
                tx.description.toLowerCase().includes(q) ||
                tx.category.toLowerCase().includes(q) ||
                tx.paidTo.toLowerCase().includes(q)
              }
              emptyMessage="No petty cash disbursements recorded for this float."
              emptyActionLabel="Disburse Minor Expense"
              onEmptyAction={() => setIsDisburseOpen(true)}
            />
          </div>
        </div>
      )}

      {/* 5. VENDORS TAB */}
      {activeTab === 'VENDORS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Church Vendor & Contractor Directory
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Registered suppliers with Ghana TIN / Card numbers and cumulative payment history.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddVendorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Vendor</span>
            </button>
          </div>

          <DataTable<(typeof vendors)[0]>
            columns={vendorColumns}
            data={vendors}
            keyExtractor={(v) => v.id}
            searchable={true}
            searchPlaceholder="Search vendors by name, category, or TIN..."
            searchFilter={(v, q) =>
              v.name.toLowerCase().includes(q) ||
              v.category.toLowerCase().includes(q) ||
              Boolean(v.tinOrGhanaCard && v.tinOrGhanaCard.toLowerCase().includes(q))
            }
            emptyMessage="No church vendors or contractors registered yet."
            emptyActionLabel="Register Vendor"
            onEmptyAction={() => setIsAddVendorOpen(true)}
          />
        </div>
      )}

      {/* 6. FIXED ASSET REGISTER TAB */}
      {activeTab === 'ASSETS' && (
        <div className="space-y-5">
          {/* Asset Portfolio Summary Metrics: hairline dividers, no cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--surface-border)] border-y border-[var(--surface-border)] py-3 text-xs">
            <div className="px-3 py-1">
              <span className="text-[var(--text-muted)] block text-xs font-semibold">
                Total fixed assets
              </span>
              <div className="mt-1 font-sans tabular-nums text-base font-semibold text-[var(--text-primary)]">
                {assetSummary.totalAssetsCount} items
              </div>
            </div>

            <div className="px-3 py-1 sm:pl-5">
              <span className="text-[var(--text-muted)] block text-xs font-semibold">
                Historical cost
              </span>
              <div className="mt-1 font-sans tabular-nums text-base font-semibold text-[var(--text-primary)]">
                GHS {(Number(assetSummary.totalCostPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="px-3 py-1 sm:pl-5">
              <span className="text-[var(--text-muted)] block text-xs font-semibold">
                Accumulated depreciation
              </span>
              <div className="mt-1 font-sans tabular-nums text-base font-semibold text-rose-600 dark:text-rose-400">
                GHS {(Number(assetSummary.totalAccumulatedDepreciationPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="px-3 py-1 sm:pl-5">
              <span className="text-[var(--text-muted)] block text-xs font-semibold">
                Net book value (NBV)
              </span>
              <div className="mt-1 font-sans tabular-nums text-base font-semibold text-emerald-600 dark:text-emerald-400">
                GHS {(Number(assetSummary.totalNetBookValuePesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Asset Register Table */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Church Asset Register & Straight-Line Depreciation
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Fixed asset inventory with tag numbers, useful life, monthly depreciation, and carrying value.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('#/assets/new-asset')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Fixed Asset</span>
              </button>
            </div>

            <DataTable<(typeof assets)[0]>
              columns={assetColumns}
              data={assets}
              keyExtractor={(ast) => ast.id}
              onRowClick={(ast) =>
                navigate(`#/assets/${ast.id}`, {
                  listKey: 'assets',
                  listItemIds: assets.map((x) => x.id),
                })
              }
              searchable={true}
              searchPlaceholder="Search assets by tag, name, location, or category..."
              searchFilter={(ast, q) =>
                ast.assetTag.toLowerCase().includes(q) ||
                ast.name.toLowerCase().includes(q) ||
                ast.location.toLowerCase().includes(q) ||
                ast.category.toLowerCase().includes(q)
              }
              emptyMessage="No fixed assets logged in the church asset register yet."
              emptyActionLabel="Register Fixed Asset"
              onEmptyAction={() => navigate('#/assets/new-asset')}
            />
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT REQUISITION */}
      {isNewReqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[6px] max-w-md w-full p-6 shadow-xl text-[var(--text-primary)] space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--surface-border)]">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" />
                <span>Submit Department Requisition</span>
              </h3>
              <button
                onClick={() => setIsNewReqOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRequisition} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Department
                </label>
                <select
                  value={reqDept}
                  onChange={(e) => setReqDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                >
                  <option value="Music & Choir">Music & Choir</option>
                  <option value="Administration">Administration & Secretariat</option>
                  <option value="Youth Ministry">Youth Ministry</option>
                  <option value="Welfare">Welfare & Benevolence</option>
                  <option value="Outreach & Missions">Outreach & Missions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Fund
                </label>
                <select
                  value={reqFundId}
                  onChange={(e) => setReqFundId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                >
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Purpose / Justification
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Detail the expenditure need and purpose..."
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Estimated Amount (GHS)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={reqAmountGhs}
                  onChange={(e) => setReqAmountGhs(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-sm font-medium text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Supplier Quotes / Attachment Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Attached proforma invoice from vendor"
                  value={reqQuotes}
                  onChange={(e) => setReqQuotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--surface-border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewReqOpen(false)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] rounded-[var(--radius)] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  aria-label="Submit Requisition"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW PAYMENT VOUCHER (WITH WHT) */}
      {isNewVoucherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[6px] max-w-lg w-full p-6 shadow-xl text-[var(--text-primary)] space-y-4 my-8">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--surface-border)]">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <Printer className="w-4 h-4 text-[var(--accent)]" />
                <span>Issue Payment Voucher (with Ghana WHT)</span>
              </h3>
              <button
                onClick={() => setIsNewVoucherOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Payee Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Akwasi Sound Ltd"
                    value={vPayee}
                    onChange={(e) => setVPayee(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Or Select Registered Vendor
                  </label>
                  <select
                    value={vVendorId}
                    onChange={(e) => {
                      setVVendorId(e.target.value);
                      const sel = vendors.find((v) => v.id === e.target.value);
                      if (sel) setVPayee(sel.name);
                    }}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
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
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Expenditure Purpose
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Auditorium acoustic mixer servicing"
                  value={vPurpose}
                  onChange={(e) => setVPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Expense Account
                  </label>
                  <select
                    value={vExpenseAccountId}
                    onChange={(e) => setVExpenseAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  >
                    <option value="acct-5010">5010 - Salaries and Allowances</option>
                    <option value="acct-5020">5020 - Utilities</option>
                    <option value="acct-5030">5030 - Maintenance & Repairs</option>
                    <option value="acct-5040">5040 - Outreach and Missions</option>
                    <option value="acct-5050">5050 - Welfare Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Fund
                  </label>
                  <select
                    value={vFundId}
                    onChange={(e) => setVFundId(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
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
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Gross Amount (GHS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={vGrossGhs}
                    onChange={(e) => setVGrossGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-sm font-medium text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Withholding tax (WHT)
                  </label>
                  <select
                    value={vWhtRate}
                    onChange={(e) => setVWhtRate(parseFloat(e.target.value) as WithholdingTaxRate)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
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
              <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Gross Invoice Total:</span>
                  <span>GHS {(Number(grossPesewas) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>WHT Deducted ({vWhtRate}%):</span>
                  <span>- GHS {(Number(whtPesewas) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold pt-1 border-t border-[var(--surface-border)]">
                  <span>Net Amount Disbursed to Payee:</span>
                  <span>GHS {(Number(netPesewas) / 100).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Payment Method
                </label>
                <select
                  value={vPaymentMethod}
                  onChange={(e) => setVPaymentMethod(e.target.value as VoucherPaymentMethod)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                >
                  <option value="BANK_GHS">Bank Transfer (GHS 1030)</option>
                  <option value="CHEQUE">Bank Cheque (GHS 1030)</option>
                  <option value="MOMO">Mobile Money (MoMo 1050)</option>
                  <option value="CASH_GHS">Cash on Hand (GHS 1010)</option>
                </select>
              </div>

              {vPaymentMethod === 'CHEQUE' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Cheque Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CHQ-009941"
                    value={vChequeNum}
                    onChange={(e) => setVChequeNum(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-[var(--text-primary)]"
                  />
                </div>
              )}

              {vPaymentMethod === 'MOMO' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Network
                    </label>
                    <select
                      value={vMomoNet}
                      onChange={(e) => setVMomoNet(e.target.value)}
                      className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                    >
                      <option value="MTN">MTN MoMo</option>
                      <option value="VODAFONE">Telecel Cash</option>
                      <option value="AIRTELTIGO">AirtelTigo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Recipient MoMo Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+233 24 000 0000"
                      value={vMomoPhone}
                      onChange={(e) => setVMomoPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Transaction Ref
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MTN-99201"
                      value={vMomoRef}
                      onChange={(e) => setVMomoRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[var(--surface-border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewVoucherOpen(false)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] rounded-[var(--radius)] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold"
                >
                  Authorize & Post Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISBURSE PETTY CASH */}
      {isDisburseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[6px] max-w-md w-full p-6 shadow-xl text-[var(--text-primary)] space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--surface-border)]">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" />
                <span>Disburse Minor Petty Cash Expense</span>
              </h3>
              <button
                onClick={() => setIsDisburseOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDisbursePettyCash} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Expense Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generator diesel fuel, tea for elders"
                  value={pcDesc}
                  onChange={(e) => setPcDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Expense Account
                  </label>
                  <select
                    value={pcExpenseAccId}
                    onChange={(e) => {
                      setPcExpenseAccId(e.target.value);
                      if (e.target.value === 'acct-5020') setPcCategory('Utilities');
                      if (e.target.value === 'acct-5030') setPcCategory('Maintenance & Repairs');
                    }}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  >
                    <option value="acct-5020">5020 - Utilities</option>
                    <option value="acct-5030">5030 - Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Amount (GHS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={pcAmtGhs}
                    onChange={(e) => setPcAmtGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-sm font-medium text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Paid To
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Vendor / Shop Name"
                    value={pcPaidTo}
                    onChange={(e) => setPcPaidTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Receipt No. (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Receipt #"
                    value={pcReceiptNum}
                    onChange={(e) => setPcReceiptNum(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--surface-border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseOpen(false)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] rounded-[var(--radius)] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold"
                >
                  Disburse Cash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VENDOR */}
      {isAddVendorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[6px] max-w-md w-full p-6 shadow-xl text-[var(--text-primary)] space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--surface-border)]">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" />
                <span>Register Vendor</span>
              </h3>
              <button
                onClick={() => setIsAddVendorOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Company / Vendor Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ghana Telecom / Telecel"
                  value={venName}
                  onChange={(e) => setVenName(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Category
                  </label>
                  <select
                    value={venCat}
                    onChange={(e) => setVenCat(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  >
                    <option value="Utilities">Utilities</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Audio/Visual">Audio / Visual & Music</option>
                    <option value="Fuel & Transport">Fuel & Transport</option>
                    <option value="Office Supplies">Office Supplies</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+233 24 000 0000"
                    value={venPhone}
                    onChange={(e) => setVenPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    TIN / Ghana Card
                  </label>
                  <input
                    type="text"
                    placeholder="C0001234567"
                    value={venTin}
                    onChange={(e) => setVenTin(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    MoMo Number
                  </label>
                  <input
                    type="text"
                    placeholder="+233 24 000 0000"
                    value={venMomo}
                    onChange={(e) => setVenMomo(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--surface-border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddVendorOpen(false)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] rounded-[var(--radius)] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CONTROLLED PAYMENT DETAILS (Spec C4) */}
      {editDetailModal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn"
        >
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-md w-full p-6 shadow-xl text-[var(--text-primary)] space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--surface-border)]">
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                  <span>Update Payment Destination</span>
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Controlled data: Requires 2nd person dual approval before use
                </p>
              </div>
              <button
                onClick={() => setEditDetailModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentDetailChange} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Vendor / Contractor
                </label>
                <input
                  type="text"
                  disabled
                  value={editDetailModal.vendorName}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-primary)] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Detail Type
                  </label>
                  <select
                    value={editDetailModal.detailType}
                    onChange={(e) =>
                      setEditDetailModal((prev) => ({
                        ...prev,
                        detailType: e.target.value as 'BANK_ACCOUNT' | 'MOMO_NUMBER',
                      }))
                    }
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  >
                    <option value="MOMO_NUMBER">MoMo Number</option>
                    <option value="BANK_ACCOUNT">Bank Account Details</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Current Registered Value
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editDetailModal.oldValue || '—'}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-muted)] font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  New Payment Details (Destination)
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    editDetailModal.detailType === 'MOMO_NUMBER'
                      ? 'e.g. +233 24 555 0199'
                      : 'e.g. Ecobank Ghana · 1441002345'
                  }
                  value={editDetailModal.newValue}
                  onChange={(e) =>
                    setEditDetailModal((prev) => ({ ...prev, newValue: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-sm text-[var(--text-primary)]"
                />
              </div>

              <div className="p-3 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-bold">Dual-Control Enforcement:</span> You are submitting this change as {currentUser.fullName}. Under church anti-fraud policy, payment vouchers cannot disburse money to this new number or account until another authorized church officer reviews and approves it.
              </div>

              <div className="pt-3 border-t border-[var(--surface-border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditDetailModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3 py-1.5 border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] rounded-[var(--radius)] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold cursor-pointer"
                >
                  Submit for dual sign-off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER ASSET */}
      {isAddAssetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[6px] max-w-md w-full p-6 shadow-xl text-[var(--text-primary)] space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--surface-border)]">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" />
                <span>Register Fixed Asset</span>
              </h3>
              <button
                onClick={() => setIsAddAssetOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Asset Tag
                  </label>
                  <input
                    type="text"
                    placeholder="AST-004"
                    value={astTag}
                    onChange={(e) => setAstTag(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Category
                  </label>
                  <select
                    value={astCat}
                    onChange={(e) => setAstCat(e.target.value as AssetCategory)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
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
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Asset Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shure Wireless Microphone System"
                  value={astName}
                  onChange={(e) => setAstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Purchase Cost (GHS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={astCostGhs}
                    onChange={(e) => setAstCostGhs(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-sm font-medium text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Useful Life (Years)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={astYears}
                    onChange={(e) => setAstYears(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={astLocation}
                    onChange={(e) => setAstLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Fund Used
                  </label>
                  <select
                    value={astFundId}
                    onChange={(e) => setAstFundId(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="SN-12345"
                    value={astSerial}
                    onChange={(e) => setAstSerial(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] font-mono text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--surface-border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAssetOpen(false)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] rounded-[var(--radius)] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold"
                >
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
