import React, { useState } from 'react';
import { useGiving } from '../../context/GivingContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { StatusDot } from '../ui/StatusDot.js';
import { MemberStatementModal } from './MemberStatementModal.js';
import { formatDate, defaultChurchSettings } from '../../config/churchSettings.js';
import { Printer } from 'lucide-react';
import type { MemberGivingRecord, MemberGivingStatement } from '@church/domain';
import { generateMemberGivingStatement } from '@church/domain';

export interface MemberDetailPageProps {
  id: string;
}

export const MemberDetailPage: React.FC<MemberDetailPageProps> = ({ id }) => {
  const { members, givingRecords, pledges } = useGiving();
  const { currentUser } = useAuth();
  const { navigate, goBack } = useRouter();

  const [statement, setStatement] = useState<MemberGivingStatement | null>(null);

  const member = members.find((m) => m.id === id || m.memberNumber === id);

  if (!member) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'People', onClick: () => navigate('#/giving') },
            { label: 'Members', onClick: () => navigate('#/giving') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('giving')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Member <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('giving')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Member Directory
          </button>
        </div>
      </div>
    );
  }

  // Calculate Member's Giving History & Totals
  const memberRecords: MemberGivingRecord[] = givingRecords.filter((r) => r.memberId === member.id);
  const totalGivenPesewas = memberRecords.reduce((sum: bigint, r: MemberGivingRecord) => sum + r.amountPesewas, 0n);

  const memberPledges = pledges.filter((p) => p.memberId === member.id);

  const handleOpenStatement = () => {
    const stmt = generateMemberGivingStatement({
      member,
      records: givingRecords,
      pledges,
      periodStart: `${new Date().getFullYear()}-01-01`,
      periodEnd: `${new Date().getFullYear()}-12-31`,
      requestingRole: currentUser?.role || 'Admin',
      certifyingOfficer: currentUser?.fullName || 'Financial Secretary',
      certifyingOfficerRole: currentUser?.role || 'Finance Secretary',
      churchName: defaultChurchSettings.churchName,
      branchName: defaultChurchSettings.branchName,
    });
    setStatement(stmt);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <PageBreadcrumb
        items={[
          { label: 'Members', onClick: () => navigate('#/giving') },
          { label: `${member.memberNumber} · ${member.fullName}` },
        ]}
        currentId={member.id}
        listKey="members"
        onBack={() => goBack('giving')}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenStatement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Statement</span>
            </button>
          </div>
        }
      />

      {/* Main Member Profile Container */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        {/* Header Block */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--surface-border)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-center text-[var(--accent)] text-[18px] font-bold">
              {member.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-semibold text-[20px] text-[var(--text-primary)]">
                  {member.fullName}
                </h1>
                <StatusDot
                  status={member.status === 'ACTIVE' ? 'healthy' : 'inactive'}
                  label={member.status}
                />
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                Member ID: <strong className="text-[var(--text-primary)]">{member.memberNumber}</strong> · Envelope: {member.envelopeNumber || 'Unassigned'} · Joined: {formatDate(member.joinDate)}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[12px] text-[var(--text-muted)] block">YTD Contributions</span>
            <MoneyCell amountPesewas={totalGivenPesewas} size="xl" align="right" />
          </div>
        </div>

        {/* Contact & Demographics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[13px]">
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Phone Number</span>
            <span className="font-medium text-[var(--text-primary)]">{member.phone || '—'}</span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Email Address</span>
            <span className="font-medium text-[var(--text-primary)]">{member.email || '—'}</span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Ministry Department</span>
            <span className="font-medium text-[var(--text-primary)]">{member.department || 'General Congregation'}</span>
          </div>
        </div>

        {/* Giving History Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              Contribution & Giving History
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">
              {memberRecords.length} recorded gifts
            </span>
          </div>

          <div className="overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Receipt / Ref</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] font-sans">
                {memberRecords.length > 0 ? (
                  memberRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--surface-subtle)]/40 transition">
                      <td className="py-2.5 px-3 text-[13px]">{formatDate(r.serviceDate)}</td>
                      <td className="py-2.5 px-3 text-[13px] font-sans tabular-nums text-[var(--text-secondary)]">
                        {r.receiptNumber}
                      </td>
                      <td className="py-2.5 px-3 text-[13px]">{r.category}</td>
                      <td className="py-2.5 px-3 text-[13px] text-[var(--text-secondary)]">{r.paymentMethod}</td>
                      <td className="py-2.5 px-3 text-right">
                        <MoneyCell amountPesewas={r.amountPesewas} align="right" size="sm" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[13px] text-[var(--text-muted)] italic">
                      No giving transactions recorded yet for this member.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pledges Section */}
        {memberPledges.length > 0 && (
          <div className="pt-4 border-t border-[var(--surface-border-subtle)] space-y-3">
            <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
              Building & Special Project Pledges
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {memberPledges.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] space-y-2 text-[13px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {p.campaignName}
                    </span>
                    <span className="font-sans tabular-nums text-[12px] text-[var(--text-muted)]">
                      Status: {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[14px] pt-1">
                    <span>
                      Pledged: <MoneyCell amountPesewas={p.targetAmountPesewas} size="sm" />
                    </span>
                    <span>
                      Paid: <MoneyCell amountPesewas={p.paidAmountPesewas} size="sm" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Statement Modal */}
      {statement && (
        <MemberStatementModal
          statement={statement}
          isOpen={Boolean(statement)}
          onClose={() => setStatement(null)}
        />
      )}
    </div>
  );
};
