import React, { useState, useMemo } from 'react';
import { useGiving, getMemberDisplayName } from '../../context/GivingContext.js';
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
  type MemberGivingRecord,
  type Pledge,
} from '@church/domain';
import { PrintableReceiptModal } from './PrintableReceiptModal.js';
import { MemberStatementModal } from './MemberStatementModal.js';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { FinancialYearSelector } from '../ui/FinancialYearSelector.js';
import { EmptyState } from '../ui/EmptyState.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { formatDate, formatMoneyAmount, defaultChurchSettings } from '../../config/churchSettings.js';
import { logAuditEvent } from '../../utils/auditLogger.js';
import { useSecurityEvents } from '../../context/SecurityEventsContext.js';
import { useRouter } from '../../context/RouterContext.js';
import {
  Search,
  Plus,
  Lock,
  Download,
  Upload,
  Printer,
  X,
  AlertTriangle,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

export const GivingDirectoryView: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigate } = useRouter();
  const { funds } = useLedger();
  const {
    members,
    pledges,
    givingRecords,
    addMember,
    updateMember,
    recordGiving,
    reverseGivingRecord,
    recordPledge,
    getMaskedGivingRecords,
    getMaskedPledges,
  } = useGiving();

  const isPrivileged = canViewIndividualGiving(currentUser.role);
  const isTreasurerOrFinSec =
    currentUser.role === 'Treasurer' || currentUser.role === 'Finance Secretary';

  // Active tab: 'MEMBERS' | 'GIVING' | 'PLEDGES'
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'GIVING' | 'PLEDGES'>('MEMBERS');

  // --- MEMBERS TAB STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [showEnvelopeColumn, setShowEnvelopeColumn] = useState(false);
  const [memberPage, setMemberPage] = useState(1);
  const PAGE_SIZE = 50;

  // Masked phone reveals (logged when clicked)
  const [revealedPhones, setRevealedPhones] = useState<Set<string>>(new Set());

  // Member Detail Slide-Over Drawer
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );
  const isDrawerOpen = Boolean(selectedMemberId);

  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [isRecordGivingOpen, setIsRecordGivingOpen] = useState(false);
  const [isAddPledgeOpen, setIsAddPledgeOpen] = useState(false);
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalTargetRecord, setReversalTargetRecord] = useState<MemberGivingRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Printable modals
  const [activeReceipt, setActiveReceipt] = useState<PrintableReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<MemberGivingStatement | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  // Security & Export Logging (Spec C6)
  const { logSecurityEvent } = useSecurityEvents();
  const [isExportPurposeOpen, setIsExportPurposeOpen] = useState(false);
  const [exportTargetType, setExportTargetType] = useState<'MEMBERS' | 'GIVING' | 'PLEDGES'>('MEMBERS');
  const [exportPurposeInput, setExportPurposeInput] = useState('Annual church audit preparation');

  // Forms state
  const [newTitle, setNewTitle] = useState('Brother');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEnvelopeNo, setNewEnvelopeNo] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFamily, setNewFamily] = useState('');
  const [newDept, setNewDept] = useState('Men Fellowship');
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'DECEASED'>('ACTIVE');

  // Edit member form state
  const [editTitle, setEditTitle] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEnvelopeNo, setEditEnvelopeNo] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFamily, setEditFamily] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editStatus, setEditStatus] = useState<Member['status']>('ACTIVE');

  // Record Giving form state
  const [givingTargetMemberId, setGivingTargetMemberId] = useState<string>('mem-001');
  const [givingFundId, setGivingFundId] = useState<string>('fund-gen');
  const [givingCategory, setGivingCategory] = useState<GivingCategory>('Tithe');
  const [givingMethod, setGivingMethod] = useState<PaymentMethod>('CASH');
  const [givingCurrency] = useState<Currency>('GHS');
  const [givingAmount, setGivingAmount] = useState<string>('150.00');
  const [givingNotes, setGivingNotes] = useState<string>('');

  // Record Pledge form state
  const [pledgeTargetMemberId, setPledgeTargetMemberId] = useState<string>('mem-001');
  const [pledgeCampaign, setPledgeCampaign] = useState('Auditorium Expansion Project 2026');
  const [pledgeTargetAmtGhs, setPledgeTargetAmtGhs] = useState('5000.00');

  // Giving tab filters
  const [givingSearchTerm, setGivingSearchTerm] = useState('');
  const [givingFundFilter, setGivingFundFilter] = useState('ALL');
  const [givingCategoryFilter, setGivingCategoryFilter] = useState('ALL');
  const [givingMethodFilter, setGivingMethodFilter] = useState('ALL');

  // Pledges tab filters
  const [pledgeSearchTerm, setPledgeSearchTerm] = useState('');

  // CSV Import state
  const [importCsvText, setImportCsvText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Esc listeners
  useModalEscape(isAddMemberOpen, () => setIsAddMemberOpen(false));
  useModalEscape(isEditMemberOpen, () => setIsEditMemberOpen(false));
  useModalEscape(isImportCsvOpen, () => setIsImportCsvOpen(false));
  useModalEscape(isRecordGivingOpen, () => setIsRecordGivingOpen(false));
  useModalEscape(isAddPledgeOpen, () => setIsAddPledgeOpen(false));
  useModalEscape(isReversalModalOpen, () => setIsReversalModalOpen(false));

  // Dynamic list of family groups
  const familyGroups = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.familyGroup && m.familyGroup.trim()) {
        set.add(m.familyGroup.trim());
      }
    });
    return Array.from(set).sort();
  }, [members]);

  // Map member ID to latest gift date
  const memberLastGiftMap = useMemo(() => {
    const map = new Map<string, string>();
    givingRecords.forEach((r) => {
      if (r.memberId && !r.isReversed) {
        const existing = map.get(r.memberId);
        if (!existing || r.serviceDate > existing) {
          map.set(r.memberId, r.serviceDate);
        }
      }
    });
    return map;
  }, [givingRecords]);

  // Duplicate member warning when adding
  const duplicateWarning = useMemo(() => {
    if (!isAddMemberOpen) return null;
    const cleanPhone = newPhone.replace(/\D/g, '');
    const cleanFirst = newFirstName.trim().toLowerCase();
    const cleanLast = newLastName.trim().toLowerCase();
    const combinedName = `${cleanFirst} ${cleanLast}`.trim();

    for (const m of members) {
      if (cleanPhone.length >= 7 && m.phone) {
        const mClean = m.phone.replace(/\D/g, '');
        if (mClean.length >= 7 && (mClean.endsWith(cleanPhone) || cleanPhone.endsWith(mClean))) {
          return `A member with phone ${m.phone} already exists: ${getMemberDisplayName(m)} (${m.memberNumber})`;
        }
      }
      if (combinedName && m.fullName.toLowerCase() === combinedName) {
        return `A member named "${m.fullName}" already exists (${m.memberNumber})`;
      }
    }
    return null;
  }, [isAddMemberOpen, newPhone, newFirstName, newLastName, members]);

  // Reveal phone handler
  const handleRevealPhone = (member: Member) => {
    setRevealedPhones((prev) => new Set(prev).add(member.id));
    logAuditEvent({
      action: 'VIEW_PII',
      record: `Member ${member.memberNumber}`,
      entityType: 'MEMBER',
      entityId: member.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Revealed phone number for ${getMemberDisplayName(member)} (${member.memberNumber})`,
    });
  };

  // Open member statement
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
      churchName: defaultChurchSettings.churchName,
      branchName: defaultChurchSettings.branchName,
    });

    logAuditEvent({
      action: 'PRINT_STATEMENT',
      record: statement.statementNumber,
      entityType: 'MEMBER_STATEMENT',
      entityId: member.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Generated contribution statement for ${getMemberDisplayName(member)} (${member.memberNumber})`,
    });

    setSelectedStatement(statement);
    setIsStatementModalOpen(true);
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return members.filter((m) => {
      // Search matches on pure name without title, or member number, envelope, or family
      const matchesSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        (m.envelopeNumber && m.envelopeNumber.toLowerCase().includes(q)) ||
        (m.familyGroup && m.familyGroup.toLowerCase().includes(q));

      const matchesDept = departmentFilter === 'ALL' || m.department === departmentFilter;
      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
      const matchesFamily = familyFilter === 'ALL' || m.familyGroup === familyFilter;

      return matchesSearch && matchesDept && matchesStatus && matchesFamily;
    });
  }, [members, searchTerm, departmentFilter, statusFilter, familyFilter]);

  // Paginated members
  const paginatedMembers = useMemo(() => {
    const start = (memberPage - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, memberPage]);

  // Export CSV with Purpose Prompts & Anti-Tampering Audit Trail (Spec C6)
  const handleOpenExportModal = (target: 'MEMBERS' | 'GIVING' | 'PLEDGES') => {
    setExportTargetType(target);
    setIsExportPurposeOpen(true);
  };

  const handleConfirmExport = () => {
    const purpose = exportPurposeInput.trim() || 'Church governance review';
    if (exportTargetType === 'MEMBERS') {
      executeExportMembersCsv(purpose);
    } else if (exportTargetType === 'GIVING') {
      executeExportGivingCsv(purpose);
    } else {
      executeExportPledgesCsv(purpose);
    }
    setIsExportPurposeOpen(false);
  };

  const executeExportMembersCsv = (purpose: string) => {
    const headers = [
      'Member Number',
      'Title',
      'Full Name',
      'Envelope Number',
      'Family Group',
      'Department',
      'Phone',
      'Email',
      'Status',
      'Join Date',
    ];
    const rows = filteredMembers.map((m) => [
      m.memberNumber,
      m.title || '',
      m.fullName,
      m.envelopeNumber || '',
      m.familyGroup || '',
      m.department || '',
      m.phone || '',
      m.email || '',
      m.status,
      m.joinDate || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `church_members_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAuditEvent({
      action: 'EXPORT',
      record: 'Members Directory',
      entityType: 'MEMBER_DIRECTORY',
      entityId: 'all',
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Exported member directory (${filteredMembers.length} records). Purpose: ${purpose}`,
    });

    logSecurityEvent({
      eventType: 'GIVING_DATA_EXPORTED',
      description: `Exported member directory (${filteredMembers.length} records). Purpose: ${purpose}`,
      metadata: { count: filteredMembers.length, purpose },
    });
  };

  const executeExportGivingCsv = (purpose: string) => {
    const headers = ['Receipt No', 'Date', 'Member', 'Category', 'Fund', 'Amount (GHS)', 'Payment Method'];
    const rows = filteredGivingRecords.map((r) => [
      r.receiptNumber,
      r.serviceDate,
      r.memberName,
      r.category,
      r.fundName,
      (Number(r.amountPesewas) / 100).toFixed(2),
      r.paymentMethod,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `giving_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAuditEvent({
      action: 'EXPORT',
      record: 'Giving Records',
      entityType: 'GIVING_RECORDS',
      entityId: 'all',
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Exported confidential giving records (${filteredGivingRecords.length} records). Purpose: ${purpose}`,
    });

    logSecurityEvent({
      eventType: 'GIVING_DATA_EXPORTED',
      description: `Exported confidential giving records (${filteredGivingRecords.length} records). Purpose: ${purpose}`,
      metadata: { count: filteredGivingRecords.length, purpose },
    });
  };

  const executeExportPledgesCsv = (purpose: string) => {
    const headers = ['Campaign', 'Member', 'Target (GHS)', 'Fulfilled (GHS)', 'Balance (GHS)', 'Status'];
    const rows = filteredPledges.map((p) => [
      p.campaignName,
      p.memberName,
      (Number(p.targetAmountPesewas) / 100).toFixed(2),
      (Number(p.paidAmountPesewas) / 100).toFixed(2),
      (Number(p.targetAmountPesewas - p.paidAmountPesewas) / 100).toFixed(2),
      p.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pledges_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAuditEvent({
      action: 'EXPORT',
      record: 'Pledges Register',
      entityType: 'PLEDGES',
      entityId: 'all',
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Exported pledges register (${filteredPledges.length} records). Purpose: ${purpose}`,
    });

    logSecurityEvent({
      eventType: 'GIVING_DATA_EXPORTED',
      description: `Exported pledges register (${filteredPledges.length} records). Purpose: ${purpose}`,
      metadata: { count: filteredPledges.length, purpose },
    });
  };

  // Handle Add Member submit
  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = newFirstName.trim();
    const cleanLast = newLastName.trim();
    if (!cleanFirst && !cleanLast) {
      alert('Please enter member name.');
      return;
    }
    const cleanFull = `${cleanFirst} ${cleanLast}`.trim();
    const memNo = `MEM-${String(members.length + 1).padStart(3, '0')}`;
    const phoneClean = newPhone.trim();
    const phoneHint = phoneClean.length >= 3 ? phoneClean.slice(-3) : '000';

    const created = addMember({
      branchId: currentUser.branchId,
      memberNumber: memNo,
      envelopeNumber: newEnvelopeNo.trim() ? `ENV-${newEnvelopeNo.trim().replace(/^ENV-/, '')}` : undefined,
      title: newTitle || undefined,
      firstName: cleanFirst || undefined,
      lastName: cleanLast || undefined,
      fullName: cleanFull,
      phone: phoneClean || undefined,
      phoneHint,
      email: newEmail.trim() || undefined,
      familyGroup: newFamily.trim() || undefined,
      department: newDept,
      status: newStatus,
      joinDate: new Date().toISOString().slice(0, 10),
    });

    logAuditEvent({
      action: 'CREATE',
      record: created.memberNumber,
      entityType: 'MEMBER',
      entityId: created.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Added new member ${getMemberDisplayName(created)} (${created.memberNumber})`,
    });

    setNewFirstName('');
    setNewLastName('');
    setNewEnvelopeNo('');
    setNewPhone('');
    setNewEmail('');
    setNewFamily('');
    setIsAddMemberOpen(false);
  };

  // Open Edit Member modal
  const handleOpenEditMember = (member: Member) => {
    setEditTitle(member.title || 'Brother');
    setEditFirstName(member.firstName || member.fullName.split(' ')[0] || '');
    setEditLastName(member.lastName || member.fullName.split(' ').slice(1).join(' ') || '');
    setEditEnvelopeNo(member.envelopeNumber ? member.envelopeNumber.replace(/^ENV-/, '') : '');
    setEditPhone(member.phone || '');
    setEditEmail(member.email || '');
    setEditFamily(member.familyGroup || '');
    setEditDept(member.department || 'Men Fellowship');
    setEditStatus(member.status);
    setIsEditMemberOpen(true);
  };

  // Handle Edit Member submit
  const handleEditMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    const cleanFirst = editFirstName.trim();
    const cleanLast = editLastName.trim();
    const cleanFull = `${cleanFirst} ${cleanLast}`.trim();
    const phoneClean = editPhone.trim();
    const phoneHint = phoneClean.length >= 3 ? phoneClean.slice(-3) : '000';

    updateMember(selectedMember.id, {
      title: editTitle || undefined,
      firstName: cleanFirst || undefined,
      lastName: cleanLast || undefined,
      fullName: cleanFull || selectedMember.fullName,
      envelopeNumber: editEnvelopeNo.trim() ? `ENV-${editEnvelopeNo.trim()}` : undefined,
      phone: phoneClean || undefined,
      phoneHint,
      email: editEmail.trim() || undefined,
      familyGroup: editFamily.trim() || undefined,
      department: editDept,
      status: editStatus,
    });

    logAuditEvent({
      action: 'UPDATE',
      record: selectedMember.memberNumber,
      entityType: 'MEMBER',
      entityId: selectedMember.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Updated details for ${getMemberDisplayName(selectedMember)} (${selectedMember.memberNumber})`,
    });

    setIsEditMemberOpen(false);
  };

  // Handle Record Giving submit
  const handleRecordGivingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(givingAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const member = members.find((m) => m.id === givingTargetMemberId);
    const fund = funds.find((f) => f.id === givingFundId);

    const record = recordGiving({
      branchId: currentUser.branchId,
      memberId: member?.id,
      memberName: member ? getMemberDisplayName(member) : 'Anonymous Member',
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

    logAuditEvent({
      action: 'CREATE',
      record: record.receiptNumber,
      entityType: 'MEMBER_GIVING',
      entityId: record.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Recorded gift of GHS ${amt.toFixed(2)} (${givingCategory}) for ${record.memberName}`,
    });

    const printable = generatePrintableReceipt({
      record,
      receivingOfficer: currentUser.fullName,
      receivingOfficerRole: currentUser.role,
    });

    setActiveReceipt(printable);
    setIsReceiptModalOpen(true);
    setIsRecordGivingOpen(false);
    setGivingNotes('');
  };

  // Handle Reversal submit
  const handleReversalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTargetRecord) return;
    if (!reversalReason.trim()) {
      alert('Please provide a reason for this reversal.');
      return;
    }

    reverseGivingRecord(reversalTargetRecord.id, reversalReason.trim());

    logAuditEvent({
      action: 'REVERSAL',
      record: reversalTargetRecord.receiptNumber,
      entityType: 'MEMBER_GIVING',
      entityId: reversalTargetRecord.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Reversed gift ${reversalTargetRecord.receiptNumber} (${reversalReason.trim()})`,
    });

    setIsReversalModalOpen(false);
    setReversalTargetRecord(null);
    setReversalReason('');
  };

  // Handle Add Pledge submit
  const handleAddPledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(pledgeTargetAmtGhs);
    if (isNaN(target) || target <= 0) {
      alert('Please enter a valid target amount.');
      return;
    }
    const member = members.find((m) => m.id === pledgeTargetMemberId);
    const pledge = recordPledge({
      branchId: currentUser.branchId,
      memberId: pledgeTargetMemberId,
      memberName: member ? getMemberDisplayName(member) : 'Anonymous Member',
      fundId: 'fund-bld',
      fundName: 'Building Fund',
      campaignName: pledgeCampaign.trim(),
      pledgeDate: new Date().toISOString().slice(0, 10),
      targetDate: '2026-12-31',
      currency: 'GHS',
      targetAmountPesewas: BigInt(Math.round(target * 100)),
    });

    logAuditEvent({
      action: 'CREATE',
      record: pledge.campaignName,
      entityType: 'PLEDGE',
      entityId: pledge.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      device: currentUser.deviceId,
      details: `Recorded pledge of GHS ${target.toFixed(2)} for ${pledge.memberName}`,
    });

    setIsAddPledgeOpen(false);
  };

  // Giving records filtered
  const filteredGivingRecords = useMemo(() => {
    const list = isPrivileged ? givingRecords : getMaskedGivingRecords();
    const q = givingSearchTerm.trim().toLowerCase();

    return list.filter((r) => {
      const matchesSearch =
        !q ||
        r.memberName.toLowerCase().includes(q) ||
        r.receiptNumber.toLowerCase().includes(q) ||
        (r.memberNumber && r.memberNumber.toLowerCase().includes(q));

      const matchesFund = givingFundFilter === 'ALL' || r.fundId === givingFundFilter;
      const matchesCategory = givingCategoryFilter === 'ALL' || r.category === givingCategoryFilter;
      const matchesMethod = givingMethodFilter === 'ALL' || r.paymentMethod === givingMethodFilter;

      return matchesSearch && matchesFund && matchesCategory && matchesMethod;
    });
  }, [
    isPrivileged,
    givingRecords,
    getMaskedGivingRecords,
    givingSearchTerm,
    givingFundFilter,
    givingCategoryFilter,
    givingMethodFilter,
  ]);

  // Pledges filtered
  const filteredPledges = useMemo(() => {
    const list = isPrivileged ? pledges : getMaskedPledges();
    const q = pledgeSearchTerm.trim().toLowerCase();
    return list.filter((p) => {
      return !q || p.campaignName.toLowerCase().includes(q) || p.memberName.toLowerCase().includes(q);
    });
  }, [isPrivileged, pledges, getMaskedPledges, pledgeSearchTerm]);

  // Pledges aggregates
  const pledgeAggregates = useMemo(() => {
    const totalPledged = pledges.reduce((acc, p) => acc + p.targetAmountPesewas, 0n);
    const totalPaid = pledges.reduce((acc, p) => acc + p.paidAmountPesewas, 0n);
    const totalOutstanding = totalPledged > totalPaid ? totalPledged - totalPaid : 0n;
    return { totalPledged, totalPaid, totalOutstanding };
  }, [pledges]);

  // Drawer member's gifts and pledges
  const drawerMemberGiving = useMemo(() => {
    if (!selectedMember) return { records: [], totalYtd: 0n, byFund: [] as { fundName: string; amountPesewas: bigint }[], memberPledges: [] as Pledge[] };
    const memberGifts = givingRecords.filter(
      (r) => r.memberId === selectedMember.id && !r.isReversed
    );
    const totalYtd = memberGifts.reduce((acc, r) => acc + r.amountPesewas, 0n);

    // Group by fund
    const fundMap = new Map<string, bigint>();
    memberGifts.forEach((r) => {
      const cur = fundMap.get(r.fundName) || 0n;
      fundMap.set(r.fundName, cur + r.amountPesewas);
    });
    const byFund = Array.from(fundMap.entries()).map(([fundName, amountPesewas]) => ({
      fundName,
      amountPesewas,
    }));

    const memberPledges = pledges.filter((p) => p.memberId === selectedMember.id);

    return {
      records: memberGifts.slice(0, 10),
      totalYtd,
      byFund,
      memberPledges,
    };
  }, [selectedMember, givingRecords, pledges]);

  // Household members of selected drawer member
  const householdMembers = useMemo(() => {
    if (!selectedMember || !selectedMember.familyGroup) return [];
    return members.filter(
      (m) => m.id !== selectedMember.id && m.familyGroup === selectedMember.familyGroup
    );
  }, [selectedMember, members]);

  return (
    <div className="space-y-6">
      {/* 2.1 Header: Title "Members", Financial Year selector for statements & pledge campaigns (Spec A1) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[var(--surface-border)]">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">Members</h1>
            {!isPrivileged && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Giving amounts are hidden for your role.</span>
              </div>
            )}
          </div>
          <FinancialYearSelector compact />
        </div>

        {/* Tab Navigation: Underline tabs (Rule A3) */}
        <div className="flex items-center gap-6 border-b border-[var(--surface-border-subtle)] sm:border-b-0">
          <button
            onClick={() => setActiveTab('MEMBERS')}
            className={`pb-2.5 text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'MEMBERS'
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            <span>Members</span>
            <span className="text-[var(--text-muted)] font-normal text-[11px]">{members.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('GIVING')}
            className={`pb-2.5 text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'GIVING'
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            <span>Giving</span>
            <span className="text-[var(--text-muted)] font-normal text-[11px]">{givingRecords.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('PLEDGES')}
            className={`pb-2.5 text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'PLEDGES'
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            <span>Pledges and campaigns</span>
            <span className="text-[var(--text-muted)] font-normal text-[11px]">{pledges.length}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'MEMBERS' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative min-w-[220px] max-w-[320px] flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setMemberPage(1);
                  }}
                  placeholder="Search by name, number, envelope..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] focus:bg-[var(--surface-panel)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-hidden transition"
                />
              </div>

              {/* Department Filter */}
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setMemberPage(1);
                }}
                className="px-2.5 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
              >
                <option value="ALL">All departments</option>
                <option value="Men Fellowship">Men Fellowship</option>
                <option value="Women Ministry">Women Ministry</option>
                <option value="Choir">Choir</option>
                <option value="Youth">Youth</option>
                <option value="Ushers">Ushers</option>
                <option value="Children Ministry">Children Ministry</option>
                <option value="Deacon Board">Deacon Board</option>
                <option value="Pastoral Council">Pastoral Council</option>
                <option value="Media & IT">Media & IT</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setMemberPage(1);
                }}
                className="px-2.5 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="DECEASED">Deceased</option>
              </select>

              {/* Family Filter */}
              {familyGroups.length > 0 && (
                <select
                  value={familyFilter}
                  onChange={(e) => {
                    setFamilyFilter(e.target.value);
                    setMemberPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                >
                  <option value="ALL">All family groups</option>
                  {familyGroups.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              )}

              {/* Envelope column toggle */}
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none pl-1">
                <input
                  type="checkbox"
                  checked={showEnvelopeColumn}
                  onChange={(e) => setShowEnvelopeColumn(e.target.checked)}
                  className="rounded border-[var(--surface-border)] text-[var(--accent)] focus:ring-0"
                />
                <span>Envelope no.</span>
              </label>
            </div>

            {/* Actions: Primary Add member, Secondary Import, Export */}
            <div className="flex items-center gap-2">
              {isTreasurerOrFinSec && (
                <>
                  <button
                    onClick={() => navigate('#/member-data-requests')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
                    title="Data subject requests & anonymisation under Ghana Data Protection Act"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Data privacy (Act 843)</span>
                  </button>
                  <button
                    onClick={() => handleOpenExportModal('MEMBERS')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
                    title="Export member directory to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Export</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setIsImportCsvOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Import CSV</span>
              </button>

              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add member</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)]/60 text-[var(--text-secondary)] font-medium">
                    <th className="py-2.5 px-3 w-28">Member no.</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Name</th>
                    {showEnvelopeColumn && <th className="py-2.5 px-3 w-28">Envelope no.</th>}
                    <th className="py-2.5 px-3">Family group</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Phone</th>
                    <th className="py-2.5 px-3 text-right">Last gift</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border-subtle)]">
                  {paginatedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={showEnvelopeColumn ? 8 : 7} className="py-12 text-center">
                        <EmptyState
                          message={
                            searchTerm || departmentFilter !== 'ALL' || statusFilter !== 'ALL'
                              ? 'No members match the current search or filter criteria.'
                              : 'No members yet. Add a member or import a CSV.'
                          }
                          actionLabel="Add member"
                          onAction={() => setIsAddMemberOpen(true)}
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedMembers.map((m) => {
                      const isPhoneRevealed = revealedPhones.has(m.id);
                      const lastGiftDate = memberLastGiftMap.get(m.id);
                      const displayName = getMemberDisplayName(m);

                      return (
                        <tr
                          key={m.id}
                          onClick={() => {
                            setSelectedMemberId(m.id);
                            try {
                              navigate(`#/members/${m.id}`, {
                                listKey: 'members',
                                listItemIds: members.map((x) => x.id),
                              });
                            } catch {}
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedMemberId(m.id);
                              try {
                                navigate(`#/members/${m.id}`, {
                                  listKey: 'members',
                                  listItemIds: members.map((x) => x.id),
                                });
                              } catch {}
                            }
                          }}
                          tabIndex={0}
                          className="hover:bg-[var(--surface-subtle)]/70 cursor-pointer transition select-none group"
                        >
                          {/* Member No (plain text, regular font, not blue monospace) */}
                          <td className="py-2.5 px-3 font-normal text-[var(--text-secondary)]">
                            {m.memberNumber}
                          </td>

                          {/* Name (with Title) */}
                          <td className="py-2.5 px-3 font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition">
                            {displayName}
                          </td>

                          {/* Envelope No (optional) */}
                          {showEnvelopeColumn && (
                            <td className="py-2.5 px-3 text-[var(--text-secondary)] font-normal">
                              {m.envelopeNumber || '—'}
                            </td>
                          )}

                          {/* Family Group */}
                          <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                            {m.familyGroup || '—'}
                          </td>

                          {/* Department */}
                          <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                            {m.department || '—'}
                          </td>

                          {/* Phone: Masked with logged Show button */}
                          <td
                            className="py-2.5 px-3 text-[var(--text-secondary)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {m.phone ? (
                              isPhoneRevealed ? (
                                <span className="font-tabular text-[var(--text-primary)]">{m.phone}</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 font-tabular">
                                  <span>{`+233 •• ••• •${m.phoneHint || m.phone.slice(-3)}`}</span>
                                  {isPrivileged && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevealPhone(m)}
                                      className="text-[var(--accent)] hover:underline text-[11px] font-medium ml-1"
                                      title="Reveal full phone number (logged in audit trail)"
                                    >
                                      Show
                                    </button>
                                  )}
                                </span>
                              )
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>

                          {/* Last Gift Date */}
                          <td className="py-2.5 px-3 text-right font-tabular text-[var(--text-secondary)]">
                            {lastGiftDate ? formatDate(lastGiftDate) : '—'}
                          </td>

                          {/* Status: Tag shown ONLY when NOT Active (Rule 2.2) */}
                          <td className="py-2.5 px-3 text-center">
                            {m.status === 'INACTIVE' && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Inactive
                              </span>
                            )}
                            {m.status === 'TRANSFERRED' && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Transferred
                              </span>
                            )}
                            {m.status === 'DECEASED' && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Deceased
                              </span>
                            )}
                            {/* Active rows display nothing here - no green pill */}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paging controls */}
            {filteredMembers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)]/40 text-xs text-[var(--text-secondary)]">
                <div>
                  Showing {Math.min((memberPage - 1) * PAGE_SIZE + 1, filteredMembers.length)}–
                  {Math.min(memberPage * PAGE_SIZE, filteredMembers.length)} of {filteredMembers.length}{' '}
                  members
                </div>
                {filteredMembers.length > PAGE_SIZE && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setMemberPage((p) => Math.max(p - 1, 1))}
                      disabled={memberPage === 1}
                      className="px-2.5 py-1 rounded border border-[var(--surface-border)] disabled:opacity-40 hover:bg-[var(--surface-subtle)] text-xs"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-xs text-[var(--text-muted)]">
                      Page {memberPage} of {Math.ceil(filteredMembers.length / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() =>
                        setMemberPage((p) =>
                          p < Math.ceil(filteredMembers.length / PAGE_SIZE) ? p + 1 : p
                        )
                      }
                      disabled={memberPage >= Math.ceil(filteredMembers.length / PAGE_SIZE)}
                      className="px-2.5 py-1 rounded border border-[var(--surface-border)] disabled:opacity-40 hover:bg-[var(--surface-subtle)] text-xs"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GIVING */}
      {activeTab === 'GIVING' && (
        <div className="space-y-4">
          {/* Giving Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative min-w-[220px] max-w-[320px] flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={givingSearchTerm}
                  onChange={(e) => setGivingSearchTerm(e.target.value)}
                  placeholder="Search donor name, receipt no..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] focus:bg-[var(--surface-panel)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-hidden transition"
                />
              </div>

              {/* Fund filter */}
              <select
                value={givingFundFilter}
                onChange={(e) => setGivingFundFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
              >
                <option value="ALL">All funds</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {/* Category filter */}
              <select
                value={givingCategoryFilter}
                onChange={(e) => setGivingCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
              >
                <option value="ALL">All categories</option>
                <option value="Tithe">Tithe</option>
                <option value="General Offering">General Offering</option>
                <option value="Building Pledge">Building Pledge</option>
                <option value="Missions">Missions</option>
                <option value="Welfare">Welfare</option>
                <option value="Other Donation">Other Donation</option>
              </select>

              {/* Method filter */}
              <select
                value={givingMethodFilter}
                onChange={(e) => setGivingMethodFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
              >
                <option value="ALL">All methods</option>
                <option value="CASH">Cash</option>
                <option value="MOMO">Mobile Money</option>
                <option value="CHEQUE">Cheque</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>

            {/* Primary Action */}
            <button
              onClick={() => {
                setGivingTargetMemberId(members[0]?.id || 'mem-001');
                setIsRecordGivingOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record giving</span>
            </button>
          </div>

          {/* Giving Records Table */}
          <div className="rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)]/60 text-[var(--text-secondary)] font-medium">
                    <th className="py-2.5 px-3 w-28">Date</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Member / Donor</th>
                    <th className="py-2.5 px-3">Fund</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                    <th className="py-2.5 px-3">Receipt no.</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border-subtle)]">
                  {filteredGivingRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[var(--text-muted)]">
                        No giving records found.
                      </td>
                    </tr>
                  ) : (
                    filteredGivingRecords.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-[var(--surface-subtle)]/60 transition ${
                          r.isReversed ? 'opacity-60 bg-[var(--surface-subtle)]/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-tabular text-[var(--text-secondary)]">
                          {formatDate(r.serviceDate)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                          {r.memberName}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.fundName}</td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.category}</td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.paymentMethod}</td>
                        <td className="py-2.5 px-3 text-right font-tabular text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(r.amountPesewas)}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)] font-tabular">
                          {r.receiptNumber}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.isReversed ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium"
                              title={`Reversed: ${r.reversalReason || 'No reason provided'}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Reversed
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                const printable = generatePrintableReceipt({
                                  record: r,
                                  receivingOfficer: currentUser.fullName,
                                  receivingOfficerRole: currentUser.role,
                                });
                                setActiveReceipt(printable);
                                setIsReceiptModalOpen(true);
                              }}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
                              title="Print receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {!r.isReversed && isTreasurerOrFinSec && (
                              <button
                                onClick={() => {
                                  setReversalTargetRecord(r);
                                  setReversalReason('');
                                  setIsReversalModalOpen(true);
                                }}
                                className="text-xs text-[var(--text-muted)] hover:text-rose-600 px-1 py-0.5 rounded transition"
                                title="Reverse this giving entry (corrections must be reversals)"
                              >
                                Reverse
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLEDGES AND CAMPAIGNS */}
      {activeTab === 'PLEDGES' && (
        <div className="space-y-4">
          {/* Campaign summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
            <div className="space-y-0.5">
              <span className="text-xs text-[var(--text-muted)]">Total Pledged</span>
              <div className="text-base font-semibold font-tabular text-[var(--text-primary)]">
                GHS {formatMoneyAmount(pledgeAggregates.totalPledged)}
              </div>
            </div>
            <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-[var(--surface-border)] pt-2 sm:pt-0 sm:pl-4">
              <span className="text-xs text-[var(--text-muted)]">Total Paid</span>
              <div className="text-base font-semibold font-tabular text-[var(--text-primary)]">
                GHS {formatMoneyAmount(pledgeAggregates.totalPaid)}
              </div>
            </div>
            <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-[var(--surface-border)] pt-2 sm:pt-0 sm:pl-4">
              <span className="text-xs text-[var(--text-muted)]">Total Outstanding</span>
              <div className="text-base font-semibold font-tabular text-[var(--text-primary)]">
                GHS {formatMoneyAmount(pledgeAggregates.totalOutstanding)}
              </div>
            </div>
          </div>

          {/* Pledges Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
            <div className="relative min-w-[220px] max-w-[320px] flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={pledgeSearchTerm}
                onChange={(e) => setPledgeSearchTerm(e.target.value)}
                placeholder="Search campaign or member..."
                className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius)] text-xs border border-[var(--surface-border)] bg-[var(--surface-subtle)] focus:bg-[var(--surface-panel)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-hidden transition"
              />
            </div>

            <button
              onClick={() => {
                setPledgeTargetMemberId(members[0]?.id || 'mem-001');
                setIsAddPledgeOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record pledge</span>
            </button>
          </div>

          {/* Pledges DataTable */}
          <div className="rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)]/60 text-[var(--text-secondary)] font-medium">
                    <th className="py-2.5 px-3 min-w-[180px]">Campaign</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Member</th>
                    <th className="py-2.5 px-3 text-right">Pledged (GHS)</th>
                    <th className="py-2.5 px-3 text-right">Paid (GHS)</th>
                    <th className="py-2.5 px-3 text-right">Outstanding (GHS)</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Progress</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border-subtle)]">
                  {filteredPledges.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                        No pledges recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredPledges.map((p) => {
                      const outstanding =
                        p.targetAmountPesewas > p.paidAmountPesewas
                          ? p.targetAmountPesewas - p.paidAmountPesewas
                          : 0n;
                      const percent =
                        p.targetAmountPesewas > 0n
                          ? Math.min(
                              100,
                              Math.round(
                                (Number(p.paidAmountPesewas) / Number(p.targetAmountPesewas)) * 100
                              )
                            )
                          : 0;

                      return (
                        <tr key={p.id} className="hover:bg-[var(--surface-subtle)]/60 transition">
                          <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                            {p.campaignName}
                          </td>
                          <td className="py-2.5 px-3 text-[var(--text-secondary)]">{p.memberName}</td>
                          <td className="py-2.5 px-3 text-right font-tabular text-[var(--text-primary)]">
                            {formatMoneyAmount(p.targetAmountPesewas)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-tabular text-[var(--text-primary)]">
                            {formatMoneyAmount(p.paidAmountPesewas)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-tabular text-[var(--text-secondary)]">
                            {formatMoneyAmount(outstanding)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[var(--surface-border)] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-[var(--accent)] h-1.5 rounded-full transition-all"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="font-tabular text-[11px] text-[var(--text-muted)] w-8 text-right">
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {p.status === 'FULFILLED' && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Fulfilled
                              </span>
                            )}
                            {p.status === 'ACTIVE' && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Active
                              </span>
                            )}
                            {p.status === 'CANCELLED' && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Cancelled
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2.3 MEMBER DETAIL PANEL (SlideOverPanel) */}
      <SlideOverPanel
        isOpen={isDrawerOpen}
        onClose={() => setSelectedMemberId(null)}
        title={selectedMember ? getMemberDisplayName(selectedMember) : ''}
        subtitle={
          selectedMember
            ? `${selectedMember.memberNumber} · Joined ${formatDate(selectedMember.joinDate)}`
            : undefined
        }
        width="max-w-[480px]"
        actions={
          selectedMember && (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                {isPrivileged && (
                  <button
                    onClick={() => handleOpenMemberStatement(selectedMember)}
                    className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
                  >
                    Print statement
                  </button>
                )}
                <button
                  onClick={() => handleOpenEditMember(selectedMember)}
                  className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
                >
                  Edit member
                </button>
              </div>

              <button
                onClick={() => {
                  setGivingTargetMemberId(selectedMember.id);
                  setIsRecordGivingOpen(true);
                }}
                className="px-3 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
              >
                Record giving
              </button>
            </div>
          )
        }
      >
        {selectedMember && (
          <div className="space-y-6 text-xs text-[var(--text-secondary)]">
            {/* Status if not active */}
            {selectedMember.status !== 'ACTIVE' && (
              <div className="p-2.5 rounded-[var(--radius)] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span>Member status: <strong>{selectedMember.status}</strong></span>
                {isTreasurerOrFinSec && (
                  <button
                    onClick={() => {
                      updateMember(selectedMember.id, { status: 'ACTIVE' });
                      logAuditEvent({
                        action: 'UPDATE',
                        record: selectedMember.memberNumber,
                        entityType: 'MEMBER',
                        entityId: selectedMember.id,
                        details: `Reactivated member ${selectedMember.memberNumber}`,
                      });
                    }}
                    className="text-xs text-[var(--accent)] font-semibold hover:underline"
                  >
                    Set as active
                  </button>
                )}
              </div>
            )}

            {/* Section 1: Contact Information */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Contact information
              </h4>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]/50 border border-[var(--surface-border-subtle)]">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Phone number</span>
                  {selectedMember.phone ? (
                    revealedPhones.has(selectedMember.id) ? (
                      <span className="font-tabular font-medium text-[var(--text-primary)]">
                        {selectedMember.phone}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-tabular">
                        <span>{`+233 •• ••• •${selectedMember.phoneHint || selectedMember.phone.slice(-3)}`}</span>
                        {isPrivileged && (
                          <button
                            type="button"
                            onClick={() => handleRevealPhone(selectedMember)}
                            className="text-[var(--accent)] hover:underline text-[11px] font-medium"
                          >
                            Show
                          </button>
                        )}
                      </span>
                    )
                  ) : (
                    <span className="text-[var(--text-muted)]">None registered</span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Email address</span>
                  <span className="font-medium text-[var(--text-primary)] break-all">
                    {selectedMember.email || 'None registered'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Family & Household */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Family & Household
              </h4>
              <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]/50 border border-[var(--surface-border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Family group</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedMember.familyGroup || 'None assigned'}
                  </span>
                </div>

                {householdMembers.length > 0 && (
                  <div className="pt-2 border-t border-[var(--surface-border-subtle)] space-y-1.5">
                    <span className="text-[11px] text-[var(--text-muted)] block">
                      Other family members ({householdMembers.length})
                    </span>
                    <div className="space-y-1">
                      {householdMembers.map((hm) => (
                        <div
                          key={hm.id}
                          onClick={() => {
                            setSelectedMemberId(null);
                            navigate(`#/members/${hm.id}`);
                          }}
                          className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[var(--surface-subtle)] cursor-pointer text-xs"
                        >
                          <span className="text-[var(--text-primary)] font-medium">
                            {getMemberDisplayName(hm)}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                            {hm.department}
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Department and Join Date */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Church details
              </h4>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]/50 border border-[var(--surface-border-subtle)]">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Department</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedMember.department || 'General Congregation'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Envelope number</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedMember.envelopeNumber || 'None assigned'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 4: Giving & Financial Summary (Permitted roles only) */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Giving summary (2026)
              </h4>

              {!isPrivileged ? (
                <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]/40 border border-[var(--surface-border-subtle)] flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Giving records are confidential and restricted to authorized financial officers.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Total YTD and last gift date */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]/50 border border-[var(--surface-border-subtle)]">
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Total 2026 Giving</span>
                      <span className="text-base font-semibold font-tabular text-[var(--text-primary)]">
                        GHS {formatMoneyAmount(drawerMemberGiving.totalYtd)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Last gift date</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {memberLastGiftMap.get(selectedMember.id)
                          ? formatDate(memberLastGiftMap.get(selectedMember.id)!)
                          : 'No gifts recorded'}
                      </span>
                    </div>
                  </div>

                  {/* Giving by fund */}
                  {drawerMemberGiving.byFund.length > 0 && (
                    <div className="rounded-[var(--radius)] border border-[var(--surface-border-subtle)] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--surface-subtle)]/60 text-[var(--text-muted)]">
                          <tr>
                            <th className="py-1.5 px-3">Fund</th>
                            <th className="py-1.5 px-3 text-right">Amount (GHS)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border-subtle)]">
                          {drawerMemberGiving.byFund.map((bf) => (
                            <tr key={bf.fundName}>
                              <td className="py-1.5 px-3 text-[var(--text-secondary)]">{bf.fundName}</td>
                              <td className="py-1.5 px-3 text-right font-tabular text-[var(--text-primary)]">
                                {formatMoneyAmount(bf.amountPesewas)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Recent gifts (up to 10) */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">Recent gifts</span>
                    {drawerMemberGiving.records.length === 0 ? (
                      <div className="p-3 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--surface-border)] rounded-[var(--radius)]">
                        No recent gifts recorded for this member.
                      </div>
                    ) : (
                      <div className="rounded-[var(--radius)] border border-[var(--surface-border-subtle)] overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[var(--surface-subtle)]/60 text-[var(--text-muted)]">
                            <tr>
                              <th className="py-1.5 px-2.5">Date</th>
                              <th className="py-1.5 px-2.5">Category</th>
                              <th className="py-1.5 px-2.5 text-right">Amount</th>
                              <th className="py-1.5 px-2 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--surface-border-subtle)]">
                            {drawerMemberGiving.records.map((r) => (
                              <tr key={r.id}>
                                <td className="py-1.5 px-2.5 font-tabular text-[var(--text-secondary)]">
                                  {formatDate(r.serviceDate)}
                                </td>
                                <td className="py-1.5 px-2.5 text-[var(--text-secondary)]">{r.category}</td>
                                <td className="py-1.5 px-2.5 text-right font-tabular text-[var(--text-primary)]">
                                  {formatMoneyAmount(r.amountPesewas)}
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  <button
                                    onClick={() => {
                                      const printable = generatePrintableReceipt({
                                        record: r,
                                        receivingOfficer: currentUser.fullName,
                                        receivingOfficerRole: currentUser.role,
                                      });
                                      setActiveReceipt(printable);
                                      setIsReceiptModalOpen(true);
                                    }}
                                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                                    title="Print receipt"
                                  >
                                    <Printer className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Pledges */}
                  {drawerMemberGiving.memberPledges.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">Pledges</span>
                      <div className="space-y-2">
                        {drawerMemberGiving.memberPledges.map((p) => {
                          const outstanding =
                            p.targetAmountPesewas > p.paidAmountPesewas
                              ? p.targetAmountPesewas - p.paidAmountPesewas
                              : 0n;
                          const percent =
                            p.targetAmountPesewas > 0n
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (Number(p.paidAmountPesewas) / Number(p.targetAmountPesewas)) * 100
                                  )
                                )
                              : 0;

                          return (
                            <div
                              key={p.id}
                              className="p-2.5 rounded-[var(--radius)] border border-[var(--surface-border-subtle)] bg-[var(--surface-subtle)]/30 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs font-medium text-[var(--text-primary)]">
                                <span>{p.campaignName}</span>
                                <span>GHS {formatMoneyAmount(p.targetAmountPesewas)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                                <span>Paid: GHS {formatMoneyAmount(p.paidAmountPesewas)}</span>
                                <span>Outstanding: GHS {formatMoneyAmount(outstanding)}</span>
                              </div>
                              <div className="w-full bg-[var(--surface-border)] rounded-full h-1 overflow-hidden">
                                <div
                                  className="bg-[var(--accent)] h-1 rounded-full"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* ADD MEMBER MODAL */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Add church member</h3>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Duplicate warning */}
            {duplicateWarning && (
              <div className="p-3 rounded-[var(--radius)] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            <form onSubmit={handleAddMemberSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Title</label>
                  <select
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="">None</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Deacon">Deacon</option>
                    <option value="Deaconess">Deaconess</option>
                    <option value="Elder">Elder</option>
                    <option value="Pastor">Pastor</option>
                    <option value="Rev.">Rev.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">First name</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Kwabena"
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Surname</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Acheampong"
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Phone number</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+233 24 000 0000"
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Email address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Envelope no. (optional)</label>
                  <input
                    type="text"
                    value={newEnvelopeNo}
                    onChange={(e) => setNewEnvelopeNo(e.target.value)}
                    placeholder="e.g. 042"
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Family group (optional)</label>
                  <input
                    type="text"
                    value={newFamily}
                    onChange={(e) => setNewFamily(e.target.value)}
                    placeholder="e.g. Acheampong Family"
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="Men Fellowship">Men Fellowship</option>
                    <option value="Women Ministry">Women Ministry</option>
                    <option value="Choir">Choir</option>
                    <option value="Youth">Youth</option>
                    <option value="Ushers">Ushers</option>
                    <option value="Children Ministry">Children Ministry</option>
                    <option value="Deacon Board">Deacon Board</option>
                    <option value="Pastoral Council">Pastoral Council</option>
                    <option value="Media & IT">Media & IT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Initial status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="TRANSFERRED">Transferred</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
                >
                  Save member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEMBER MODAL */}
      {isEditMemberOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Edit member details ({selectedMember.memberNumber})
              </h3>
              <button
                onClick={() => setIsEditMemberOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditMemberSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Title</label>
                  <select
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="">None</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Deacon">Deacon</option>
                    <option value="Deaconess">Deaconess</option>
                    <option value="Elder">Elder</option>
                    <option value="Pastor">Pastor</option>
                    <option value="Rev.">Rev.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">First name</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Surname</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Phone number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Email address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Envelope no.</label>
                  <input
                    type="text"
                    value={editEnvelopeNo}
                    onChange={(e) => setEditEnvelopeNo(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Family group</label>
                  <input
                    type="text"
                    value={editFamily}
                    onChange={(e) => setEditFamily(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Department</label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="Men Fellowship">Men Fellowship</option>
                    <option value="Women Ministry">Women Ministry</option>
                    <option value="Choir">Choir</option>
                    <option value="Youth">Youth</option>
                    <option value="Ushers">Ushers</option>
                    <option value="Children Ministry">Children Ministry</option>
                    <option value="Deacon Board">Deacon Board</option>
                    <option value="Pastoral Council">Pastoral Council</option>
                    <option value="Media & IT">Media & IT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="TRANSFERRED">Transferred</option>
                    <option value="DECEASED">Deceased</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsEditMemberOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
                >
                  Update details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD GIVING MODAL */}
      {isRecordGivingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Record giving contribution</h3>
              <button
                onClick={() => setIsRecordGivingOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordGivingSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Member / Donor</label>
                <select
                  value={givingTargetMemberId}
                  onChange={(e) => setGivingTargetMemberId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {getMemberDisplayName(m)} ({m.memberNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Fund</label>
                  <select
                    value={givingFundId}
                    onChange={(e) => setGivingFundId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Category</label>
                  <select
                    value={givingCategory}
                    onChange={(e) => setGivingCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="Tithe">Tithe</option>
                    <option value="General Offering">General Offering</option>
                    <option value="Building Pledge">Building Pledge</option>
                    <option value="Missions">Missions</option>
                    <option value="Welfare">Welfare</option>
                    <option value="Other Donation">Other Donation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Payment method</label>
                  <select
                    value={givingMethod}
                    onChange={(e) => setGivingMethod(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                  >
                    <option value="CASH">Cash</option>
                    <option value="MOMO">Mobile Money</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={givingAmount}
                    onChange={(e) => setGivingAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-tabular text-right outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">Notes / Purpose (optional)</label>
                <input
                  type="text"
                  value={givingNotes}
                  onChange={(e) => setGivingNotes(e.target.value)}
                  placeholder="e.g. October Tithe envelope"
                  className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsRecordGivingOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
                >
                  Record and issue receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSAL MODAL */}
      {isReversalModalOpen && reversalTargetRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Reverse giving entry
              </h3>
              <button
                onClick={() => setIsReversalModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Receipt no:</span>
                <span className="font-tabular font-medium text-[var(--text-primary)]">
                  {reversalTargetRecord.receiptNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Donor:</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {reversalTargetRecord.memberName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Amount:</span>
                <span className="font-tabular font-semibold text-[var(--text-primary)]">
                  GHS {formatMoneyAmount(reversalTargetRecord.amountPesewas)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Per accounting standards, financial records cannot be deleted. A reversal entry will be
              posted to cancel this contribution, and the event will be permanently recorded in the audit
              log.
            </p>

            <form onSubmit={handleReversalSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  Reason for reversal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Incorrect fund allocation / donor cheque returned"
                  className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsReversalModalOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  Confirm reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PLEDGE MODAL */}
      {isAddPledgeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Record special pledge</h3>
              <button
                onClick={() => setIsAddPledgeOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPledgeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Member</label>
                <select
                  value={pledgeTargetMemberId}
                  onChange={(e) => setPledgeTargetMemberId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {getMemberDisplayName(m)} ({m.memberNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">Campaign name</label>
                <input
                  type="text"
                  required
                  value={pledgeCampaign}
                  onChange={(e) => setPledgeCampaign(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">Pledge target amount (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={pledgeTargetAmtGhs}
                  onChange={(e) => setPledgeTargetAmtGhs(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-tabular text-right outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsAddPledgeOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
                >
                  Save pledge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT CSV MODAL */}
      {isImportCsvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Import members from CSV</h3>
              <button
                onClick={() => setIsImportCsvOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Paste CSV data with columns: <code>Title, First Name, Last Name, Phone, Email, Family Group, Department</code>.
            </p>

            {importFeedback && (
              <div className="p-2.5 rounded-[var(--radius)] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 text-xs">
                {importFeedback}
              </div>
            )}

            <textarea
              rows={6}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder="Brother, Kwesi, Boateng, +233241234567, kwesi@example.com, Boateng Family, Men Fellowship"
              className="w-full p-2.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] font-mono text-[11px] text-[var(--text-primary)] outline-hidden"
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => setIsImportCsvOpen(false)}
                className="px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!importCsvText.trim()) return;
                  const lines = importCsvText.trim().split('\n');
                  let count = 0;
                  lines.forEach((line) => {
                    const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
                    if (parts.length >= 3) {
                      const [title, fn, ln, phone, email, fam, dept] = parts;
                      if (fn || ln) {
                        const memNo = `MEM-${String(members.length + 1 + count).padStart(3, '0')}`;
                        addMember({
                          branchId: currentUser.branchId,
                          memberNumber: memNo,
                          title: title || undefined,
                          firstName: fn || undefined,
                          lastName: ln || undefined,
                          fullName: `${fn || ''} ${ln || ''}`.trim(),
                          phone: phone || undefined,
                          phoneHint: phone && phone.length >= 3 ? phone.slice(-3) : '000',
                          email: email || undefined,
                          familyGroup: fam || undefined,
                          department: dept || 'Men Fellowship',
                          status: 'ACTIVE',
                          joinDate: new Date().toISOString().slice(0, 10),
                        });
                        count++;
                      }
                    }
                  });
                  setImportFeedback(`Successfully imported ${count} members.`);
                  setImportCsvText('');
                  logAuditEvent({
                    action: 'CREATE',
                    record: 'CSV Import',
                    entityType: 'MEMBER_DIRECTORY',
                    entityId: 'batch',
                    details: `Imported ${count} members from CSV`,
                  });
                }}
                className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold shadow-xs transition"
              >
                Process import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE RECEIPT MODAL */}
      <PrintableReceiptModal
        receipt={activeReceipt}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />

      {/* MEMBER STATEMENT MODAL */}
      <MemberStatementModal
        statement={selectedStatement}
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
      />

      {/* EXPORT PURPOSE MODAL (Spec C6: Required for all confidential exports) */}
      {isExportPurposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] rounded-[var(--radius)] border border-[var(--surface-border)] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Export confidential giving data
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Church data privacy policy requires an official purpose for exporting member or giving records. This is logged to the anti-tampering audit trail.
                </p>
              </div>
              <button
                onClick={() => setIsExportPurposeOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Reason / Purpose for export <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={exportPurposeInput}
                onChange={(e) => setExportPurposeInput(e.target.value)}
                placeholder="e.g. Annual church audit, Pastoral welfare review..."
                className="w-full px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setIsExportPurposeOpen(false)}
                className="px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={!exportPurposeInput.trim()}
                className="px-4 py-1.5 text-[13px] font-semibold rounded-[var(--radius-sm)] bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
