import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Search,
  Download,
  UserX,
  FileText,
  ShieldCheck,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useDemo } from '../../context/DemoContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { generateMemberDataDossier, anonymiseFormerMember } from '@church/domain';
import type { MemberProfile, MemberAccessAuditEntry } from '@church/domain';

export const MemberDataRequestPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { demoDataset } = useDemo();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [members, setMembers] = useState<any[]>(() => [...(demoDataset?.members || [])]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(demoDataset?.members?.[0]?.id || 'mem-001');
  const [searchQuery, setSearchQuery] = useState('');

  // Anonymise modal state
  const [isAnonymiseModalOpen, setIsAnonymiseModalOpen] = useState(false);
  const [anonymiseReasonInput, setAnonymiseReasonInput] = useState('');

  // Export Dossier state
  const exportPurposeInput = 'Data subject access request under Ghana Data Protection Act';

  const selectedMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId) || members[0];
  }, [members, selectedMemberId]);

  const memberGivingRecords = useMemo(() => {
    const raw = demoDataset?.givingRecords || [];
    return raw
      .filter((g: any) => g.memberId === selectedMember?.id)
      .map((g: any) => ({
        id: g.id,
        branchId: '00000000-0000-0000-0000-000000000001',
        memberId: g.memberId,
        memberName: selectedMember?.fullName || 'Member',
        serviceDate: g.date || '2026-10-18',
        fundId: g.fundId || 'fund-gen',
        fundName: g.fundName || 'General Fund',
        category: 'Tithe' as const,
        paymentMethod: (g.method || 'MOMO') as any,
        currency: 'GHS' as const,
        amountPesewas: BigInt(g.amountPesewas || 50000),
        receiptNumber: `REC-${g.id.slice(-5)}`,
        createdAt: '2026-10-18T10:00:00Z',
      }));
  }, [demoDataset, selectedMember]);

  const sampleAccessAudit: MemberAccessAuditEntry[] = [
    {
      id: 'acc-log-1',
      timestamp: '2026-11-04T14:20:00Z',
      actorUserId: 'usr-kofi',
      actorName: 'Kofi Mensah',
      actorRole: 'Treasurer',
      purpose: 'Annual giving statement generation',
      recordsViewedCount: 12,
    },
    {
      id: 'acc-log-2',
      timestamp: '2026-10-15T09:30:00Z',
      actorUserId: 'usr-sarah',
      actorName: 'Sarah Osei',
      actorRole: 'Finance Secretary',
      purpose: 'Sunday tithe batch entry & verification',
      recordsViewedCount: 1,
    },
  ];

  const filteredMembersList = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.memberNumber && m.memberNumber.toLowerCase().includes(q)) ||
        (m.envelopeNumber && m.envelopeNumber.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const handleExportDossier = () => {
    if (!selectedMember) return;

    const profile: MemberProfile = {
      id: selectedMember.id,
      fullName: selectedMember.fullName,
      memberNumber: selectedMember.memberNumber,
      envelopeNumber: selectedMember.envelopeNumber,
      phoneNumber: selectedMember.phone || '+233 24 412 3456',
      email: selectedMember.email || 'member@example.com',
      address: selectedMember.address || 'Accra, Ghana',
      status: selectedMember.fullName.includes('Anonymised') ? 'ANONYMISED' : 'ACTIVE',
    };

    const dossier = generateMemberDataDossier({
      member: profile,
      givingRecords: memberGivingRecords,
      pledges: [],
      accessAuditTrail: sampleAccessAudit,
      exportedBy: `${currentUser.fullName} (${currentUser.role})`,
      exportPurpose: exportPurposeInput.trim(),
    });

    // Trigger download
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `member_data_dossier_${selectedMember.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Complete statutory data dossier exported for ${selectedMember.fullName}`, 'success');
  };

  const handleAnonymiseMember = () => {
    if (!selectedMember || !anonymiseReasonInput.trim()) return;

    const profile: MemberProfile = {
      id: selectedMember.id,
      fullName: selectedMember.fullName,
      memberNumber: selectedMember.memberNumber,
      envelopeNumber: selectedMember.envelopeNumber,
      phoneNumber: selectedMember.phone,
      email: selectedMember.email,
      address: selectedMember.address,
      status: 'FORMER',
    };

    const result = anonymiseFormerMember({
      member: profile,
      givingRecords: memberGivingRecords,
      pledges: [],
      executedBy: `${currentUser.fullName} (${currentUser.role})`,
      reason: anonymiseReasonInput.trim(),
    });

    // Update in local members list
    setMembers((prev) =>
      prev.map((m) =>
        m.id === selectedMember.id
          ? {
              ...m,
              fullName: result.anonymisedMember.fullName,
              phone: undefined,
              email: undefined,
              address: undefined,
              status: 'ANONYMISED',
            }
          : m
      )
    );

    showToast(
      `Member records anonymised successfully. General ledger entries and fund balances remain 100% intact.`,
      'success'
    );
    setIsAnonymiseModalOpen(false);
    setAnonymiseReasonInput('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] font-medium mb-1">
            <button onClick={() => navigate('#/giving')} className="hover:text-[var(--text-primary)] transition">
              Giving &amp; Members
            </button>
            <span>/</span>
            <span>Data Privacy &amp; Subject Requests</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#1e3a2f]" />
            <span>Member Data Requests &amp; Privacy (Ghana Data Protection Act)</span>
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Export complete data dossiers and anonymise former members while strictly preserving general ledger totals (Spec Section C6).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold px-2.5 py-1 rounded-[var(--radius-sm)] bg-emerald-50 text-emerald-800 border border-emerald-200">
            Act 843 Compliant
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left Column: Member Search & Selector */}
        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Select Church Member</h2>
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, envelope..."
              className="w-full text-[13px] pl-9 pr-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-1 divide-y divide-[var(--surface-border)]">
            {filteredMembersList.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMemberId(m.id)}
                className={`w-full text-left py-2.5 px-3 rounded-[var(--radius-sm)] transition flex items-center justify-between text-[13px] ${
                  m.id === selectedMemberId
                    ? 'bg-[#1e3a2f] text-white font-semibold'
                    : 'hover:bg-[var(--surface-panel)] text-[var(--text-primary)]'
                }`}
              >
                <div>
                  <div className="font-medium">{m.fullName}</div>
                  <div className={`text-[11px] ${m.id === selectedMemberId ? 'text-emerald-100' : 'text-[var(--text-muted)]'}`}>
                    Env: {m.envelopeNumber || 'N/A'} • ID: {m.memberNumber || m.id.slice(-4)}
                  </div>
                </div>
                {m.status === 'ANONYMISED' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">Anonymised</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Member Dossier & Actions */}
        {selectedMember ? (
          <div className="md:col-span-2 space-y-4">
            {/* Member Profile Card */}
            <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--surface-border)] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">{selectedMember.fullName}</h3>
                  <div className="text-[12px] text-[var(--text-muted)] mt-0.5">
                    Member ID: {selectedMember.memberNumber || selectedMember.id} • Envelope: {selectedMember.envelopeNumber || 'None'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportDossier}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[12px] font-semibold transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Full Dossier</span>
                  </button>

                  {!selectedMember.fullName.includes('Anonymised') && (
                    <button
                      onClick={() => setIsAnonymiseModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[12px] font-semibold transition cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-600" />
                      <span>Anonymise Record</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Data Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[13px]">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Phone Number</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedMember.phone || '+233 24 412 3456'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Email</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedMember.email || 'member@example.com'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Residence / Address</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedMember.address || 'Spintex Road, Accra'}
                  </span>
                </div>
              </div>
            </div>

            {/* Giving History Section */}
            <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
              <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1e3a2f]" />
                <span>Recorded Giving History ({memberGivingRecords.length} Entries)</span>
              </h4>

              <div className="rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Fund</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3 text-right">Amount (GHS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)] tabular-nums">
                    {memberGivingRecords.map((g) => (
                      <tr key={g.id} className="hover:bg-[var(--surface-panel)]">
                        <td className="py-2 px-3">{g.serviceDate}</td>
                        <td className="py-2 px-3">{g.fundName}</td>
                        <td className="py-2 px-3">{g.paymentMethod}</td>
                        <td className="py-2 px-3 text-right font-semibold text-[var(--text-primary)]">
                          GHS {(Number(g.amountPesewas) / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Access Audit Trail Section */}
            <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
              <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Statutory Confidential Access Log (Act 843 Section 24)</span>
              </h4>
              <p className="text-[12px] text-[var(--text-muted)]">
                Permanent record of church staff who accessed this member&apos;s individual financial contributions.
              </p>

              <div className="space-y-2 text-[12px]">
                {sampleAccessAudit.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-[var(--text-primary)]">{log.actorName}</span>{' '}
                      <span className="text-[var(--text-muted)]">({log.actorRole})</span>
                      <p className="text-[11px] text-[var(--text-muted)]">Purpose: {log.purpose}</p>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)]">{log.timestamp.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ANONYMISE CONFIRMATION MODAL */}
      {isAnonymiseModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-600" />
                <span>Anonymise Former Member Records</span>
              </h3>
              <button
                onClick={() => setIsAnonymiseModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-[var(--radius-sm)] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-[12px] text-emerald-800 dark:text-emerald-200">
              <span className="font-bold flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Accounting Invariant Guarantee</span>
              </span>
              All general ledger journal entries, tithe batches, cashbook totals, and fund balances will remain <strong>100% intact and untouched</strong>. Only personal identifiers (name, phone, email, address) will be replaced with an anonymous placeholder.
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Reason for Anonymisation *
              </label>
              <textarea
                rows={3}
                required
                value={anonymiseReasonInput}
                onChange={(e) => setAnonymiseReasonInput(e.target.value)}
                placeholder="e.g. Member relocated abroad and exercised 'Right to be Forgotten' under Ghana Data Protection Act..."
                className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => setIsAnonymiseModalOpen(false)}
                className="px-3 py-1.5 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[13px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAnonymiseMember}
                disabled={!anonymiseReasonInput.trim()}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[13px] transition disabled:opacity-40"
              >
                Confirm Anonymisation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
