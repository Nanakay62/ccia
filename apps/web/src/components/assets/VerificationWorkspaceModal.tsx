import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Move,
  XCircle,
  Plus,
  Printer,
  FileCheck2,
  RotateCcw,
  Camera,
  Layers,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { formatDate } from '../../config/churchSettings.js';
import { formatPesewas } from '../../utils/formatters.js';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';
import type {
  AssetVerification,
  AssetVerificationLine,
  FixedAssetCondition,
  AssetVerificationSignoff,
} from '@church/domain';

interface VerificationWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationId: string | null;
}

export const VerificationWorkspaceModal: React.FC<VerificationWorkspaceModalProps> = ({
  isOpen,
  onClose,
  verificationId,
}) => {
  useModalEscape(isOpen, onClose);
  const {
    verifications,
    assets,
    categories,
    updateVerificationLine,
    addUnrecordedAsset,
    signAndCompleteVerification,
  } = useFixedAssets();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const verification: AssetVerification | undefined = verifications.find(
    (v) => v.id === verificationId
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING' | 'FOUND' | 'MOVED' | 'DAMAGED' | 'MISSING' | 'UNRECORDED'
  >('ALL');

  // Sub-modal states
  const [showUnrecordedModal, setShowUnrecordedModal] = useState(false);
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  // Moving an asset prompt state
  const [editingMoveLine, setEditingMoveLine] = useState<AssetVerificationLine | null>(null);
  const [moveActualLocation, setMoveActualLocation] = useState('');
  const [moveActualCustodian, setMoveActualCustodian] = useState('');
  const [moveNotes, setMoveNotes] = useState('');

  // Damaged asset prompt state
  const [editingDamageLine, setEditingDamageLine] = useState<AssetVerificationLine | null>(null);
  const [damageCondition, setDamageCondition] = useState<FixedAssetCondition>('POOR');
  const [damageNotes, setDamageNotes] = useState('');

  // Add Unrecorded Asset form state
  const [unrecDescription, setUnrecDescription] = useState('');
  const [unrecCategory, setUnrecCategory] = useState(categories[0]?.name || 'Equipment & Machinery');
  const [unrecLocation, setUnrecLocation] = useState('');
  const [unrecCustodian, setUnrecCustodian] = useState('');
  const [unrecCondition, setUnrecCondition] = useState<FixedAssetCondition>('GOOD');
  const [unrecNotes, setUnrecNotes] = useState('');

  // Dual Sign-off form state
  const [verifierName, setVerifierName] = useState(currentUser?.fullName || 'Kwame Mensah');
  const [verifierRole, setVerifierRole] = useState(currentUser?.role || 'Finance Secretary');
  const [officerName, setOfficerName] = useState('David Boateng');
  const [officerRole, setOfficerRole] = useState<'Treasurer' | 'Pastor / Elder'>('Treasurer');
  const [signoffNotes, setSignoffNotes] = useState('');
  const [autoApplyExceptions, setAutoApplyExceptions] = useState(true);
  const [signoffError, setSignoffError] = useState<string | null>(null);

  // Distinct locations from register
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.location))).filter(Boolean).sort();
  }, [assets]);

  // Distinct custodians from register
  const uniqueCustodians = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.custodian))).filter(Boolean).sort();
  }, [assets]);

  // Filtered lines
  const filteredLines = useMemo(() => {
    if (!verification) return [];
    let list = verification.lines;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // Support scanning barcodes like church://assets/AST-0001
      const cleanQ = q.replace(/^church:\/\/assets\//, '');
      list = list.filter(
        (l) =>
          l.assetNumber.toLowerCase().includes(cleanQ) ||
          l.description.toLowerCase().includes(q) ||
          l.categoryName.toLowerCase().includes(q) ||
          l.expectedLocation.toLowerCase().includes(q) ||
          (l.actualLocation && l.actualLocation.toLowerCase().includes(q))
      );
    }

    if (statusFilter === 'PENDING') {
      list = list.filter((l) => l.status === 'PENDING');
    } else if (statusFilter === 'FOUND') {
      list = list.filter((l) => l.status === 'FOUND');
    } else if (statusFilter === 'MOVED') {
      list = list.filter((l) => l.status === 'MOVED');
    } else if (statusFilter === 'DAMAGED') {
      list = list.filter((l) => l.status === 'DAMAGED');
    } else if (statusFilter === 'MISSING') {
      list = list.filter((l) => l.status === 'MISSING');
    } else if (statusFilter === 'UNRECORDED') {
      list = list.filter((l) => l.isUnrecordedFound);
    }

    return list;
  }, [verification, searchQuery, statusFilter]);

  if (!isOpen || !verification) return null;

  const isCompleted = verification.status === 'COMPLETED';

  // Metrics
  const totalVerified =
    verification.foundCount +
    verification.movedCount +
    verification.damagedCount +
    verification.missingCount;
  const progressPercent =
    verification.totalExpectedAssets > 0
      ? Math.round((totalVerified / verification.totalExpectedAssets) * 100)
      : 100;

  // Aggregate missing NBV
  const missingNbvPesewas = verification.lines
    .filter((l) => l.status === 'MISSING')
    .reduce((sum, l) => sum + l.netBookValuePesewas, 0n);

  // Barcode search handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isCompleted) return;

    const cleanQ = searchQuery.trim().replace(/^church:\/\/assets\//, '').toLowerCase();
    const matchedLine = verification.lines.find(
      (l) => l.assetNumber.toLowerCase() === cleanQ
    );

    if (matchedLine) {
      if (matchedLine.status === 'PENDING') {
        updateVerificationLine(verification.id, matchedLine.id, {
          status: 'FOUND',
          notes: 'Scanned via barcode/tag scanner',
        });
        showToast(`Asset ${matchedLine.assetNumber} marked as FOUND`, 'success');
      } else {
        showToast(
          `Asset ${matchedLine.assetNumber} is already marked as ${matchedLine.status}`,
          'neutral'
        );
      }
      setSearchQuery('');
    } else {
      showToast(`Asset tag "${cleanQ}" not found in current verification scope`, 'error');
    }
  };

  // Quick action: Mark Found
  const handleMarkFound = (line: AssetVerificationLine) => {
    updateVerificationLine(verification.id, line.id, {
      status: 'FOUND',
      actualLocation: line.expectedLocation,
      actualCustodian: line.expectedCustodian,
    });
    showToast(`${line.assetNumber} marked as Found`, 'success');
  };

  // Quick action: Open Move prompt
  const handleOpenMove = (line: AssetVerificationLine) => {
    setEditingMoveLine(line);
    setMoveActualLocation(line.actualLocation || line.expectedLocation);
    setMoveActualCustodian(line.actualCustodian || line.expectedCustodian);
    setMoveNotes(line.notes || '');
  };

  const handleSaveMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMoveLine) return;

    updateVerificationLine(verification.id, editingMoveLine.id, {
      status: 'MOVED',
      actualLocation: moveActualLocation.trim(),
      actualCustodian: moveActualCustodian.trim(),
      notes: moveNotes.trim() || `Relocated from ${editingMoveLine.expectedLocation} to ${moveActualLocation.trim()}`,
    });

    showToast(`${editingMoveLine.assetNumber} marked as Relocated / Moved`, 'success');
    setEditingMoveLine(null);
  };

  // Quick action: Open Damaged prompt
  const handleOpenDamage = (line: AssetVerificationLine) => {
    setEditingDamageLine(line);
    setDamageCondition(line.condition || 'POOR');
    setDamageNotes(line.notes || '');
  };

  const handleSaveDamage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDamageLine) return;

    updateVerificationLine(verification.id, editingDamageLine.id, {
      status: 'DAMAGED',
      condition: damageCondition,
      notes: damageNotes.trim() || `Condition assessed as ${damageCondition}`,
    });

    showToast(`${editingDamageLine.assetNumber} marked as Damaged`, 'success');
    setEditingDamageLine(null);
  };

  // Quick action: Mark Missing
  const handleMarkMissing = (line: AssetVerificationLine) => {
    updateVerificationLine(verification.id, line.id, {
      status: 'MISSING',
      notes: 'Asset not located during physical inspection',
    });
    showToast(`${line.assetNumber} flagged as Missing`, 'neutral');
  };

  // Quick action: Reset to Pending
  const handleReset = (line: AssetVerificationLine) => {
    updateVerificationLine(verification.id, line.id, {
      status: 'PENDING',
      notes: undefined,
    });
    showToast(`${line.assetNumber} reset to Pending`, 'neutral');
  };

  // Handle Add Unrecorded Asset Submit
  const handleAddUnrecordedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unrecDescription.trim() || !unrecLocation.trim()) return;

    addUnrecordedAsset(verification.id, {
      description: unrecDescription.trim(),
      categoryName: unrecCategory,
      actualLocation: unrecLocation.trim(),
      actualCustodian: unrecCustodian.trim() || 'General Church',
      condition: unrecCondition,
      notes: unrecNotes.trim() || 'Found on premises during verification; not in asset register',
    });

    showToast('Unrecorded asset logged with temporary tag', 'success');
    setShowUnrecordedModal(false);
    setUnrecDescription('');
    setUnrecLocation('');
    setUnrecCustodian('');
    setUnrecNotes('');
  };

  // Handle Dual Sign-off Submit
  const handleSignoffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSignoffError(null);

    const signoff: AssetVerificationSignoff = {
      verifierName: verifierName.trim(),
      verifierRole: verifierRole.trim(),
      verifierSignedAt: new Date().toISOString(),
      officerName: officerName.trim(),
      officerRole,
      officerSignedAt: new Date().toISOString(),
      notes: signoffNotes.trim() || undefined,
    };

    const res = signAndCompleteVerification(verification.id, signoff, autoApplyExceptions);
    if (!res.success) {
      setSignoffError(res.error || 'Failed to complete verification run');
      return;
    }

    showToast(
      `Verification ${verification.verificationNumber} completed with dual sign-off!`,
      'success'
    );
    setShowSignoffModal(false);
  };

  // Render Printable View Mode
  if (showPrintView) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
        <div className="bg-white text-slate-900 rounded-[var(--radius)] max-w-4xl w-full p-8 shadow-2xl relative my-8 print:m-0 print:p-0 print:shadow-none print:w-full border border-[var(--surface-border)]">
          {/* Print Toolbar */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--surface-border)] print:hidden">
            <div className="flex items-center gap-2 text-[#1e4620] font-semibold text-sm">
              <Printer className="w-5 h-5" />
              <span>Official Asset Verification Report</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e4620] text-white rounded text-xs font-semibold hover:bg-[#163518] transition shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintView(false)}
                className="px-3 py-1.5 border border-[var(--surface-border)] text-[var(--text-secondary)] rounded text-xs hover:bg-[var(--surface-hover)]"
              >
                Back to Workspace
              </button>
            </div>
          </div>

          {/* Letterhead */}
          <ChurchLetterhead
            documentTitle="FIXED ASSET PHYSICAL VERIFICATION REPORT"
            documentNumber={verification.verificationNumber}
            documentDate={verification.completedDate || verification.startDate}
            periodText={`Scope: ${verification.scope} ${verification.scopeValue ? `(${verification.scopeValue})` : ''}`}
          />

          {/* Verification Scope & Status Info */}
          <div className="grid grid-cols-2 gap-4 my-6 text-xs bg-slate-50 p-4 rounded border border-slate-200">
            <div>
              <p className="text-slate-500 font-medium">Audit Title:</p>
              <p className="font-semibold text-slate-900 text-sm">{verification.title}</p>
              <p className="text-slate-500 font-medium mt-2">Audit Scope:</p>
              <p className="font-medium text-slate-800">
                {verification.scope === 'ALL' && 'Entire Church Register'}
                {verification.scope === 'LOCATION' && `Physical Location: ${verification.scopeValue}`}
                {verification.scope === 'CUSTODIAN' && `Department / Custodian: ${verification.scopeValue}`}
                {verification.scope === 'CATEGORY' && `Asset Category: ${verification.scopeValue}`}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Inspection Period:</p>
              <p className="font-medium text-slate-800">
                {formatDate(verification.startDate)} —{' '}
                {verification.completedDate ? formatDate(verification.completedDate) : 'In Progress'}
              </p>
              <p className="text-slate-500 font-medium mt-2">Verification Status:</p>
              <p className="font-semibold text-slate-800">
                {verification.status === 'COMPLETED' ? 'COMPLETED & DUAL SIGNED' : 'IN PROGRESS'}
              </p>
            </div>
          </div>

          {/* Discrepancy Summary Box (Section 3.8) */}
          <div className="mb-6 border border-slate-200 rounded overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-800">
              PHYSICAL VERIFICATION DISCREPANCY SUMMARY
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 p-3 text-xs text-center bg-white">
              <div className="p-2">
                <div className="text-slate-500 text-[11px]">Found & In Place</div>
                <div className="text-sm font-semibold text-slate-900 font-mono mt-0.5">
                  {verification.foundCount} items
                </div>
              </div>
              <div className="p-2">
                <div className="text-slate-500 text-[11px]">Relocated / Moved</div>
                <div className="text-sm font-semibold text-amber-700 font-mono mt-0.5">
                  {verification.movedCount} items
                </div>
              </div>
              <div className="p-2">
                <div className="text-slate-500 text-[11px]">Damaged / Defective</div>
                <div className="text-sm font-semibold text-rose-700 font-mono mt-0.5">
                  {verification.damagedCount} items
                </div>
              </div>
              <div className="p-2">
                <div className="text-slate-500 text-[11px]">Missing Assets</div>
                <div className="text-sm font-semibold text-red-700 font-mono mt-0.5">
                  {verification.missingCount} items ({formatPesewas(missingNbvPesewas)})
                </div>
              </div>
            </div>
            {verification.unrecordedFoundCount > 0 && (
              <div className="bg-amber-50/60 px-4 py-2 text-xs border-t border-slate-200 text-amber-900 flex items-center justify-between">
                <span>Unrecorded equipment discovered on premises:</span>
                <span className="font-semibold font-mono">{verification.unrecordedFoundCount} items</span>
              </div>
            )}
          </div>

          {/* Full Itemized Verification Table */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
              Itemized Inspection Findings
            </div>
            <table className="w-full text-[11px] border border-slate-200 text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="p-2 border-r border-slate-200">Asset Tag</th>
                  <th className="p-2 border-r border-slate-200">Description</th>
                  <th className="p-2 border-r border-slate-200">Expected Location</th>
                  <th className="p-2 border-r border-slate-200">Actual Location</th>
                  <th className="p-2 border-r border-slate-200 text-right">Book Value</th>
                  <th className="p-2 border-r border-slate-200 text-center">Status</th>
                  <th className="p-2">Condition & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {verification.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/50">
                    <td className="p-2 font-mono border-r border-slate-200 font-medium">
                      {line.assetNumber}
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="font-medium text-slate-900">{line.description}</div>
                      <div className="text-[10px] text-slate-500">{line.categoryName}</div>
                    </td>
                    <td className="p-2 border-r border-slate-200 text-slate-600">
                      {line.expectedLocation}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-slate-900">
                      {line.actualLocation || line.expectedLocation}
                    </td>
                    <td className="p-2 font-mono text-right border-r border-slate-200">
                      {formatPesewas(line.netBookValuePesewas)}
                    </td>
                    <td className="p-2 text-center border-r border-slate-200 font-semibold text-[10px]">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded ${
                          line.status === 'FOUND'
                            ? 'bg-emerald-100 text-emerald-800'
                            : line.status === 'MOVED'
                            ? 'bg-amber-100 text-amber-800'
                            : line.status === 'DAMAGED'
                            ? 'bg-rose-100 text-rose-800'
                            : line.status === 'MISSING'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {line.status}
                      </span>
                    </td>
                    <td className="p-2 text-slate-600 text-[10px]">
                      {line.condition ? `[${line.condition}] ` : ''}
                      {line.notes || 'Verified on site'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dual Signatures */}
          <div className="my-6">
            <DualSignatureBlock
              preparedBy={{
                label: 'Physical Verifier',
                name: verification.signoff?.verifierName || verifierName,
                role: verification.signoff?.verifierRole || verifierRole,
                date: verification.signoff?.verifierSignedAt
                  ? formatDate(verification.signoff.verifierSignedAt.slice(0, 10))
                  : formatDate(new Date().toISOString().slice(0, 10)),
                isSigned: Boolean(verification.signoff?.verifierSignedAt),
              }}
              approvedBy={{
                label: 'Authorizing Officer',
                name: verification.signoff?.officerName || officerName,
                role: verification.signoff?.officerRole || officerRole,
                date: verification.signoff?.officerSignedAt
                  ? formatDate(verification.signoff.officerSignedAt.slice(0, 10))
                  : formatDate(new Date().toISOString().slice(0, 10)),
                isSigned: Boolean(verification.signoff?.officerSignedAt),
              }}
              notes={verification.signoff?.notes}
            />
          </div>

          {/* Board Resolution Block (Section 3.8) */}
          <div className="mt-8 pt-4 border-t-2 border-slate-300 text-xs text-slate-700 space-y-2">
            <div className="font-semibold text-slate-900 uppercase">Church Board Resolution:</div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              At the meeting of the Church Board held on _____ / _____ / 20____, the findings of this
              Physical Verification were formally reviewed.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="border border-slate-300 p-2 rounded text-[11px]">
                <label className="flex items-center gap-2 font-medium text-slate-800">
                  <input type="checkbox" disabled />
                  <span>Approved as presented; sub-ledger updated</span>
                </label>
              </div>
              <div className="border border-slate-300 p-2 rounded text-[11px]">
                <label className="flex items-center gap-2 font-medium text-slate-800">
                  <input type="checkbox" disabled />
                  <span>Investigation ordered for missing assets</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 text-[11px] text-slate-500">
              <div>Minute Reference: _________________________</div>
              <div>Board Secretary Signature: _________________________</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-title"
      >
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-[#1e4620]" />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="workspace-title" className="text-sm font-semibold text-[var(--text-primary)]">
                  {verification.verificationNumber}: {verification.title}
                </h2>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {isCompleted ? 'Completed & Signed' : 'In Progress (Active Scan)'}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                <span>
                  Scope:{' '}
                  <strong>
                    {verification.scope === 'ALL'
                      ? 'Entire Church'
                      : `${verification.scope}: ${verification.scopeValue}`}
                  </strong>
                </span>
                <span>•</span>
                <span>Started: {formatDate(verification.startDate)}</span>
                {verification.completedDate && (
                  <>
                    <span>•</span>
                    <span>Completed: {formatDate(verification.completedDate)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintView(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition"
              title="Print official board report"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print Report</span>
            </button>

            {!isCompleted && (
              <>
                <button
                  type="button"
                  onClick={() => setShowUnrecordedModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition"
                  title="Log item discovered on site"
                >
                  <Plus className="w-4 h-4 text-[#1e4620]" />
                  <span className="hidden sm:inline">+ Unrecorded Asset</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSignoffModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Dual Sign-off & Finalize</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded ml-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Metrics Strip (Neutral numbers, standard polish) */}
        <div className="px-5 py-3 border-b border-[var(--surface-border)] bg-[var(--surface-card)] text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Expected: <strong className="text-[var(--text-primary)] font-mono">{verification.totalExpectedAssets}</strong>
            </span>
            <span>·</span>
            <span>
              Verified:{' '}
              <strong className="text-[var(--text-primary)] font-mono">
                {totalVerified} / {verification.totalExpectedAssets} ({progressPercent}%)
              </strong>
            </span>
            <span>·</span>
            <span className="text-emerald-700">
              Found: <strong className="font-mono">{verification.foundCount}</strong>
            </span>
            <span>·</span>
            <span className="text-amber-700">
              Moved: <strong className="font-mono">{verification.movedCount}</strong>
            </span>
            <span>·</span>
            <span className="text-rose-700">
              Damaged: <strong className="font-mono">{verification.damagedCount}</strong>
            </span>
            <span>·</span>
            <span className="text-red-700">
              Missing: <strong className="font-mono">{verification.missingCount}</strong>
            </span>
            {verification.unrecordedFoundCount > 0 && (
              <>
                <span>·</span>
                <span className="text-purple-700">
                  Unrecorded Found: <strong className="font-mono">{verification.unrecordedFoundCount}</strong>
                </span>
              </>
            )}
          </div>

          {verification.signoff && (
            <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Dual Signed by {verification.signoff.verifierName} & {verification.signoff.officerName}
              </span>
            </div>
          )}
        </div>

        {/* Scanner Bar & Filter Tabs */}
        <div className="px-5 py-3 border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] space-y-3">
          {/* Scanner Input */}
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                <Camera className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Scan barcode or type asset tag (e.g. AST-0001 or church://assets/AST-0001) and press Enter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isCompleted}
                className="w-full pl-9 pr-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>
            {!isCompleted && (
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition"
              >
                Find & Check
              </button>
            )}
          </form>

          {/* Underline Subtabs */}
          <div className="flex items-center gap-4 text-xs font-medium border-b border-[var(--surface-border)]">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`pb-2 border-b-2 transition ${
                statusFilter === 'ALL'
                  ? 'border-[#1e4620] text-[#1e4620]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All Assets ({verification.lines.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`pb-2 border-b-2 transition ${
                statusFilter === 'PENDING'
                  ? 'border-[#1e4620] text-[#1e4620]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Pending ({verification.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('FOUND')}
              className={`pb-2 border-b-2 transition ${
                statusFilter === 'FOUND'
                  ? 'border-[#1e4620] text-[#1e4620]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Found ({verification.foundCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('MOVED')}
              className={`pb-2 border-b-2 transition ${
                statusFilter === 'MOVED'
                  ? 'border-[#1e4620] text-[#1e4620]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Moved ({verification.movedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DAMAGED')}
              className={`pb-2 border-b-2 transition ${
                statusFilter === 'DAMAGED'
                  ? 'border-[#1e4620] text-[#1e4620]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Damaged ({verification.damagedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('MISSING')}
              className={`pb-2 border-b-2 transition ${
                statusFilter === 'MISSING'
                  ? 'border-[#1e4620] text-[#1e4620]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Missing ({verification.missingCount})
            </button>
            {verification.unrecordedFoundCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('UNRECORDED')}
                className={`pb-2 border-b-2 transition ${
                  statusFilter === 'UNRECORDED'
                    ? 'border-[#1e4620] text-[#1e4620]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Unrecorded ({verification.unrecordedFoundCount})
              </button>
            )}
          </div>
        </div>

        {/* Table of Verification Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredLines.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-1">
              <p>No asset items match the current search or status filter.</p>
            </div>
          ) : (
            <div className="border border-[var(--surface-border)] rounded overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[var(--text-secondary)] uppercase text-[11px] font-semibold sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2.5">Tag</th>
                    <th className="px-3.5 py-2.5">Description</th>
                    <th className="px-3.5 py-2.5">Expected Location</th>
                    <th className="px-3.5 py-2.5">Actual Location</th>
                    <th className="px-3.5 py-2.5 text-right">Book Value</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                    <th className="px-3.5 py-2.5">Notes / Details</th>
                    {!isCompleted && <th className="px-3.5 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {filteredLines.map((line) => {
                    const isUnrec = line.isUnrecordedFound;
                    return (
                      <tr
                        key={line.id}
                        className={`hover:bg-[var(--surface-hover)] transition ${
                          line.status === 'FOUND'
                            ? 'bg-emerald-50/20'
                            : line.status === 'MOVED'
                            ? 'bg-amber-50/20'
                            : line.status === 'DAMAGED'
                            ? 'bg-rose-50/20'
                            : line.status === 'MISSING'
                            ? 'bg-red-50/20'
                            : ''
                        }`}
                      >
                        <td className="px-3.5 py-2.5 font-mono text-[var(--text-primary)] font-medium">
                          {line.assetNumber}
                          {isUnrec && (
                            <span className="block text-[10px] text-purple-600 font-sans font-normal">
                              Unrecorded
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-[var(--text-primary)]">
                            {line.description}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {line.categoryName}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--text-secondary)]">
                          <div>{line.expectedLocation}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {line.expectedCustodian}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--text-primary)]">
                          {line.actualLocation ? (
                            <div>
                              <span
                                className={
                                  line.actualLocation !== line.expectedLocation
                                    ? 'text-amber-700 font-medium'
                                    : ''
                                }
                              >
                                {line.actualLocation}
                              </span>
                              {line.actualCustodian && (
                                <div className="text-[10px] text-[var(--text-muted)]">
                                  {line.actualCustodian}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)] italic">Not checked</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-right text-[var(--text-primary)]">
                          {formatPesewas(line.netBookValuePesewas)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                              line.status === 'FOUND'
                                ? 'bg-emerald-100 text-emerald-800'
                                : line.status === 'MOVED'
                                ? 'bg-amber-100 text-amber-800'
                                : line.status === 'DAMAGED'
                                ? 'bg-rose-100 text-rose-800'
                                : line.status === 'MISSING'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {line.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-[11px] text-[var(--text-secondary)] max-w-xs truncate">
                          {line.condition && (
                            <span className="font-medium text-[var(--text-primary)] mr-1">
                              [{line.condition}]
                            </span>
                          )}
                          {line.notes || '-'}
                        </td>

                        {!isCompleted && (
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {line.status === 'PENDING' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleMarkFound(line)}
                                    className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                                    title="Mark Found at correct location"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMove(line)}
                                    className="p-1 text-amber-700 hover:bg-amber-50 rounded"
                                    title="Mark Relocated / Moved"
                                  >
                                    <Move className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDamage(line)}
                                    className="p-1 text-rose-700 hover:bg-rose-50 rounded"
                                    title="Mark Damaged"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMarkMissing(line)}
                                    className="p-1 text-red-700 hover:bg-red-50 rounded"
                                    title="Mark Missing"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReset(line)}
                                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--surface-subtle)]"
                                  title="Reset to Pending"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Relocate Asset Dialog */}
      {editingMoveLine && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Relocate Asset: {editingMoveLine.assetNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingMoveLine(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMove} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  New Actual Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="locations-list"
                  value={moveActualLocation}
                  onChange={(e) => setMoveActualLocation(e.target.value)}
                  placeholder="e.g. Media Room or Children's Block"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
                <datalist id="locations-list">
                  {uniqueLocations.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Actual Custodian
                </label>
                <input
                  type="text"
                  list="custodians-list"
                  value={moveActualCustodian}
                  onChange={(e) => setMoveActualCustodian(e.target.value)}
                  placeholder="e.g. Head of Media"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
                <datalist id="custodians-list">
                  {uniqueCustodians.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows={2}
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="e.g. Permanently shifted to Media Room for live broadcast setup"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setEditingMoveLine(null)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1e4620] text-white rounded font-medium hover:bg-[#163518] transition"
                >
                  Confirm Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Damaged Asset Dialog */}
      {editingDamageLine && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Report Damage: {editingDamageLine.assetNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDamageLine(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDamage} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Assessed Condition <span className="text-red-500">*</span>
                </label>
                <select
                  value={damageCondition}
                  onChange={(e) => setDamageCondition(e.target.value as FixedAssetCondition)}
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                >
                  <option value="FAIR">FAIR - Operable with wear</option>
                  <option value="POOR">POOR - Needs repair / malfunctioning</option>
                  <option value="DAMAGED">DAMAGED - Inoperable / Severe fault</option>
                  <option value="SCRAP">SCRAP - Unusable / Beyond repair</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Damage Details / Defect Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="e.g. Diaphragm blown, noisy buzz during service, housing cracked"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setEditingDamageLine(null)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-700 text-white rounded font-medium hover:bg-rose-800 transition"
                >
                  Log Damage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unrecorded Asset Modal */}
      {showUnrecordedModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Add Unrecorded Equipment Found on Premises
              </h3>
              <button
                type="button"
                onClick={() => setShowUnrecordedModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUnrecordedSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Item Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yamaha MG16XU Audio Mixer or Sony Handycam"
                  value={unrecDescription}
                  onChange={(e) => setUnrecDescription(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--text-primary)] mb-1">
                    Category
                  </label>
                  <select
                    value={unrecCategory}
                    onChange={(e) => setUnrecCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                  >
                    {categories.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[var(--text-primary)] mb-1">
                    Condition
                  </label>
                  <select
                    value={unrecCondition}
                    onChange={(e) => setUnrecCondition(e.target.value as FixedAssetCondition)}
                    className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                  >
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="GOOD">GOOD</option>
                    <option value="FAIR">FAIR</option>
                    <option value="POOR">POOR</option>
                    <option value="SCRAP">SCRAP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--text-primary)] mb-1">
                    Found Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="unrec-locs"
                    placeholder="e.g. Youth Hall Storage"
                    value={unrecLocation}
                    onChange={(e) => setUnrecLocation(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                  />
                  <datalist id="unrec-locs">
                    {uniqueLocations.map((l) => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-medium text-[var(--text-primary)] mb-1">
                    Actual Custodian
                  </label>
                  <input
                    type="text"
                    list="unrec-cust"
                    placeholder="e.g. Youth Pastor"
                    value={unrecCustodian}
                    onChange={(e) => setUnrecCustodian(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                  />
                  <datalist id="unrec-cust">
                    {uniqueCustodians.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Observations / Serial Number
                </label>
                <textarea
                  rows={2}
                  value={unrecNotes}
                  onChange={(e) => setUnrecNotes(e.target.value)}
                  placeholder="e.g. S/N: YAM-2024-884, found in rack during stage audit"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setShowUnrecordedModal(false)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1e4620] text-white rounded font-medium hover:bg-[#163518] transition"
                >
                  Save Unrecorded Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dual Sign-off & Finalize Modal */}
      {showSignoffModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1e4620]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Dual Sign-off & Verification Completion
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignoffModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {signoffError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {signoffError}
              </div>
            )}

            {/* Summary of findings */}
            <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded text-xs space-y-1.5">
              <div className="font-semibold text-[var(--text-primary)]">
                Verification Findings Summary:
              </div>
              <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)]">
                <div>Total Scope: <strong className="font-mono text-[var(--text-primary)]">{verification.totalExpectedAssets}</strong></div>
                <div>Found in Place: <strong className="font-mono text-emerald-700">{verification.foundCount}</strong></div>
                <div>Relocated: <strong className="font-mono text-amber-700">{verification.movedCount}</strong></div>
                <div>Damaged: <strong className="font-mono text-rose-700">{verification.damagedCount}</strong></div>
                <div>Missing: <strong className="font-mono text-red-700">{verification.missingCount}</strong></div>
                <div>Unrecorded Found: <strong className="font-mono text-purple-700">{verification.unrecordedFoundCount}</strong></div>
              </div>
              {verification.pendingCount > 0 && (
                <div className="pt-1.5 text-[11px] text-amber-700">
                  Note: {verification.pendingCount} unchecked items will be automatically marked as <strong>MISSING</strong> upon sign-off.
                </div>
              )}
            </div>

            <form onSubmit={handleSignoffSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-2 border-t border-[var(--surface-border)] pt-3">
                <div className="font-semibold text-[var(--text-primary)]">
                  1. Physical Verifier (Signatory 1):
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                      Verifier Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={verifierName}
                      onChange={(e) => setVerifierName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                      Role / Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={verifierRole}
                      onChange={(e) => setVerifierRole(e.target.value as any)}
                      className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-[var(--surface-border)] pt-3">
                <div className="font-semibold text-[var(--text-primary)]">
                  2. Authorizing Officer (Signatory 2 - Dual Signature Rule):
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                      Officer Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={officerName}
                      onChange={(e) => setOfficerName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                      Officer Office <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={officerRole}
                      onChange={(e) => setOfficerRole(e.target.value as 'Treasurer' | 'Pastor / Elder')}
                      className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                    >
                      <option value="Treasurer">Treasurer</option>
                      <option value="Pastor / Elder">Pastor / Elder</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-primary)] mb-1">
                  Concluding Remarks / Audit Observations
                </label>
                <textarea
                  rows={2}
                  value={signoffNotes}
                  onChange={(e) => setSignoffNotes(e.target.value)}
                  placeholder="e.g. Physical inventory completed for Sanctuary; 1 mixer moved, 1 microphone damaged, no unaccounted losses."
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApplyExceptions}
                    onChange={(e) => setAutoApplyExceptions(e.target.checked)}
                    className="mt-0.5 rounded text-[#1e4620] focus:ring-[#1e4620]"
                  />
                  <span className="text-[11px] text-slate-700 leading-tight">
                    <strong>Apply exceptions to Asset Register automatically</strong>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Updates asset locations for moved items, records condition & repair flags for damaged items, and flags missing items for board write-off review.
                    </span>
                  </span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setShowSignoffModal(false)}
                  className="px-3 py-1.5 border border-[var(--surface-border)] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1e4620] text-white rounded font-medium hover:bg-[#163518] transition flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Complete Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
