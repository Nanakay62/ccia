import React, { useState } from 'react';
import { useGiving } from '../../context/GivingContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import {
  canViewIndividualGiving,
  generatePrintableReceipt,
  generateMemberGivingStatement,
  type PrintableReceipt,
  type MemberGivingStatement,
  type GivingCategory,
  type PaymentMethod,
  type Currency,
  type Member,
} from '@church/domain';
import { PrintableReceiptModal } from './PrintableReceiptModal.js';
import { MemberStatementModal } from './MemberStatementModal.js';
import { EmptyState } from '../ui/EmptyState.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import {
  Users,
  Search,
  UserPlus,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Receipt,
  Printer,
  X,
  Target,
  Building,
  FileText,
} from 'lucide-react';

export const GivingDirectoryView: React.FC = () => {
  const { currentUser } = useAuth();
  const { funds } = useLedger();
  const {
    members,
    pledges,
    givingRecords,
    addMember,
    recordGiving,
    recordPledge,
    getMaskedGivingRecords,
    getMaskedPledges,
  } = useGiving();

  const isPrivileged = canViewIndividualGiving(currentUser.role);
  const maskedGivingList = getMaskedGivingRecords();
  const maskedPledgesList = getMaskedPledges();

  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'GIVING_ENTRY' | 'PLEDGES'>('DIRECTORY');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Member Statement Modal State
  const [selectedStatement, setSelectedStatement] = useState<MemberGivingStatement | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  const handleOpenMemberStatement = (member: Member) => {
    const statement = generateMemberGivingStatement({
      member,
      records: givingRecords,
      pledges,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      requestingRole: currentUser.role,
      certifyingOfficer: currentUser.fullName,
      certifyingOfficerRole: currentUser.role,
      churchName: 'Accra Community Church',
      branchName: 'Main Sanctuary (Accra)',
    });
    setSelectedStatement(statement);
    setIsStatementModalOpen(true);
  };

  // Add Member Modal State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newEnvelopeNo, setNewEnvelopeNo] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFamily, setNewFamily] = useState('');
  const [newDept, setNewDept] = useState('Men Fellowship');

  useModalEscape(isAddMemberOpen, () => setIsAddMemberOpen(false));

  // New Giving Entry Form State
  const [selectedMemberId, setSelectedMemberId] = useState<string>('mem-001');
  const [givingFundId, setGivingFundId] = useState<string>('fund-gen');
  const [givingCategory, setGivingCategory] = useState<GivingCategory>('Tithe');
  const [givingMethod, setGivingMethod] = useState<PaymentMethod>('CASH');
  const [givingCurrency, setGivingCurrency] = useState<Currency>('GHS');
  const [givingAmount, setGivingAmount] = useState<string>('150.00');
  const [givingNotes, setGivingNotes] = useState<string>('');

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<PrintableReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Add Pledge Modal State
  const [isAddPledgeOpen, setIsAddPledgeOpen] = useState(false);
  const [pledgeMemberId, setPledgeMemberId] = useState('mem-001');
  const [pledgeCampaign, setPledgeCampaign] = useState('Auditorium Roofing 2026');
  const [pledgeTargetAmtGhs, setPledgeTargetAmtGhs] = useState('5000.00');

  useModalEscape(isAddPledgeOpen, () => setIsAddPledgeOpen(false));

  // Filtered members
  const filteredMembers = members.filter((m) => {
    const q = searchTerm.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.memberNumber.toLowerCase().includes(q) ||
      (m.envelopeNumber && m.envelopeNumber.toLowerCase().includes(q)) ||
      (m.familyGroup && m.familyGroup.toLowerCase().includes(q))
    );
  });

  // Handle Add Member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      alert('Please enter member full name.');
      return;
    }
    const memNo = `MEM-${String(members.length + 1).padStart(3, '0')}`;
    const phoneClean = newPhone.trim();
    const phoneHint = phoneClean.length >= 3 ? phoneClean.slice(-3) : '000';

    addMember({
      branchId: currentUser.branchId,
      memberNumber: memNo,
      envelopeNumber: newEnvelopeNo.trim() ? `ENV-${newEnvelopeNo.trim()}` : undefined,
      fullName: newMemberName.trim(),
      phone: phoneClean || undefined,
      phoneHint,
      familyGroup: newFamily.trim() || undefined,
      department: newDept,
      status: 'ACTIVE',
      joinDate: new Date().toISOString().slice(0, 10),
    });

    setNewMemberName('');
    setNewEnvelopeNo('');
    setNewPhone('');
    setNewFamily('');
    setIsAddMemberOpen(false);
  };

  // Handle Record Giving & Issue Receipt
  const handleRecordGiving = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(givingAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const member = members.find((m) => m.id === selectedMemberId);
    const fund = funds.find((f) => f.id === givingFundId);

    const record = recordGiving({
      branchId: currentUser.branchId,
      memberId: member?.id,
      memberName: member?.fullName || 'Anonymous Congregation Member',
      memberNumber: member?.memberNumber,
      envelopeNumber: member?.envelopeNumber,
      serviceDate: new Date().toISOString().slice(0, 10),
      fundId: givingFundId,
      fundName: fund?.name || 'General Fund',
      category: givingCategory,
      paymentMethod: givingMethod,
      currency: givingCurrency,
      amountPesewas: BigInt(Math.round(amt * 100)),
      notes: givingNotes.trim() || undefined,
    });

    // Generate Printable Receipt
    const printable = generatePrintableReceipt({
      record,
      receivingOfficer: currentUser.fullName,
      receivingOfficerRole: currentUser.role,
    });

    setActiveReceipt(printable);
    setIsReceiptModalOpen(true);
    setGivingNotes('');
  };

  // Handle Add Pledge
  const handleAddPledge = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(pledgeTargetAmtGhs);
    if (isNaN(target) || target <= 0) {
      alert('Please enter a valid target amount.');
      return;
    }
    const member = members.find((m) => m.id === pledgeMemberId);
    recordPledge({
      branchId: currentUser.branchId,
      memberId: pledgeMemberId,
      memberName: member?.fullName || 'Anonymous Member',
      fundId: 'fund-bld',
      fundName: 'Building Fund',
      campaignName: pledgeCampaign.trim(),
      pledgeDate: new Date().toISOString().slice(0, 10),
      targetDate: '2026-12-31',
      currency: 'GHS',
      targetAmountPesewas: BigInt(Math.round(target * 100)),
    });
    setIsAddPledgeOpen(false);
  };

  // Print existing receipt handler
  const handlePrintExistingReceipt = (record: typeof maskedGivingList[0]) => {
    const printable = generatePrintableReceipt({
      record,
      receivingOfficer: currentUser.fullName,
      receivingOfficerRole: currentUser.role,
    });
    setActiveReceipt(printable);
    setIsReceiptModalOpen(true);
  };

  // Pledge aggregate calculations
  const totalPledgedPesewas = maskedPledgesList.reduce((acc, p) => acc + p.targetAmountPesewas, 0n);
  const totalPaidPesewas = maskedPledgesList.reduce((acc, p) => acc + p.paidAmountPesewas, 0n);
  const pledgePercent = totalPledgedPesewas > 0n ? Number((totalPaidPesewas * 100n) / totalPledgedPesewas) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Role Privacy Gate Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Member Directory & Giving Management
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Member envelopes, individual tithe records, pledges, and printable official receipts.
              </p>
            </div>
          </div>

          {/* Privacy Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
              isPrivileged
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
            }`}
          >
            {isPrivileged ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-amber-600" />}
            <span>{isPrivileged ? 'Full Giving Records Authorized' : 'Confidentiality Rule Active (Masked)'}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('DIRECTORY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'DIRECTORY'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Member Directory ({members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('GIVING_ENTRY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'GIVING_ENTRY'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Individual Tithes & Giving</span>
          </button>

          <button
            onClick={() => setActiveTab('PLEDGES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'PLEDGES'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Pledges & Special Campaigns ({maskedPledgesList.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MEMBER DIRECTORY */}
      {activeTab === 'DIRECTORY' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, member #, envelope #, or family group..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>

          {filteredMembers.length === 0 ? (
            <EmptyState
              message="No members found matching your search criteria."
              actionLabel="Add New Member"
              onAction={() => setIsAddMemberOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Member No.</th>
                    <th className="p-2.5">Envelope No.</th>
                    <th className="p-2.5">Full Name</th>
                    <th className="p-2.5">Family Group</th>
                    <th className="p-2.5">Department</th>
                    <th className="p-2.5">Phone (Encrypted)</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Statement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {member.memberNumber}
                      </td>
                      <td className="p-2.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {member.envelopeNumber || '-'}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                        {member.fullName}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">
                        {member.familyGroup || '-'}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">
                        {member.department || '-'}
                      </td>
                      <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                        •••• ••• {member.phoneHint || '•••'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold">
                          {member.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleOpenMemberStatement(member)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[11px] font-semibold border border-blue-200 dark:border-blue-800 transition"
                          title="Generate Official Member Giving Statement"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Statement</span>
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

      {/* TAB 2: INDIVIDUAL GIVING ENTRY & HISTORY */}
      {activeTab === 'GIVING_ENTRY' && (
        <div className="space-y-6">
          {/* Contribution Entry Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <span>Record Contribution & Issue Printable Official Receipt</span>
            </h3>

            <form onSubmit={handleRecordGiving} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Member selection */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Select Member / Donor
                  </label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.memberNumber} - {m.envelopeNumber || 'No Envelope'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Giving Category
                  </label>
                  <select
                    value={givingCategory}
                    onChange={(e) => setGivingCategory(e.target.value as GivingCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Tithe">Tithe (10%)</option>
                    <option value="General Offering">General Offering</option>
                    <option value="Building Pledge">Building Pledge Payment</option>
                    <option value="Special Offering">Special Thanksgiving</option>
                    <option value="Missions">Missions & Evangelism</option>
                    <option value="Welfare">Welfare & Benevolence</option>
                  </select>
                </div>

                {/* Fund */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fund Credited
                  </label>
                  <select
                    value={givingFundId}
                    onChange={(e) => setGivingFundId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment method */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={givingMethod}
                    onChange={(e) => setGivingMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="CASH">Cash on Hand</option>
                    <option value="MOMO">Mobile Money (MoMo)</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="BANK_TRANSFER">Direct Bank Deposit</option>
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={givingCurrency}
                    onChange={(e) => setGivingCurrency(e.target.value as Currency)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="GHS">Ghana Cedis (GHS)</option>
                    <option value="USD">US Dollars (USD)</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Amount ({givingCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={givingAmount}
                    onChange={(e) => setGivingAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Optional Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. October monthly tithe, pledge payment #2"
                  value={givingNotes}
                  onChange={(e) => setGivingNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-md"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Issue Official Receipt & Record</span>
                </button>
              </div>
            </form>
          </div>

          {/* Giving Records Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Member Contributions ({maskedGivingList.length})
            </h3>

            {maskedGivingList.length === 0 ? (
              <EmptyState
                message="No member contribution records logged yet."
                actionLabel="Record Giving"
                onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">Receipt No.</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Donor Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Fund</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5 text-right">Amount</th>
                      <th className="p-2.5 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {maskedGivingList.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {rec.receiptNumber}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{rec.serviceDate}</td>
                        <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                          {rec.memberName}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{rec.category}</td>
                        <td className="p-2.5 text-slate-500">{rec.fundName}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{rec.paymentMethod}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {rec.currency} {(Number(rec.amountPesewas) / 100).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handlePrintExistingReceipt(rec)}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                            title="View / Print Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
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

      {/* TAB 3: PLEDGES & CAMPAIGNS */}
      {activeTab === 'PLEDGES' && (
        <div className="space-y-6">
          {/* Campaign Summary Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/10 text-white">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Auditorium Expansion Project 2026</h3>
                  <p className="text-xs text-blue-200">Restricted Building Fund Campaign</p>
                </div>
              </div>

              <button
                onClick={() => setIsAddPledgeOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-blue-900 rounded-xl text-xs font-bold hover:bg-blue-50 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Record New Pledge</span>
              </button>
            </div>

            {/* Campaign Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-blue-200 font-semibold">
                <span>Total Pledged: GHS {(Number(totalPledgedPesewas) / 100).toFixed(2)}</span>
                <span>Collected: GHS {(Number(totalPaidPesewas) / 100).toFixed(2)} ({pledgePercent}%)</span>
              </div>
              <div className="w-full bg-blue-950/60 rounded-full h-3 overflow-hidden p-0.5 border border-blue-400/30">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, pledgePercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pledges List */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Individual Pledge Records ({maskedPledgesList.length})
            </h3>

            {maskedPledgesList.length === 0 ? (
              <EmptyState
                message="No active pledge commitments recorded yet."
                actionLabel="Create New Pledge"
                onAction={() => setIsAddPledgeOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">Member Name</th>
                      <th className="p-2.5">Campaign</th>
                      <th className="p-2.5">Target Date</th>
                      <th className="p-2.5 text-right">Pledged (GHS)</th>
                      <th className="p-2.5 text-right">Paid (GHS)</th>
                      <th className="p-2.5 text-right">Outstanding</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-right">Statement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {maskedPledgesList.map((pld) => {
                      const outstanding = pld.targetAmountPesewas - pld.paidAmountPesewas;
                      return (
                        <tr key={pld.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                            {pld.memberName}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{pld.campaignName}</td>
                          <td className="p-2.5 text-slate-500">{pld.targetDate || '-'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            GHS {(Number(pld.targetAmountPesewas) / 100).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            GHS {(Number(pld.paidAmountPesewas) / 100).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            GHS {(Number(outstanding > 0n ? outstanding : 0n) / 100).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                pld.status === 'FULFILLED'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                              }`}
                            >
                              {pld.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => {
                                const mem = members.find((m) => m.id === pld.memberId);
                                if (mem) {
                                  handleOpenMemberStatement(mem);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium transition"
                              title="Generate Member Giving Statement"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Statement</span>
                            </button>
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

      {/* ADD MEMBER MODAL */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>Register New Member</span>
              </h3>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Boateng"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Envelope No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 095"
                    value={newEnvelopeNo}
                    onChange={(e) => setNewEnvelopeNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+233 24 000 0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Family Group</label>
                  <input
                    type="text"
                    placeholder="e.g. Boateng Family"
                    value={newFamily}
                    onChange={(e) => setNewFamily(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="Men Fellowship">Men Fellowship</option>
                    <option value="Women Ministry">Women Ministry</option>
                    <option value="Youth">Youth Ministry</option>
                    <option value="Choir">Music & Choir</option>
                    <option value="Ushers">Ushering Department</option>
                    <option value="Deacon Board">Deacon Board</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PLEDGE MODAL */}
      {isAddPledgeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Record New Building Pledge</span>
              </h3>
              <button
                onClick={() => setIsAddPledgeOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPledge} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Select Member</label>
                <select
                  value={pledgeMemberId}
                  onChange={(e) => setPledgeMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.memberNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Campaign Project</label>
                <input
                  type="text"
                  value={pledgeCampaign}
                  onChange={(e) => setPledgeCampaign(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Target Pledge Amount (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={pledgeTargetAmtGhs}
                  onChange={(e) => setPledgeTargetAmtGhs(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPledgeOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                >
                  Record Pledge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE RECEIPT MODAL */}
      <PrintableReceiptModal
        receipt={activeReceipt}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />

      {/* MEMBER GIVING STATEMENT MODAL */}
      <MemberStatementModal
        statement={selectedStatement}
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
      />
    </div>
  );
};
