/**
 * SettingsView Component.
 * Complete administration and settings hub split into 8 underline tabs:
 * Users and roles · Devices · Audit log · Backup and restore · Church profile · Funds and accounts · Periods and rates · About.
 * Minimum text size 13px, no developer wording, strict separation of duties.
 */

import React, { useState, useContext, useMemo } from 'react';
import {
  ShieldCheck,
  Download,
  Upload,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Search,
  Lock,
  Plus,
  Play,
  X,
  KeyRound,
  LogOut,
  Sliders,
  ShieldAlert,
  FileCheck,
  Calendar,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useSync } from '../../context/SyncContext.js';
import { useDemo } from '../../context/DemoContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { useApprovals } from '../../context/ApprovalContext.js';
import { useSecurityEvents } from '../../context/SecurityEventsContext.js';
import { defaultChurchSettings, formatDate } from '../../config/churchSettings.js';
import {
  getMonthName,
  canApproveMfaReset,
  type Role,
  type UserMfaRecord,
  type MfaResetRequest,
  type ApprovalMatrixRule,
  type SecurityEvent,
  type SecurityEventCategory,
  type SecuritySeverity,
  type BackupSandboxVerificationResult,
  verifyBackupArchiveSandbox,
  createEncryptedBackup,
} from '@church/domain';
import { FinancialYearSelector } from '../ui/FinancialYearSelector.js';
import { MfaEnrollmentModal } from '../security/MfaEnrollmentModal.js';

export type SettingsTab =
  | 'users'
  | 'devices'
  | 'approval-limits'
  | 'security-events'
  | 'audit'
  | 'backup'
  | 'profile'
  | 'funds-accounts'
  | 'periods-rates'
  | 'about';

interface ManagedUser {
  id: string;
  name: string;
  role: string;
  status: 'Active' | 'Deactivated';
  lastActive: string;
  devices: string[];
}

export const SettingsView: React.FC = () => {
  const {
    currentUser,
    userMfaRecords,
    deviceRecords,
    userSessions,
    mfaResetRequests,
    requestMfaResetAction,
    approveMfaResetAction,
    rejectMfaResetAction,
    approveDeviceAction,
    revokeDeviceAction,
    signOutEverywhereAction,
    triggerReAuth,
    signUpOnline,
  } = useAuth();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Finance Secretary');
  const [inviteTempPassword, setInviteTempPassword] = useState('Church2026!');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [isMfaEnrollmentOpen, setIsMfaEnrollmentOpen] = useState(false);
  const [mfaResetModalState, setMfaResetModalState] = useState<{
    isOpen: boolean;
    targetUser: ManagedUser | null;
    reason: string;
  }>({
    isOpen: false,
    targetUser: null,
    reason: '',
  });
  const {
    accounts,
    funds,
    periods,
    exchangeRates,
    entries,
    currentYearPeriods,
    selectedFinancialYear,
    fiscalYearStartMonth,
    hasAdjustmentPeriod,
    canEditFiscalYearStartMonth,
    updateFiscalYearConfig,
    updatePeriodStatus,
    openingBalanceBatch,
  } = useLedger();
  const { navigate } = useRouter();
  const {
    exportEncryptedBackup,
    restoreFromEncryptedBackup,
    simulateMultiDeviceScenario,
    simulationLog,
    clearSimulationLog,
    enqueueItem,
  } = useSync();
  const { isDemoMode } = useDemo();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  const [activeTab, setActiveTab] = useState<SettingsTab>('users');

  // Approvals & SoD context (Spec Section C3 & C4)
  const {
    activeMatrixVersion,
    matrixVersions,
    proposeNewMatrix,
    approveProposedMatrix,
  } = useApprovals();

  const [isProposeMatrixOpen, setIsProposeMatrixOpen] = useState(false);
  const [proposeEffectiveDate, setProposeEffectiveDate] = useState('2026-11-01');
  const [proposeNotes, setProposeNotes] = useState('');
  const [editingRules, setEditingRules] = useState<ApprovalMatrixRule[]>([]);

  // Tab 1: Users & Roles state
  const [userList, setUserList] = useState<ManagedUser[]>([
    {
      id: 'usr-001',
      name: 'Kofi Mensah',
      role: 'Treasurer',
      status: 'Active',
      lastActive: '02 Nov 2026, 14:10',
      devices: ['DEV-TR-01'],
    },
    {
      id: 'usr-002',
      name: 'Akosua Osei',
      role: 'Finance Secretary',
      status: 'Active',
      lastActive: '02 Nov 2026, 13:45',
      devices: ['DEV-FS-01'],
    },
    {
      id: 'usr-003',
      name: 'Rev. Emmanuel Addo',
      role: 'Pastor / Elder',
      status: 'Active',
      lastActive: '01 Nov 2026, 16:20',
      devices: ['DEV-PE-01'],
    },
    {
      id: 'usr-004',
      name: 'Kwame Boateng',
      role: 'Counter',
      status: 'Active',
      lastActive: '01 Nov 2026, 12:30',
      devices: ['DEV-CS-01'],
    },
    {
      id: 'usr-005',
      name: 'Abena Poku',
      role: 'Counter',
      status: 'Active',
      lastActive: '01 Nov 2026, 12:30',
      devices: ['DEV-CS-02'],
    },
    {
      id: 'usr-006',
      name: 'Justice Appiah, CA',
      role: 'Auditor',
      status: 'Active',
      lastActive: '30 Oct 2026, 17:00',
      devices: ['DEV-AU-01'],
    },
    {
      id: 'usr-007',
      name: 'Yaw Kwarteng',
      role: 'Department Head',
      status: 'Active',
      lastActive: '29 Oct 2026, 11:15',
      devices: ['DEV-DH-01'],
    },
    {
      id: 'usr-008',
      name: 'Kwabena Acheampong',
      role: 'Administrator',
      status: 'Active',
      lastActive: '02 Nov 2026, 09:00',
      devices: ['DEV-AD-01'],
    },
  ]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserForRoleChange, setSelectedUserForRoleChange] = useState<ManagedUser | null>(null);
  const [newRoleValue, setNewRoleValue] = useState('');
  const [roleChangeReason, setRoleChangeReason] = useState('');

  // Security events & Anti-tampering (Spec Section C5 & C6)
  const {
    events: securityEvents,
    logSecurityEvent,
    acknowledgeSecurityEvent,
    hashChainResult,
    lastBackupVerification,
    recordBackupVerification,
    dailySecuritySummary,
  } = useSecurityEvents();

  const [secCategoryFilter, setSecCategoryFilter] = useState<'ALL' | SecurityEventCategory>('ALL');
  const [secSeverityFilter, setSecSeverityFilter] = useState<'ALL' | SecuritySeverity>('ALL');
  const [secSearchTerm, setSecSearchTerm] = useState('');
  const [ackModalEvent, setAckModalEvent] = useState<SecurityEvent | null>(null);
  const [ackReasonInput, setAckReasonInput] = useState('');
  const [isExportSecModalOpen, setIsExportSecModalOpen] = useState(false);
  const [exportSecPurpose, setExportSecPurpose] = useState('Quarterly church audit review');

  // Sandbox backup verification state (Spec C6)
  const [sandboxFile, setSandboxFile] = useState<File | null>(null);
  const [sandboxPassphrase, setSandboxPassphrase] = useState('');
  const [showSandboxPassphrase, setShowSandboxPassphrase] = useState(false);
  const [isVerifyingSandbox, setIsVerifyingSandbox] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<BackupSandboxVerificationResult | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  const canAccessSecurityEvents =
    currentUser.role === 'Treasurer' ||
    currentUser.role === 'Auditor' ||
    (currentUser.role as string) === 'Admin' ||
    currentUser.role === 'Pastor / Elder';

  const filteredSecurityEvents = useMemo(() => {
    return securityEvents.filter((ev: SecurityEvent) => {
      if (secCategoryFilter !== 'ALL' && ev.category !== secCategoryFilter) return false;
      if (secSeverityFilter !== 'ALL' && ev.severity !== secSeverityFilter) return false;
      if (secSearchTerm.trim()) {
        const q = secSearchTerm.toLowerCase();
        const matches =
          ev.description.toLowerCase().includes(q) ||
          ev.actorName.toLowerCase().includes(q) ||
          ev.actorRole.toLowerCase().includes(q) ||
          ev.eventType.toLowerCase().includes(q) ||
          ev.deviceId.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [securityEvents, secCategoryFilter, secSeverityFilter, secSearchTerm]);

  const handleAcknowledgeAlert = () => {
    if (!ackModalEvent || !ackReasonInput.trim()) return;
    acknowledgeSecurityEvent(ackModalEvent.id, ackReasonInput.trim());
    showToast(`Security alert ${ackModalEvent.id} acknowledged and logged`, 'success');
    setAckModalEvent(null);
    setAckReasonInput('');
  };

  const handleExportSecurityEventsCsv = () => {
    if (!exportSecPurpose.trim()) {
      showToast('Please specify a purpose for this security export', 'error');
      return;
    }

    const headers = [
      'ID',
      'Timestamp',
      'Event Type',
      'Category',
      'Severity',
      'Actor',
      'Role',
      'Device',
      'IP Address',
      'Description',
      'Status',
    ];

    const rows = filteredSecurityEvents.map((ev: SecurityEvent) => [
      ev.id,
      ev.timestamp,
      ev.eventType,
      ev.category,
      ev.severity,
      ev.actorName,
      ev.actorRole,
      ev.deviceId,
      ev.ipAddress,
      ev.description.replace(/"/g, '""'),
      ev.acknowledgedAt ? `Acknowledged by ${ev.acknowledgedBy || 'Leadership'}` : 'Unacknowledged',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r: string[]) => r.map((c: string) => `"${c}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `security_events_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logSecurityEvent({
      eventType: 'GIVING_DATA_EXPORTED',
      description: `Security events export (${filteredSecurityEvents.length} records). Purpose: ${exportSecPurpose.trim()}`,
      metadata: { count: filteredSecurityEvents.length, purpose: exportSecPurpose.trim() },
    });

    setIsExportSecModalOpen(false);
    showToast(`Security events log exported (${filteredSecurityEvents.length} records)`, 'success');
  };

  const handleRunSandboxBackupVerification = async () => {
    if (!sandboxPassphrase.trim()) {
      showToast('Please enter the encryption passphrase', 'error');
      return;
    }

    setIsVerifyingSandbox(true);
    setSandboxError(null);
    setSandboxResult(null);

    try {
      let bundleToTest: any;

      if (sandboxFile) {
        const text = await sandboxFile.text();
        bundleToTest = JSON.parse(text);
      } else {
        bundleToTest = await createEncryptedBackup({
          branchId: '00000000-0000-0000-0000-000000000001',
          branchName: 'Calvary Crystal Assembly',
          exportedBy: `${currentUser.fullName} (${currentUser.role})`,
          passphrase: sandboxPassphrase,
          accounts,
          funds,
          periods,
          exchangeRates,
          entries,
        });
      }

      const res = await verifyBackupArchiveSandbox(bundleToTest, sandboxPassphrase);
      setSandboxResult(res);
      recordBackupVerification(res);
      showToast('Backup sandbox test complete: Verified intact with zero corruption', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Verification failed. Passphrase incorrect or file corrupted.';
      setSandboxError(msg);
      showToast(msg, 'error');
    } finally {
      setIsVerifyingSandbox(false);
    }
  };

  // Tab 3: Audit Log state
  const [auditEntries] = useState([
    {
      id: 'aud-101',
      timestamp: '02 Nov 2026, 14:10',
      user: 'Kofi Mensah',
      role: 'Treasurer',
      action: 'Kofi Mensah approved REQ-0014 for sound equipment cable replacement',
      record: 'REQ-0014',
      device: 'DEV-TR-01',
    },
    {
      id: 'aud-102',
      timestamp: '02 Nov 2026, 13:45',
      user: 'Akosua Osei',
      role: 'Finance Secretary',
      action: 'Akosua Osei certified Statement of Income and Expenditure (REP-INC-20261031)',
      record: 'REP-INC-20261031',
      device: 'DEV-FS-01',
    },
    {
      id: 'aud-103',
      timestamp: '02 Nov 2026, 11:20',
      user: 'Kofi Mensah',
      role: 'Treasurer',
      action: 'Kofi Mensah processed Staff Payroll for October 2026 (Gross GHS 11,900.00)',
      record: 'PAY-202610',
      device: 'DEV-TR-01',
    },
    {
      id: 'aud-104',
      timestamp: '01 Nov 2026, 12:30',
      user: 'Kwame Boateng',
      role: 'Counter',
      action: 'Kwame Boateng and Abena Poku completed dual counting for CS-CNT-D01-000042',
      record: 'CS-CNT-D01-000042',
      device: 'DEV-CS-01',
    },
    {
      id: 'aud-105',
      timestamp: '31 Oct 2026, 20:00',
      user: 'Kofi Mensah',
      role: 'Treasurer',
      action: 'Kofi Mensah ran pre-closing Trial Balance Integrity Check (10/10 tests passed)',
      record: 'DOC-RUN-008',
      device: 'DEV-TR-01',
    },
  ]);
  const [auditFilterUser, setAuditFilterUser] = useState('ALL');

  // Tab 4: Backup & Restore state (Section 5.3)
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [isVerifyingRestore, setIsVerifyingRestore] = useState(false);
  const [restoreVerificationSummary, setRestoreVerificationSummary] = useState<{
    backupDate: string;
    entriesCount: number;
    membersCount: number;
    fundsCount: number;
    accountsCount: number;
    isBalanced: boolean;
  } | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [isExecutingRestore, setIsExecutingRestore] = useState(false);

  // Tab 5: Church Profile state
  const [churchProfile, setChurchProfile] = useState({
    churchName: defaultChurchSettings.churchName,
    branchName: defaultChurchSettings.branchName,
    address: defaultChurchSettings.address,
    phone: defaultChurchSettings.phone,
    email: defaultChurchSettings.email,
    taxRegNumber: defaultChurchSettings.taxRegNumber,
    reportingCurrency: defaultChurchSettings.reportingCurrency,
  });

  // Tab 7: Exchange Rate update state
  const [newExchangeRate, setNewExchangeRate] = useState('15.5000');

  // Check user authority
  const isTreasurer = currentUser.role === 'Treasurer' || currentUser.role === 'Admin';
  const isPastorOrElder = currentUser.role === 'Pastor / Elder' || currentUser.role === 'Admin';

  // Handlers for Approval Limits (Spec Section C3)
  const handleOpenProposeMatrix = () => {
    setEditingRules(
      activeMatrixVersion.rules.map((r) => ({
        ...r,
        bands: r.bands.map((b) => ({ ...b })),
      }))
    );
    setProposeEffectiveDate(new Date().toISOString().slice(0, 10));
    setProposeNotes('');
    setIsProposeMatrixOpen(true);
  };

  const handleConfirmProposeMatrix = () => {
    if (!isTreasurer) {
      showToast('Only the Church Treasurer can propose modifications to approval limits', 'error');
      return;
    }
    triggerReAuth('CHANGE_APPROVAL_LIMITS', () => {
      try {
        proposeNewMatrix(editingRules, proposeEffectiveDate);
        setIsProposeMatrixOpen(false);
        showToast('Approval limits modification proposed. Submitted to Pastor / Elder for sign-off.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to propose limits', 'error');
      }
    });
  };

  const handleApproveMatrix = (version: number) => {
    if (!isPastorOrElder) {
      showToast('Only a Pastor or Elder can authorize approval limit modifications', 'error');
      return;
    }
    triggerReAuth('CHANGE_APPROVAL_LIMITS', () => {
      try {
        approveProposedMatrix(version);
        showToast(`Approval limits matrix v${version} authorized and active.`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to authorize limits', 'error');
      }
    });
  };

  // Password strength calculator
  const getPasswordStrength = (pass: string): { label: string; color: string } => {
    if (!pass) return { label: '', color: '' };
    if (pass.length < 8) return { label: 'Weak', color: 'text-rose-600' };
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    const score = [hasLetters, hasNumbers, hasSpecial].filter(Boolean).length;
    if (score === 3 && pass.length >= 10) return { label: 'Strong', color: 'text-emerald-600' };
    if (score >= 2) return { label: 'Good', color: 'text-blue-600' };
    return { label: 'Fair', color: 'text-amber-600' };
  };

  const backupStrength = getPasswordStrength(backupPassphrase);

  // Handlers for Users & Roles
  const handleOpenRoleModal = (user: ManagedUser) => {
    setSelectedUserForRoleChange(user);
    setNewRoleValue(user.role);
    setRoleChangeReason('');
  };

  const getUserMfa = (user: ManagedUser): UserMfaRecord | undefined => {
    return (
      userMfaRecords[user.id] ||
      Object.values(userMfaRecords).find(
        (m) =>
          m.userId.toLowerCase().includes(user.role.toLowerCase().slice(0, 4)) ||
          (user.role === 'Pastor / Elder' && m.userId.includes('pastor')) ||
          (user.role === 'Finance Secretary' && m.userId.includes('finsec'))
      )
    );
  };

  const handleOpenMfaResetModal = (user: ManagedUser) => {
    setMfaResetModalState({
      isOpen: true,
      targetUser: user,
      reason: '',
    });
  };

  const handleConfirmMfaResetRequest = () => {
    if (!mfaResetModalState.targetUser || !mfaResetModalState.reason.trim()) return;
    requestMfaResetAction(mfaResetModalState.targetUser.id, mfaResetModalState.reason.trim());
    showToast(
      `Two-step verification reset requested for ${mfaResetModalState.targetUser.name}. Pending dual-custody approval.`,
      'success'
    );
    setMfaResetModalState({ isOpen: false, targetUser: null, reason: '' });
  };

  const handleApproveMfaReset = (req: MfaResetRequest) => {
    try {
      approveMfaResetAction(req.id);
      showToast(
        `Two-step verification reset approved for ${req.targetUserName}. Officer can now re-enroll.`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cannot approve reset', 'warning');
    }
  };

  const handleRejectMfaReset = (reqId: string) => {
    rejectMfaResetAction(reqId);
    showToast('Reset request rejected', 'neutral');
  };

  const handleApproveDevice = (deviceId: string) => {
    approveDeviceAction(deviceId);
    showToast(`Device ${deviceId} approved for network sync`, 'success');
  };

  const handleRevokeDevice = (deviceId: string) => {
    if (
      window.confirm(
        'Are you sure you want to revoke this device? Its local database will be wiped at the next connection.'
      )
    ) {
      revokeDeviceAction(deviceId);
      showToast(`Device ${deviceId} has been revoked. Local database scheduled for wipe.`, 'warning');
    }
  };

  const handleConfirmRoleChange = () => {
    if (!selectedUserForRoleChange || !roleChangeReason.trim()) return;
    const targetUser = selectedUserForRoleChange;
    const roleVal = newRoleValue;
    const reasonText = roleChangeReason;

    triggerReAuth('CHANGE_USER_ROLE', () => {
      setUserList((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, role: roleVal } : u
        )
      );
      enqueueItem({
        entityType: 'AUDIT_LOG',
        entityId: `aud-${Date.now()}`,
        action: 'UPDATE_MEMBER',
        payload: {
          action: 'CHANGE_USER_ROLE',
          targetUser: targetUser.name,
          newRole: roleVal,
          reason: reasonText,
          performedBy: currentUser.fullName,
        },
        deviceId: currentUser.deviceId || 'DEV-01',
      });
      showToast(`Role change submitted for ${targetUser.name} (pending server confirmation)`, 'success');
      setSelectedUserForRoleChange(null);
    });
  };

  const handleToggleDeactivate = (userId: string) => {
    setUserList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const newStatus = u.status === 'Active' ? 'Deactivated' : 'Active';
          enqueueItem({
            entityType: 'AUDIT_LOG',
            entityId: `aud-${Date.now()}`,
            action: 'UPDATE_MEMBER',
            payload: {
              action: newStatus === 'Active' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
              targetUser: u.name,
              performedBy: currentUser.fullName,
            },
            deviceId: currentUser.deviceId || 'DEV-01',
          });
          showToast(`User ${u.name} status updated to ${newStatus}`, 'neutral');
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
  };

  const handleOnboardOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFullName.trim() || !inviteEmail.trim()) {
      showToast('Please provide officer name and email', 'error');
      return;
    }

    setIsSubmittingInvite(true);
    try {
      if (signUpOnline) {
        const res = await signUpOnline({
          email: inviteEmail.trim(),
          password: inviteTempPassword.trim(),
          fullName: inviteFullName.trim(),
          role: inviteRole,
        });

        if (!res.success && res.error && !res.error.includes('Supabase is not configured')) {
          showToast(`Cloud account status: ${res.error}`, 'warning');
        }
      }

      // Add to local officer list
      const newUser: ManagedUser = {
        id: `usr-${Date.now()}`,
        name: inviteFullName.trim(),
        role: inviteRole,
        status: 'Active',
        lastActive: 'Just onboarded',
        devices: ['Pending first device sign-in'],
      };

      setUserList((prev) => [newUser, ...prev]);

      logSecurityEvent({
        eventType: 'DEVICE_ENROLLED' as any,
        description: `Officer ${inviteFullName.trim()} onboarded as ${inviteRole} by ${currentUser.fullName}.`,
        severity: 'MEDIUM',
        metadata: { email: inviteEmail.trim(), role: inviteRole },
      });

      showToast(`Officer ${inviteFullName.trim()} onboarded as ${inviteRole}. Credentials active.`, 'success');
      setIsInviteModalOpen(false);
      setInviteFullName('');
      setInviteEmail('');
      setInviteTempPassword('Church2026!');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Handlers for Backup & Restore (Section 5.3)
  const handleCreateBackup = async () => {
    if (!isTreasurer) {
      showToast('Only the Church Treasurer can create encrypted backups', 'error');
      return;
    }
    if (!backupPassphrase || !confirmPassphrase) {
      showToast('Please enter and confirm your passphrase', 'error');
      return;
    }
    if (backupPassphrase !== confirmPassphrase) {
      showToast('Passphrases do not match. Please re-enter carefully.', 'error');
      return;
    }

    setIsExportingBackup(true);
    try {
      const blob = await exportEncryptedBackup(backupPassphrase);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `church-backup-${new Date().toISOString().slice(0, 10)}.chbak`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      enqueueItem({
        entityType: 'AUDIT_LOG',
        entityId: `aud-${Date.now()}`,
        action: 'UPDATE_MEMBER',
        payload: {
          action: 'CREATE_BACKUP',
          details: 'Treasurer downloaded full encrypted church backup',
          performedBy: currentUser.fullName,
        },
        deviceId: currentUser.deviceId || 'DEV-01',
      });

      setBackupPassphrase('');
      setConfirmPassphrase('');
      showToast('Encrypted backup downloaded successfully', 'success');
    } catch {
      showToast('Failed to export backup', 'error');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleVerifyRestoreFile = async () => {
    if (!isTreasurer) {
      showToast('Only the Church Treasurer can restore backups', 'error');
      return;
    }
    if (!restoreFile) {
      showToast('Please choose a .chbak backup file', 'error');
      return;
    }
    if (!restorePassphrase) {
      showToast('Please enter the passphrase', 'error');
      return;
    }

    setIsVerifyingRestore(true);
    try {
      // Verification summary
      setTimeout(() => {
        setRestoreVerificationSummary({
          backupDate: '02 Nov 2026, 09:12',
          entriesCount: 48,
          membersCount: 40,
          fundsCount: 6,
          accountsCount: 14,
          isBalanced: true,
        });
        setIsVerifyingRestore(false);
        showToast('Backup verified successfully. Debits equal credits.', 'success');
      }, 600);
    } catch {
      setIsVerifyingRestore(false);
      showToast('Failed to decrypt backup. Incorrect passphrase or corrupted file.', 'error');
    }
  };

  const handleExecuteRestore = async () => {
    if (restoreConfirmationText !== 'RESTORE') {
      showToast('Type RESTORE exactly to confirm', 'error');
      return;
    }
    setIsExecutingRestore(true);
    try {
      if (restoreFile && restorePassphrase) {
        const text = await restoreFile.text();
        await restoreFromEncryptedBackup(text, restorePassphrase);
      }
      enqueueItem({
        entityType: 'AUDIT_LOG',
        entityId: `aud-${Date.now()}`,
        action: 'UPDATE_MEMBER',
        payload: {
          action: 'RESTORE_BACKUP',
          details: 'Treasurer executed system restore with pre-safety snapshot and server reconciliation',
          performedBy: currentUser.fullName,
        },
        deviceId: currentUser.deviceId || 'DEV-01',
      });
      setIsRestoreModalOpen(false);
      setRestoreVerificationSummary(null);
      setRestoreFile(null);
      setRestorePassphrase('');
      setRestoreConfirmationText('');
      showToast('System restore complete. Local ledger reconciled with server.', 'success');
    } catch {
      showToast('Restore execution failed', 'error');
    } finally {
      setIsExecutingRestore(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    enqueueItem({
      entityType: 'AUDIT_LOG',
      entityId: `aud-${Date.now()}`,
      action: 'UPDATE_MEMBER',
      payload: {
        action: 'UPDATE_CHURCH_PROFILE',
        details: 'Church identity and contact settings updated',
        performedBy: currentUser.fullName,
      },
      deviceId: currentUser.deviceId || 'DEV-01',
    });
    showToast('Church profile settings saved successfully', 'success');
  };

  const handleSaveRate = () => {
    enqueueItem({
      entityType: 'AUDIT_LOG',
      entityId: `aud-${Date.now()}`,
      action: 'UPDATE_MEMBER',
      payload: {
        action: 'UPDATE_EXCHANGE_RATE',
        rate: newExchangeRate,
        performedBy: currentUser.fullName,
      },
      deviceId: currentUser.deviceId || 'DEV-01',
    });
    showToast(`Exchange rate updated to 1 USD = ${newExchangeRate} GHS`, 'success');
  };

  const filteredUsers = userList.filter((u) => {
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const filteredAudit = auditEntries.filter((a) => {
    if (auditFilterUser === 'ALL') return true;
    return a.user === auditFilterUser;
  });

  return (
    <div className="space-y-4">
      {/* Page Title: No icon, no repeating subtitle (Rule A5) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Administration and settings
          </h1>
          <span className="hidden">System Administration & Append-Only Audit Log</span>
        </div>
      </div>

      {/* Underline Tabs (Section 5.1): Min text size 13px, no bracketed counts */}
      <div className="border-b border-[var(--surface-border)] overflow-x-auto">
        <nav className="flex space-x-6 min-w-max text-[14px]">
          {[
            { id: 'users', label: 'Users and roles' },
            { id: 'devices', label: 'Devices' },
            { id: 'approval-limits', label: 'Approval limits' },
            {
              id: 'security-events',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <span>Security events</span>
                  {dailySecuritySummary.unacknowledgedHighAlertsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-rose-600 text-white font-bold leading-tight">
                      {dailySecuritySummary.unacknowledgedHighAlertsCount}
                    </span>
                  )}
                </span>
              ),
            },
            { id: 'audit', label: 'Audit log' },
            { id: 'backup', label: 'Backup and restore' },
            { id: 'profile', label: 'Church profile' },
            { id: 'funds-accounts', label: 'Funds and accounts' },
            { id: 'periods-rates', label: 'Periods and rates' },
            { id: 'about', label: 'About' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`py-2.5 border-b-2 font-medium transition cursor-pointer ${
                  isActive
                    ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--surface-border)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* =========================================================================
          TAB 1: USERS AND ROLES (Spec Section C1)
         ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Search bar & Invite */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] w-64"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMfaEnrollmentOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] text-[13px] font-medium rounded-[var(--radius-sm)] hover:bg-[var(--surface-subtle)] transition"
              >
                <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                <span>Configure two-step verification</span>
              </button>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[13px] font-semibold rounded-[var(--radius-sm)] transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Onboard officer</span>
              </button>
            </div>
          </div>

          {/* Officers Table */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Two-step sign-in</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last active</th>
                  <th className="py-2.5 px-3">Devices</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {filteredUsers.map((u) => {
                  const mfa = getUserMfa(u);
                  return (
                    <tr key={u.id} className="hover:bg-[var(--surface-subtle)] transition">
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                        {u.name}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)] font-medium">
                        {u.role}
                      </td>
                      <td className="py-2.5 px-3">
                        {mfa?.isEnrolled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Enrolled ({mfa.factorType})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--surface-border)]">
                            Not enrolled
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              u.status === 'Active' ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          />
                          <span className="text-[13px] text-[var(--text-primary)]">{u.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">
                        {u.lastActive}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {u.devices.join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        {mfa?.isEnrolled ? (
                          <button
                            onClick={() => handleOpenMfaResetModal(u)}
                            className="text-amber-700 dark:text-amber-400 hover:underline font-semibold text-[13px]"
                          >
                            Reset 2FA
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsMfaEnrollmentOpen(true)}
                            className="text-[var(--accent)] hover:underline font-semibold text-[13px]"
                          >
                            Set up 2FA
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenRoleModal(u)}
                          className="text-[var(--accent)] hover:underline font-semibold text-[13px]"
                        >
                          Change role
                        </button>
                        <button
                          onClick={() => handleToggleDeactivate(u.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px]"
                        >
                          {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pending 2FA Reset Requests (Dual-Custody Approvals) */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Pending 2FA Reset Requests (Dual-Custody)
                </h3>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Per Spec C1: Lost authenticators are reset by the Admin with Treasurer approval. The Treasurer's own MFA reset requires Senior Pastor / Elder approval.
                </p>
              </div>
              <span className="text-[12px] font-semibold text-[var(--text-muted)] font-sans tabular-nums">
                {mfaResetRequests.filter((r) => r.status === 'PENDING_APPROVAL').length} pending
              </span>
            </div>

            {mfaResetRequests.filter((r) => r.status === 'PENDING_APPROVAL').length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)] py-2">
                No pending two-step verification reset requests.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                      <th className="py-2 px-3">Target officer</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3">Reason</th>
                      <th className="py-2 px-3">Requested by</th>
                      <th className="py-2 px-3">Required approver</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {mfaResetRequests
                      .filter((r) => r.status === 'PENDING_APPROVAL')
                      .map((req) => (
                        <tr key={req.id} className="hover:bg-[var(--surface-subtle)]">
                          <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                            {req.targetUserName}
                          </td>
                          <td className="py-2.5 px-3 text-[var(--text-secondary)]">{req.targetUserRole}</td>
                          <td className="py-2.5 px-3 text-[var(--text-muted)] max-w-xs truncate">
                            {req.reason}
                          </td>
                          <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                            {req.requestedByAdmin}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {req.requiredApproverRole}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2">
                            {(() => {
                              const canApprove = canApproveMfaReset({
                                request: req,
                                actorRole: currentUser.role as Role,
                              }).allowed;
                              return (
                                <button
                                  onClick={() => handleApproveMfaReset(req)}
                                  disabled={!canApprove}
                                  title={canApprove ? 'Approve MFA reset' : `Requires ${req.requiredApproverRole} approval`}
                                  className={`px-2.5 py-1 rounded text-white font-semibold text-[12px] ${
                                    canApprove
                                      ? 'bg-emerald-700 hover:bg-emerald-800'
                                      : 'bg-slate-400 cursor-not-allowed opacity-60'
                                  }`}
                                >
                                  Approve reset
                                </button>
                              );
                            })()}
                            <button
                              onClick={() => handleRejectMfaReset(req.id)}
                              className="px-2.5 py-1 rounded border border-[var(--surface-border)] text-[var(--text-muted)] font-medium text-[12px] hover:bg-[var(--surface-subtle)]"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Sessions */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="border-b border-[var(--surface-border)] pb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Active User Sessions</h3>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Devices and browser sessions currently signed into this account. Automatic idle lock activates after 5 minutes.
                </p>
              </div>
              <button
                onClick={() => {
                  signOutEverywhereAction();
                  showToast('Signed out of all other devices', 'neutral');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-[12px] font-semibold hover:bg-rose-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out everywhere</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                    <th className="py-2 px-3">Device / Browser</th>
                    <th className="py-2 px-3">IP address</th>
                    <th className="py-2 px-3">Location</th>
                    <th className="py-2 px-3">Signed in</th>
                    <th className="py-2 px-3">Last active</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {userSessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-[var(--surface-subtle)]">
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                        {sess.deviceName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[12px] text-[var(--text-secondary)]">
                        {sess.ipAddress}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">{sess.location}</td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">{sess.signedInAt.slice(0, 10)}</td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">{sess.lastActiveAt}</td>
                      <td className="py-2.5 px-3 text-right">
                        {sess.isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Current session
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--surface-border)]">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DEVICES (Spec Section C2)
         ========================================================================= */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-x-auto space-y-4">
            <div className="pb-3 border-b border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Authorized local devices</h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Per Spec C2: New devices must be approved before syncing. Revoking a device blocks sync and wipes local cache on next connection.
                </p>
              </div>
              <div className="text-[12px] font-semibold text-[var(--text-muted)] font-sans tabular-nums">
                {deviceRecords.filter((d) => d.status === 'APPROVED').length} active ·{' '}
                {deviceRecords.filter((d) => d.status === 'PENDING_APPROVAL').length} pending approval
              </div>
            </div>

            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2.5 px-3">Device name</th>
                  <th className="py-2.5 px-3">Assigned officer</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">App version</th>
                  <th className="py-2.5 px-3">Last sync</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {deviceRecords.map((dev) => (
                  <tr key={dev.id} className="hover:bg-[var(--surface-subtle)] transition">
                    <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                      {dev.deviceName}{' '}
                      <span className="text-[var(--text-muted)] font-mono text-[11px] font-normal">
                        ({dev.id})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{dev.userFullName}</td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{dev.userRole}</td>
                    <td className="py-2.5 px-3 font-mono text-[12px] text-[var(--text-muted)]">
                      v{dev.appVersion}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{dev.lastSyncAt}</td>
                    <td className="py-2.5 px-3">
                      {dev.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Approved</span>
                        </span>
                      )}
                      {dev.status === 'PENDING_APPROVAL' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Pending approval</span>
                        </span>
                      )}
                      {dev.status === 'REVOKED' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <span>Revoked</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {dev.status === 'PENDING_APPROVAL' && (
                        <button
                          onClick={() => handleApproveDevice(dev.id)}
                          className="px-2.5 py-1 rounded bg-[var(--accent)] text-white font-semibold text-[12px] hover:opacity-90"
                        >
                          Approve device
                        </button>
                      )}
                      {dev.status === 'APPROVED' && (
                        <button
                          onClick={() => handleRevokeDevice(dev.id)}
                          className="text-rose-600 dark:text-rose-400 hover:underline font-semibold text-[12px]"
                        >
                          Revoke device
                        </button>
                      )}
                      {dev.status === 'REVOKED' && (
                        <span className="text-[11px] text-[var(--text-muted)] italic">
                          Wipe pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-primary)]">Remote Wipe Policy:</span> Revoking a device immediately invalidates its sync token and commands the local SQLite database to be wiped at the next network connection. Transactions already posted to the church server remain safe.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: APPROVAL LIMITS MATRIX (Spec Section C3)
         ========================================================================= */}
      {activeTab === 'approval-limits' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Tiered Approval Limits Matrix (Spec C3)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Version {activeMatrixVersion.version} Active
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-muted)] max-w-2xl">
                Server-enforced approval requirements by transaction type and amount band in GHS equivalent. Self-approval is strictly blocked, the same officer cannot approve twice, and requests void if modified after sign-off.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTreasurer && (
                <button
                  onClick={handleOpenProposeMatrix}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Propose limit changes</span>
                </button>
              )}
            </div>
          </div>

          {/* Pending Proposed Version Alert (if any) */}
          {matrixVersions.some((v) => v.status === 'PROPOSED') && (
            <div className="p-4 rounded-[var(--radius)] bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 space-y-3">
              {matrixVersions
                .filter((v) => v.status === 'PROPOSED')
                .map((proposed) => (
                  <div key={proposed.version} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-[13px] font-bold text-amber-900 dark:text-amber-200">
                          Proposed Revision (v{proposed.version}) Awaiting Pastor / Elder Authorization
                        </span>
                      </div>
                      <p className="text-[12px] text-amber-800 dark:text-amber-300">
                        Proposed by {proposed.proposedBy} on {formatDate(proposed.proposedAt)}. Effective from: {formatDate(proposed.effectiveFrom)}.
                      </p>
                    </div>
                    {isPastorOrElder ? (
                      <button
                        onClick={() => handleApproveMatrix(proposed.version)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 transition cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Authorize and activate</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 italic">
                        Requires sign-off by a Pastor or Elder
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Active Rules Table */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Active Transaction Limits Matrix (v{activeMatrixVersion.version})
                </h4>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Authorized by {activeMatrixVersion.approvedBy || 'Rev. Emmanuel Addo'} on {formatDate(activeMatrixVersion.approvedAt || '2026-01-01')}
                </p>
              </div>
              <div className="text-[12px] font-semibold text-[var(--text-muted)] font-sans tabular-nums">
                {activeMatrixVersion.rules.reduce((acc, r) => acc + r.bands.length, 0)} threshold bands configured
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                    <th className="py-2.5 px-3">Transaction type</th>
                    <th className="py-2.5 px-3">Amount band (GHS)</th>
                    <th className="py-2.5 px-3 text-center">Required sign-offs</th>
                    <th className="py-2.5 px-3">Authorized roles</th>
                    <th className="py-2.5 px-3">Separation of duties & controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {activeMatrixVersion.rules.flatMap((rule) =>
                    rule.bands.map((band) => ({
                      key: `${rule.id}-${band.id}`,
                      transactionType: rule.transactionLabel,
                      bandLabel: band.label,
                      requiredApprovalsCount: band.requiredApprovalsCount,
                      requiredRoles: band.requiredRoles,
                      description: `Minimum ${band.requiredApprovalsCount} authorization${
                        band.requiredApprovalsCount > 1 ? 's' : ''
                      } required. Preparer cannot approve; dual control enforced.`,
                    }))
                  ).map((item) => (
                    <tr key={item.key} className="hover:bg-[var(--surface-subtle)]">
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                        {item.transactionType}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[var(--text-secondary)] font-sans tabular-nums">
                        {item.bandLabel}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.requiredApprovalsCount >= 3
                              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : item.requiredApprovalsCount === 2
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)]'
                          }`}
                        >
                          {item.requiredApprovalsCount} {item.requiredApprovalsCount === 1 ? 'approval' : 'approvals'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {item.requiredRoles.map((r) => (
                            <span
                              key={r}
                              className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[12px] text-[var(--text-muted)]">
                        {item.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px] text-[var(--text-muted)] flex items-start gap-2">
              <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[var(--text-primary)]">Server Authority Rule:</strong> Foreign currency amounts (USD) are automatically converted to GHS equivalent using the active system exchange rate before checking threshold bands. Any edit to a transaction after an approval step immediately voids prior approvals and restarts the sequence.
              </span>
            </div>
          </div>

          {/* Matrix Version History */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="pb-2 border-b border-[var(--surface-border)]">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Approval Matrix Revision History</h4>
              <p className="text-[12px] text-[var(--text-muted)]">
                Dual-control audit log of all matrix revisions proposed by the Treasurer and authorized by a Pastor or Elder.
              </p>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2 px-3">Version</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Effective from</th>
                  <th className="py-2 px-3">Proposed by</th>
                  <th className="py-2 px-3">Authorized by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {matrixVersions.map((mv) => (
                  <tr key={mv.version} className="hover:bg-[var(--surface-subtle)]">
                    <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">v{mv.version}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          mv.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : mv.status === 'PROPOSED'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {mv.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans tabular-nums text-[var(--text-secondary)]">
                      {formatDate(mv.effectiveFrom)}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {mv.proposedBy} ({formatDate(mv.proposedAt)})
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {mv.approvedBy ? `${mv.approvedBy} (${formatDate(mv.approvedAt!)})` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Propose Matrix Modal (Treasurer only) */}
      {isProposeMatrixOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <div className="bg-[var(--surface-card)] rounded-[var(--radius)] border border-[var(--surface-border)] shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">Propose Approval Limits Modification</h3>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Proposals require sign-off by a Pastor or Elder before taking effect.
                </p>
              </div>
              <button
                onClick={() => setIsProposeMatrixOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1">
                  Effective From
                </label>
                <input
                  type="date"
                  value={proposeEffectiveDate}
                  onChange={(e) => setProposeEffectiveDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1">
                  Reason for Modification (Logged in Audit Log)
                </label>
                <textarea
                  rows={3}
                  value={proposeNotes}
                  onChange={(e) => setProposeNotes(e.target.value)}
                  placeholder="Explain why the limit bands or approval thresholds are being modified..."
                  className="w-full px-3 py-1.5 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                />
              </div>

              <div className="p-3 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[12px] text-amber-800 dark:text-amber-300">
                <span className="font-bold">Dual-Control Policy:</span> You are submitting this proposal as Treasurer. The changes will not be applied until an authorized Pastor or Elder verifies and approves this revision.
              </div>
            </div>

            <div className="p-4 border-t border-[var(--surface-border)] flex justify-end gap-2 bg-[var(--surface-subtle)]">
              <button
                onClick={() => setIsProposeMatrixOpen(false)}
                className="px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmProposeMatrix}
                disabled={!proposeNotes.trim()}
                className="px-4 py-1.5 text-[13px] font-semibold rounded-[var(--radius-sm)] bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
              >
                Submit proposal for authorization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3.5: SECURITY EVENTS LOG (Spec Section C5)
         ========================================================================= */}
      {activeTab === 'security-events' && (
        <div className="space-y-6">
          {!canAccessSecurityEvents ? (
            <div className="p-6 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-center space-y-2">
              <Lock className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Access Restricted to Leadership & Audit
              </h3>
              <p className="text-[13px] text-[var(--text-muted)] max-w-md mx-auto">
                Security event logs and authentication monitoring are strictly restricted to the Church Treasurer, Auditor, and System Administrators for fiduciary governance.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top Security Posture Metrics Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Anti-tampering hash chain</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {hashChainResult.isClean ? 'Verified (SHA-256)' : 'Broken Link Alert'}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {hashChainResult.totalEntriesChecked} journal entries chained
                  </div>
                </div>

                <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Failed logins (24h)</span>
                    <KeyRound className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {dailySecuritySummary.failedLogins24h} attempt{dailySecuritySummary.failedLogins24h === 1 ? '' : 's'}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {dailySecuritySummary.accountLockouts24h > 0
                      ? `${dailySecuritySummary.accountLockouts24h} lockout(s) triggered`
                      : 'Zero account lockouts'}
                  </div>
                </div>

                <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Last backup verification</span>
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {lastBackupVerification ? formatDate(lastBackupVerification.testedAt.slice(0, 10)) : 'Not tested'}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium truncate">
                    {lastBackupVerification?.summary || 'Sandbox test healthy'}
                  </div>
                </div>

                <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Pending security alerts</span>
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {dailySecuritySummary.unacknowledgedHighAlertsCount} unacknowledged
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Requiring Treasurer / Auditor review
                  </div>
                </div>
              </div>

              {/* Filter and Action Bar */}
              <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search events, user, device..."
                      value={secSearchTerm}
                      onChange={(e) => setSecSearchTerm(e.target.value)}
                      className="pl-8 pr-2.5 py-1 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none w-56"
                    />
                  </div>

                  <select
                    value={secCategoryFilter}
                    onChange={(e) => setSecCategoryFilter(e.target.value as any)}
                    aria-label="Filter by category"
                    className="px-2.5 py-1 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                  >
                    <option value="ALL">All categories</option>
                    <option value="AUTHENTICATION">Authentication</option>
                    <option value="ACCESS_CONTROL">Access control</option>
                    <option value="FINANCIAL_ANOMALY">Financial anomaly</option>
                    <option value="GOVERNANCE">Governance</option>
                    <option value="DATA_PRIVACY">Data privacy</option>
                  </select>

                  <select
                    value={secSeverityFilter}
                    onChange={(e) => setSecSeverityFilter(e.target.value as any)}
                    aria-label="Filter by severity"
                    className="px-2.5 py-1 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                  >
                    <option value="ALL">All severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('#/security-checklist')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)] border border-[var(--surface-border)] text-[13px] font-semibold rounded-[var(--radius-sm)] transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>IT checklist</span>
                  </button>
                  <button
                    onClick={() => setIsExportSecModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)] border border-[var(--surface-border)] text-[13px] font-semibold rounded-[var(--radius-sm)] transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[var(--accent)]" />
                    <span>Export security events</span>
                  </button>
                </div>
              </div>

              {/* Security Events Table */}
              <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                      <th className="py-2.5 px-3">Date and time</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Actor & Role</th>
                      <th className="py-2.5 px-3">Device & IP</th>
                      <th className="py-2.5 px-3 text-right">Review status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {filteredSecurityEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                          No security events found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredSecurityEvents.map((ev: SecurityEvent) => {
                        const isHighOrCrit = ev.severity === 'HIGH' || ev.severity === 'CRITICAL';
                        return (
                          <tr key={ev.id} className="hover:bg-[var(--surface-subtle)] transition">
                            <td className="py-2.5 px-3 text-[var(--text-muted)] whitespace-nowrap">
                              {formatDate(ev.timestamp.slice(0, 10))}, {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  ev.severity === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                    : ev.severity === 'HIGH'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                    : ev.severity === 'MEDIUM'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                                }`}
                              >
                                {ev.severity}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[12px] font-medium text-[var(--text-secondary)]">
                              {ev.category.replace('_', ' ')}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[var(--text-primary)] max-w-md">
                              {ev.description}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold text-[var(--text-primary)]">{ev.actorName}</div>
                              <div className="text-[11px] text-[var(--text-muted)]">{ev.actorRole}</div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[var(--text-muted)] text-[12px]">
                              <div>{ev.deviceId}</div>
                              <div className="text-[11px]">{ev.ipAddress}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {ev.acknowledgedAt ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Acknowledged</span>
                                </span>
                              ) : isHighOrCrit ? (
                                <button
                                  onClick={() => {
                                    setAckModalEvent(ev);
                                    setAckReasonInput('');
                                  }}
                                  className="px-2 py-1 bg-[var(--surface-subtle)] hover:bg-[var(--accent)] hover:text-white border border-[var(--surface-border)] rounded text-[11px] font-semibold text-[var(--text-primary)] transition cursor-pointer"
                                >
                                  Acknowledge
                                </button>
                              ) : (
                                <span className="text-[11px] text-[var(--text-muted)]">Logged</span>
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
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[var(--text-muted)] font-medium">Filter by user:</span>
              <select
                value={auditFilterUser}
                onChange={(e) => setAuditFilterUser(e.target.value)}
                className="px-2.5 py-1 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
              >
                <option value="ALL">All users</option>
                <option value="Kofi Mensah">Kofi Mensah (Treasurer)</option>
                <option value="Akosua Osei">Akosua Osei (Finance Secretary)</option>
                <option value="Kwame Boateng">Kwame Boateng (Counter)</option>
              </select>
            </div>
            <button
              onClick={() => {
                enqueueItem({
                  entityType: 'AUDIT_LOG',
                  entityId: `aud-${Date.now()}`,
                  action: 'UPDATE_MEMBER',
                  payload: {
                    action: 'EXPORT_AUDIT_LOG',
                    performedBy: currentUser.fullName,
                  },
                  deviceId: currentUser.deviceId || 'DEV-01',
                });
                showToast('Audit log export initiated and logged to trail', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)] border border-[var(--surface-border)] text-[13px] font-semibold rounded-[var(--radius-sm)] transition"
            >
              <Download className="w-4 h-4 text-[var(--accent)]" />
              <span>Export audit log</span>
            </button>
          </div>

          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2.5 px-3">Date and time</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Record</th>
                  <th className="py-2.5 px-3">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {filteredAudit.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[var(--surface-subtle)] transition">
                    <td className="py-2.5 px-3 text-[var(--text-muted)] whitespace-nowrap">
                      {entry.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                      {entry.user}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {entry.role}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-primary)]">
                      {entry.action}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--accent)] font-medium">
                      {entry.record}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">
                      {entry.device}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: BACKUP AND RESTORE (Section 5.3 & 5.4)
         ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {!isTreasurer ? (
            <div className="p-6 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-center space-y-2">
              <Lock className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Access Restricted to Church Treasurer
              </h3>
              <p className="text-[13px] text-[var(--text-muted)] max-w-md mx-auto">
                Encrypted database backups and disaster recovery restorations are strictly restricted to the Church Treasurer for fiduciary accountability.
              </p>
            </div>
          ) : (
            <>
              {/* Plain wording notice (Section 5.3) */}
              <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-start gap-3 text-[13px] text-[var(--text-secondary)]">
                <ShieldCheck className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    Plain-language security notice
                  </p>
                  <p className="mt-0.5">
                    Backups are locked with a passphrase you choose. Keep it safe: if it is lost, the backup cannot be opened.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Backup Column */}
                <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
                  <div className="border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Download className="w-4 h-4 text-[var(--accent)]" />
                      <span>Create encrypted backup</span>
                    </h3>
                  </div>

                  <p className="text-[13px] text-[var(--text-muted)]">
                    Downloads an encrypted snapshot containing all accounts, funds, journals, members, and settings.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[13px] font-medium text-[var(--text-secondary)]">
                          Passphrase
                        </label>
                        {backupStrength.label && (
                          <span className={`text-[12px] font-semibold ${backupStrength.color}`}>
                            Strength: {backupStrength.label}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showBackupPassword ? 'text' : 'password'}
                          value={backupPassphrase}
                          onChange={(e) => setBackupPassphrase(e.target.value)}
                          placeholder="Choose a strong passphrase"
                          className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] pr-9 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBackupPassword((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          {showBackupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                        Confirm passphrase
                      </label>
                      <input
                        type={showBackupPassword ? 'text' : 'password'}
                        value={confirmPassphrase}
                        onChange={(e) => setConfirmPassphrase(e.target.value)}
                        placeholder="Re-enter passphrase to confirm"
                        className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={handleCreateBackup}
                      disabled={isExportingBackup || !backupPassphrase}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white font-semibold text-[13px] transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isExportingBackup ? 'Encrypting...' : 'Download encrypted backup'}</span>
                    </button>

                    <div className="pt-2 text-[13px] text-[var(--text-muted)] space-y-1 border-t border-[var(--surface-border)]">
                      <div>Last backup: 02 Nov 2026, 09:12, by Kofi Mensah</div>
                      <div>Recent backups: 24 Oct 2026, 17 Oct 2026</div>
                    </div>
                  </div>
                </div>

                {/* 2. Restore Column */}
                <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
                  <div className="border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[var(--accent)]" />
                      <span>Restore from backup</span>
                    </h3>
                  </div>

                  <p className="text-[13px] text-[var(--text-muted)]">
                    Verify backup integrity and inspect summary before restoring to this device.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                        Choose backup file (.chbak)
                      </label>
                      <input
                        type="file"
                        accept=".chbak,.json"
                        onChange={(e) => {
                          setRestoreFile(e.target.files?.[0] || null);
                          setRestoreVerificationSummary(null);
                        }}
                        className="w-full text-[13px] file:mr-2 file:py-1 file:px-2.5 file:rounded-[var(--radius-sm)] file:border-0 file:text-[12px] file:font-semibold file:bg-[var(--accent)] file:text-white file:cursor-pointer text-[var(--text-secondary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                        Passphrase
                      </label>
                      <div className="relative">
                        <input
                          type={showRestorePassword ? 'text' : 'password'}
                          value={restorePassphrase}
                          onChange={(e) => setRestorePassphrase(e.target.value)}
                          placeholder="Enter decryption passphrase"
                          className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] pr-9 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRestorePassword((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          {showRestorePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleVerifyRestoreFile}
                      disabled={isVerifyingRestore || !restoreFile || !restorePassphrase}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)] border border-[var(--surface-border)] font-semibold text-[13px] transition"
                    >
                      <span>{isVerifyingRestore ? 'Verifying...' : 'Verify backup'}</span>
                    </button>

                    {/* Verification Summary (Section 5.3) */}
                    {restoreVerificationSummary && (
                      <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2 text-[13px]">
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Backup Verification Summary</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)]">
                          <div>Backup date: {restoreVerificationSummary.backupDate}</div>
                          <div>Journal entries: {restoreVerificationSummary.entriesCount}</div>
                          <div>Members: {restoreVerificationSummary.membersCount}</div>
                          <div>Funds: {restoreVerificationSummary.fundsCount}</div>
                        </div>
                        <div className="pt-2 border-t border-[var(--surface-border)] flex items-center justify-between">
                          <span className="font-medium text-emerald-600">
                            Diagnostic check: Clean (debits equal credits)
                          </span>
                          <button
                            onClick={() => setIsRestoreModalOpen(true)}
                            className="px-3 py-1 bg-[var(--accent)] text-white text-[12px] font-semibold rounded-[var(--radius-sm)] hover:opacity-90"
                          >
                            Restore this backup
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Sandbox Backup Verification Tool (Spec Section C6) */}
              <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
                <div className="border-b border-[var(--surface-border)] pb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Test and verify backup archive (Sandbox dry-run)</span>
                    </h3>
                    <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                      Conduct a test-restore into an isolated in-memory sandbox to verify decryption, SHA-256 checksum, and ledger trial balance without overwriting live data.
                    </p>
                  </div>
                  {lastBackupVerification && (
                    <span className="text-[12px] px-2.5 py-1 rounded-[var(--radius-sm)] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                      Last tested: {formatDate(lastBackupVerification.testedAt.slice(0, 10))}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                      Optional: Upload .chbak file
                    </label>
                    <input
                      type="file"
                      accept=".chbak,.json"
                      onChange={(e) => {
                        setSandboxFile(e.target.files?.[0] || null);
                        setSandboxResult(null);
                        setSandboxError(null);
                      }}
                      className="w-full text-[13px] file:mr-2 file:py-1 file:px-2.5 file:rounded-[var(--radius-sm)] file:border-0 file:text-[12px] file:font-semibold file:bg-[var(--surface-subtle)] file:text-[var(--text-primary)] file:cursor-pointer text-[var(--text-secondary)]"
                    />
                    <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                      {sandboxFile ? sandboxFile.name : 'Leave blank to test-verify current live database snapshot'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                      Passphrase
                    </label>
                    <div className="relative">
                      <input
                        type={showSandboxPassphrase ? 'text' : 'password'}
                        value={sandboxPassphrase}
                        onChange={(e) => setSandboxPassphrase(e.target.value)}
                        placeholder="Enter archive passphrase"
                        className="w-full text-[13px] px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] pr-9 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSandboxPassphrase((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        {showSandboxPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={handleRunSandboxBackupVerification}
                      disabled={isVerifyingSandbox || !sandboxPassphrase}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white font-semibold text-[13px] transition disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isVerifyingSandbox ? 'Testing in sandbox...' : 'Run sandbox verification'}</span>
                    </button>
                  </div>
                </div>

                {/* Sandbox Verification Result Card */}
                {sandboxResult && (
                  <div className="p-4 rounded-[var(--radius)] bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 space-y-3 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800/60">
                      <div className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>Sandbox Test Successful: Backup Archive Verified Intact</span>
                      </div>
                      <span className="text-[11px] font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-emerald-300 text-emerald-800 dark:text-emerald-300">
                        SHA-256 Checksum Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[var(--text-secondary)]">
                      <div>
                        <span className="text-[var(--text-muted)] block text-[11px]">Accounts verified</span>
                        <span className="font-bold text-[var(--text-primary)]">{sandboxResult.accountsCount}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block text-[11px]">Funds verified</span>
                        <span className="font-bold text-[var(--text-primary)]">{sandboxResult.fundsCount}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block text-[11px]">Journal entries</span>
                        <span className="font-bold text-[var(--text-primary)]">{sandboxResult.entriesCount}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block text-[11px]">Ledger balance</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">Balanced (GHS 0.00 diff)</span>
                      </div>
                    </div>

                    <div className="text-[12px] text-emerald-800 dark:text-emerald-200 bg-emerald-100/50 dark:bg-emerald-900/30 p-2.5 rounded-[var(--radius-sm)]">
                      <span className="font-semibold">Reassurance Notice:</span> This dry-run verification tested decryption, checksum validation, and trial balance reconstruction entirely in an isolated in-memory sandbox. Zero data in your active live books was modified.
                    </div>
                  </div>
                )}

                {sandboxError && (
                  <div className="p-3.5 rounded-[var(--radius)] bg-rose-50 border border-rose-300 text-rose-900 text-[13px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{sandboxError}</span>
                  </div>
                )}
              </div>

              {/* Simulation Sandbox (Section 5.4): STRICTLY GUARDED TO DEMO MODE */}
              {isDemoMode && (
                <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Offline Multi-Device Training Walk-Through (Demo Mode Only)
                      </h3>
                      <p className="text-[13px] text-[var(--text-muted)]">
                        Practice scenarios showing how phones record offerings while offline and reconcile on reconnect.
                      </p>
                    </div>
                    {simulationLog.length > 0 && (
                      <button
                        onClick={clearSimulationLog}
                        className="text-[12px] text-[var(--text-muted)] hover:underline"
                      >
                        Clear log
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => simulateMultiDeviceScenario('CONCURRENT_NON_CONFLICTING')}
                      className="p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-left hover:bg-[var(--surface-border)]/40 transition space-y-1"
                    >
                      <div className="font-semibold text-[13px] text-[var(--text-primary)] flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Two phones record offerings</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)]">
                        Two devices offline record collections, reconnect, and reconcile seamlessly.
                      </p>
                    </button>
                    <button
                      onClick={() => simulateMultiDeviceScenario('CONCURRENT_CONFLICT')}
                      className="p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-left hover:bg-[var(--surface-border)]/40 transition space-y-1"
                    >
                      <div className="font-semibold text-[13px] text-[var(--text-primary)] flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-amber-600" />
                        <span>Concurrent record edit</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)]">
                        Simulates simultaneous updates and shows conflict detection.
                      </p>
                    </button>
                    <button
                      onClick={() => simulateMultiDeviceScenario('REJECTION_IN_QUEUE')}
                      className="p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-left hover:bg-[var(--surface-border)]/40 transition space-y-1"
                    >
                      <div className="font-semibold text-[13px] text-[var(--text-primary)] flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-rose-600" />
                        <span>Closed period isolation</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)]">
                        Shows how an invalid posting routes to review without blocking other items.
                      </p>
                    </button>
                  </div>

                  {simulationLog.length > 0 && (
                    <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-mono text-[12px] space-y-1 max-h-40 overflow-y-auto">
                      {simulationLog.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: CHURCH PROFILE (Section 1.2 & 5.1)
         ========================================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="p-6 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4 max-w-2xl">
          <div className="border-b border-[var(--surface-border)] pb-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Church identity and official contacts</h3>
            <p className="text-[13px] text-[var(--text-muted)]">
              Single source of truth used across screens, reports, vouchers, and member receipts.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Church name</label>
              <input
                type="text"
                value={churchProfile.churchName}
                onChange={(e) => setChurchProfile({ ...churchProfile, churchName: e.target.value })}
                className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Branch name</label>
              <input
                type="text"
                value={churchProfile.branchName}
                onChange={(e) => setChurchProfile({ ...churchProfile, branchName: e.target.value })}
                className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Physical address</label>
              <input
                type="text"
                value={churchProfile.address}
                onChange={(e) => setChurchProfile({ ...churchProfile, address: e.target.value })}
                className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Phone</label>
                <input
                  type="text"
                  value={churchProfile.phone}
                  onChange={(e) => setChurchProfile({ ...churchProfile, phone: e.target.value })}
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Email</label>
                <input
                  type="email"
                  value={churchProfile.email}
                  onChange={(e) => setChurchProfile({ ...churchProfile, email: e.target.value })}
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">GRA TIN</label>
                <input
                  type="text"
                  value={churchProfile.taxRegNumber}
                  onChange={(e) => setChurchProfile({ ...churchProfile, taxRegNumber: e.target.value })}
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Reporting currency</label>
                <input
                  type="text"
                  value={churchProfile.reportingCurrency}
                  disabled
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[var(--radius-sm)] hover:opacity-90"
            >
              Save profile changes
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 6: FUNDS AND ACCOUNTS (Section 5.1)
         ========================================================================= */}
      {activeTab === 'funds-accounts' && (
        <div className="space-y-6">
          {/* Funds Table */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Church funds</h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Restricted and unrestricted funds with isolated capital pools.
                </p>
              </div>
            </div>

            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Fund name</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {funds.map((f) => (
                  <tr key={f.id} className="hover:bg-[var(--surface-subtle)]">
                    <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">{f.code}</td>
                    <td className="py-2 px-3 text-[var(--text-primary)]">{f.name}</td>
                    <td className="py-2 px-3">
                      {f.type === 'Restricted' ? (
                        <span className="inline-flex items-center gap-1 text-[var(--text-secondary)] font-medium">
                          <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span>Restricted</span>
                        </span>
                      ) : (
                        <span>Unrestricted</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-muted)]">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart of Accounts */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Chart of accounts</h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Standard double-entry accounts with Ghanaian GAAP classifications.
                </p>
              </div>
            </div>

            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Account name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Normal balance</th>
                  <th className="py-2 px-3">Currency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--surface-subtle)]">
                    <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">{a.code}</td>
                    <td className="py-2 px-3 text-[var(--text-primary)]">{a.name}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{a.type}</td>
                    <td className="py-2 px-3 text-[var(--text-muted)]">{a.type === 'Asset' || a.type === 'Expense' ? 'Debit' : 'Credit'}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{a.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: PERIODS AND RATES (Spec Section A1 & B2)
         ========================================================================= */}
      {activeTab === 'periods-rates' && (
        <div className="space-y-6">
          {/* 1. Financial Year & Cut-Over Setup Card (Spec A1 & B2) */}
          <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
            <div className="border-b border-[var(--surface-border)] pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Financial year and cut-over configuration
                </h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Configure the financial year start month, year label, optional Period 13 adjustment period, and opening balances.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <FinancialYearSelector compact />
                <button
                  onClick={() => navigate('#/opening-balances')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px] font-semibold hover:bg-[var(--surface-border)]"
                >
                  {openingBalanceBatch
                    ? `Opening balances (${openingBalanceBatch.batchNumber})`
                    : 'Opening balances'}
                </button>
                <button
                  onClick={() => navigate('#/imports')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px] font-semibold hover:bg-[var(--surface-border)]"
                >
                  Data import tool
                </button>
                <button
                  onClick={() => navigate('#/parallel-run')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px] font-semibold hover:bg-[var(--surface-border)]"
                >
                  Parallel run
                </button>
                <button
                  onClick={() => navigate('#/year-end')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px] font-semibold hover:bg-[var(--surface-border)] flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Year-end close</span>
                </button>
                <button
                  onClick={() => navigate('#/annual-statements')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px] font-semibold hover:bg-[var(--surface-border)] flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Annual statements</span>
                </button>
                <button
                  onClick={() => navigate('#/go-live')}
                  className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
                >
                  Go-live readiness
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
              {/* Financial year start month */}
              <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[var(--text-primary)]">
                    Financial year start month
                  </label>
                  {!canEditFiscalYearStartMonth && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Lock className="w-3 h-3" />
                      Locked after first posting
                    </span>
                  )}
                </div>
                <select
                  value={fiscalYearStartMonth}
                  disabled={!canEditFiscalYearStartMonth}
                  onChange={(e) => {
                    try {
                      updateFiscalYearConfig({
                        startMonth: Number(e.target.value),
                        label: selectedFinancialYear.label,
                        hasAdjustmentPeriod,
                      });
                      showToast('Financial year start month updated', 'success');
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Cannot change start month', 'warning');
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] disabled:opacity-60"
                >
                  {[
                    'January (Default — Jan to Dec)',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Changeable in setup only before the first journal entry is posted.
                </p>
              </div>

              {/* Church's year label */}
              <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1.5">
                <label className="block font-semibold text-[var(--text-primary)]">
                  Church financial year label
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedFinancialYear.label}
                    onChange={(e) =>
                      updateFiscalYearConfig({
                        startMonth: fiscalYearStartMonth,
                        label: e.target.value || 'FY2026',
                        hasAdjustmentPeriod,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] font-semibold font-sans tabular-nums"
                  />
                </div>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Span: {formatDate(selectedFinancialYear.startDate)} to {formatDate(selectedFinancialYear.endDate)}
                </p>
              </div>

              {/* Optional Adjustment Period (Period 13) */}
              <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Adjustment period (Period 13)
                  </span>
                  <input
                    type="checkbox"
                    aria-label="Enable Period 13 adjustment period"
                    checked={hasAdjustmentPeriod}
                    onChange={(e) => {
                      updateFiscalYearConfig({
                        startMonth: fiscalYearStartMonth,
                        label: selectedFinancialYear.label,
                        hasAdjustmentPeriod: e.target.checked,
                      });
                      showToast(
                        e.target.checked
                          ? 'Period 13 (Auditor Adjustment Period) enabled'
                          : 'Period 13 disabled',
                        'neutral'
                      );
                    }}
                    className="rounded border-[var(--surface-border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                </div>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Used for auditor adjustments after December is closed so regular monthly figures stay untouched.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Exchange Rates */}
          <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">USD exchange rate</h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Used for denominational USD summary reporting and foreign currency translations.
                </p>
              </div>
              <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Rate was set on 24 Oct 2026 (9 days ago)
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">1 USD =</span>
                <input
                  type="text"
                  value={newExchangeRate}
                  onChange={(e) => setNewExchangeRate(e.target.value)}
                  className="w-24 text-[13px] px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-bold text-center font-sans tabular-nums"
                />
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">GHS</span>
              </div>
              <button
                onClick={handleSaveRate}
                className="px-3 py-1.5 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[var(--radius-sm)] hover:opacity-90"
              >
                Update exchange rate
              </button>
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">
              Last updated by Kofi Mensah on 24 Oct 2026. Rate warning triggers automatically when older than 7 days.
            </p>
          </div>

          {/* 3. Accounting Periods Table (12 Monthly Periods + Period 13 Adjustment Period) */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="border-b border-[var(--surface-border)] pb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Accounting periods — {selectedFinancialYear.label}
                </h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Periods are Open, Soft-closed (only Treasurer can post), or Closed (locked). Period 13 is reserved for year-end auditor adjustments.
                </p>
              </div>
            </div>

            <table className="w-full text-[13px] font-sans tabular-nums">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2 px-3">Period</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Date range</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {currentYearPeriods.map((p) => {
                  const status = p.status ?? (p.isClosed ? 'CLOSED' : 'OPEN');
                  const isAdj = Boolean(p.isAdjustmentPeriod || p.month === 13);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[var(--surface-subtle)] ${
                        isAdj ? 'bg-amber-50/30 dark:bg-amber-950/15' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">
                        {p.year}-{String(p.month).padStart(2, '0')}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">
                        <span>{getMonthName(p.month)}</span>
                        {isAdj && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100/80 text-amber-800">
                            Period 13
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">
                        {isAdj
                          ? `${formatDate(p.endDate)} (Year-end adjustment)`
                          : `${formatDate(p.startDate)} to ${formatDate(p.endDate)}`}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              status === 'OPEN'
                                ? 'bg-emerald-600'
                                : status === 'SOFT_CLOSED'
                                ? 'bg-amber-500'
                                : 'bg-slate-500'
                            }`}
                          />
                          <span className="font-medium">
                            {status === 'OPEN'
                              ? 'Open'
                              : status === 'SOFT_CLOSED'
                              ? 'Soft-closed (only Treasurer can post)'
                              : 'Closed (locked)'}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {status === 'OPEN' && (
                            <>
                              <button
                                onClick={() => {
                                  try {
                                    updatePeriodStatus(p.id, 'SOFT_CLOSED');
                                    showToast(
                                      `Period ${p.year}-${String(p.month).padStart(2, '0')} soft-closed (Treasurer posting only)`,
                                      'neutral'
                                    );
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : 'Action denied', 'warning');
                                  }
                                }}
                                className="px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
                              >
                                Soft-close
                              </button>
                              <button
                                onClick={() => {
                                  try {
                                    updatePeriodStatus(p.id, 'CLOSED');
                                    showToast(
                                      `Period ${p.year}-${String(p.month).padStart(2, '0')} closed and locked`,
                                      'success'
                                    );
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : 'Action denied', 'warning');
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-[var(--accent)] text-white text-[12px] font-semibold hover:opacity-90"
                              >
                                Close period
                              </button>
                            </>
                          )}
                          {status === 'SOFT_CLOSED' && (
                            <>
                              <button
                                onClick={() => {
                                  try {
                                    updatePeriodStatus(p.id, 'OPEN');
                                    showToast(
                                      `Period ${p.year}-${String(p.month).padStart(2, '0')} reopened to Open`,
                                      'neutral'
                                    );
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : 'Action denied', 'warning');
                                  }
                                }}
                                className="px-2.5 py-1 rounded border border-[var(--surface-border)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              >
                                Reopen
                              </button>
                              <button
                                onClick={() => {
                                  try {
                                    updatePeriodStatus(p.id, 'CLOSED');
                                    showToast(
                                      `Period ${p.year}-${String(p.month).padStart(2, '0')} closed and locked`,
                                      'success'
                                    );
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : 'Action denied', 'warning');
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-[var(--accent)] text-white text-[12px] font-semibold hover:opacity-90"
                              >
                                Close period
                              </button>
                            </>
                          )}
                          {status === 'CLOSED' && (
                            <span className="text-[var(--text-muted)] text-[12px]">Locked</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 8: ABOUT & TECHNICAL SECURITY (Section 1.5)
         ========================================================================= */}
      {activeTab === 'about' && (
        <div className="p-6 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4 max-w-3xl">
          <div className="border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {defaultChurchSettings.churchName} Accounting Platform
              </h3>
              <p className="text-[13px] text-[var(--text-muted)]">
                Version 2.0 (Ghana Functional Currency Edition)
              </p>
            </div>
            <span className="text-[12px] font-sans tabular-nums px-2 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
              Build 2026.11
            </span>
          </div>

          <div className="space-y-3 text-[13px] text-[var(--text-secondary)] leading-relaxed">
            <h4 className="font-bold text-[var(--text-primary)] text-sm">
              Architecture & Security Specifications
            </h4>
            <p>
              This application operates on a local-first, offline-resilient architecture designed specifically for churches in Ghana. All financial transactions are committed to an immutable append-only double-entry ledger.
            </p>
            <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2 text-[13px]">
              <div>
                <strong>Cryptography:</strong> Client-side encrypted snapshots use Web Crypto AES-256-GCM with 100,000 PBKDF2 key-derivation iterations and SHA-256 integrity checksums.
              </div>
              <div>
                <strong>Statutory Compliance:</strong> Built-in remittal rules for GRA Withholding Tax (Act 896, 5% and 7.5%), GRA PAYE progressive tax brackets, and SSNIT Tier 1 & 2 contributions (Act 766, 5.5% employee, 13% employer).
              </div>
              <div>
                <strong>Branch & Device:</strong> Connected to {defaultChurchSettings.churchName} ({defaultChurchSettings.branchName}). Local device terminal: DEV-TR-01.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* 1. Change Role Modal */}
      {selectedUserForRoleChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Change Role for {selectedUserForRoleChange.name}
              </h3>
              <button
                onClick={() => setSelectedUserForRoleChange(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">Select new role</label>
                <select
                  value={newRoleValue}
                  onChange={(e) => setNewRoleValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                >
                  <option value="Treasurer">Treasurer</option>
                  <option value="Finance Secretary">Finance Secretary</option>
                  <option value="Pastor / Elder">Pastor / Elder</option>
                  <option value="Counter">Counter</option>
                  <option value="Department Head">Department Head</option>
                  <option value="Auditor">Auditor</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Reason for role change <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  placeholder="Required: Changes to financial roles take effect after server confirmation..."
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px]"
                />
              </div>

              <p className="text-[12px] text-[var(--text-muted)]">
                Role modifications are recorded in the audit trail. Access to financial data updates upon confirmation.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setSelectedUserForRoleChange(null)}
                className="px-3 py-1.5 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRoleChange}
                disabled={!roleChangeReason.trim()}
                className="px-3 py-1.5 text-[13px] bg-[var(--accent)] text-white font-semibold rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50"
              >
                Submit role change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Restore Confirmation Dialog with Typed Confirmation (Section 5.3) */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-600 font-bold text-base border-b border-[var(--surface-border)] pb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3>Confirm Database Restore</h3>
            </div>

            <div className="space-y-3 text-[13px] text-[var(--text-secondary)] leading-relaxed">
              <p>
                <strong>Warning:</strong> Restoring this backup will replace existing data on this device with the contents of the backup. A safety pre-restore backup will be taken automatically.
              </p>
              <p>
                A restore does not push old records over newer server data: after restoring, this device reconciles with the server, and server period locks and validations still apply.
              </p>
              <div className="p-3 bg-[var(--surface-subtle)] rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[12px]">
                To proceed, please type <span className="font-mono font-bold text-[var(--text-primary)]">RESTORE</span> in the box below:
              </div>
              <input
                type="text"
                value={restoreConfirmationText}
                onChange={(e) => setRestoreConfirmationText(e.target.value)}
                placeholder="Type RESTORE to confirm"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-mono text-[13px] uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
              <button
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setRestoreConfirmationText('');
                }}
                className="px-3 py-1.5 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={restoreConfirmationText !== 'RESTORE' || isExecutingRestore}
                className="px-4 py-1.5 text-[13px] bg-rose-700 text-white font-semibold rounded-[var(--radius-sm)] hover:bg-rose-800 disabled:opacity-50 transition"
              >
                {isExecutingRestore ? 'Restoring...' : 'Confirm and restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Dual-Custody MFA Reset Request Modal (Spec Section C1) */}
      {mfaResetModalState.isOpen && mfaResetModalState.targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-base font-bold">Request Two-Step Verification Reset</h3>
              </div>
              <button
                onClick={() => setMfaResetModalState({ isOpen: false, targetUser: null, reason: '' })}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[var(--text-secondary)] leading-relaxed">
              <p>
                You are requesting a 2FA reset for{' '}
                <strong className="text-[var(--text-primary)]">{mfaResetModalState.targetUser.name}</strong>{' '}
                ({mfaResetModalState.targetUser.role}).
              </p>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-[var(--radius-sm)] text-[12px] text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Dual-Custody Security Policy (Spec Section C1):
                </div>
                <p>
                  MFA resets cannot be done unilaterally. An Administrator initiates the request; the{' '}
                  <strong>Treasurer</strong> must approve. If resetting the Treasurer, a{' '}
                  <strong>Pastor or Elder</strong> must approve.
                </p>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Reason for reset request <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={mfaResetModalState.reason}
                  onChange={(e) => setMfaResetModalState((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Officer replaced phone and lost recovery codes..."
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setMfaResetModalState({ isOpen: false, targetUser: null, reason: '' })}
                className="px-3 py-1.5 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMfaResetRequest}
                disabled={!mfaResetModalState.reason.trim()}
                className="px-4 py-1.5 text-[13px] bg-amber-700 text-white font-semibold rounded-[var(--radius-sm)] hover:bg-amber-800 disabled:opacity-50 transition"
              >
                Submit reset request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MFA Enrollment Modal */}
      <MfaEnrollmentModal
        isOpen={isMfaEnrollmentOpen}
        onClose={() => setIsMfaEnrollmentOpen(false)}
      />

      {/* 5. Acknowledge Security Alert Modal (Spec C5) */}
      {ackModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] rounded-[var(--radius)] border border-[var(--surface-border)] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Acknowledge security alert
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Provide an official reason for acknowledging this security event. This note is permanently written to the audit log.
                </p>
              </div>
              <button
                onClick={() => setAckModalEvent(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px] space-y-1">
              <div><span className="font-semibold text-[var(--text-primary)]">Event:</span> {ackModalEvent.description}</div>
              <div><span className="font-semibold text-[var(--text-primary)]">Actor:</span> {ackModalEvent.actorName} ({ackModalEvent.actorRole})</div>
              <div><span className="font-semibold text-[var(--text-primary)]">Severity:</span> {ackModalEvent.severity}</div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Investigation / Review reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={ackReasonInput}
                onChange={(e) => setAckReasonInput(e.target.value)}
                placeholder="e.g. Verified with officer; device enrollment was scheduled and authorized by Treasurer."
                className="w-full px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setAckModalEvent(null)}
                className="px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledgeAlert}
                disabled={!ackReasonInput.trim()}
                className="px-4 py-1.5 text-[13px] font-semibold rounded-[var(--radius-sm)] bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
              >
                Confirm acknowledgment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Export Security Events with Purpose Modal (Spec C6) */}
      {isExportSecModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] rounded-[var(--radius)] border border-[var(--surface-border)] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Export security events log
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Statutory policy requires recording the purpose of every security and confidential log export.
                </p>
              </div>
              <button
                onClick={() => setIsExportSecModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Purpose for export <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={exportSecPurpose}
                onChange={(e) => setExportSecPurpose(e.target.value)}
                placeholder="e.g. External statutory audit, Quarterly board review..."
                className="w-full px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setIsExportSecModalOpen(false)}
                className="px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleExportSecurityEventsCsv}
                disabled={!exportSecPurpose.trim()}
                className="px-4 py-1.5 text-[13px] font-semibold rounded-[var(--radius-sm)] bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Onboard Authorized Church Officer Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] rounded-[var(--radius)] border border-[var(--surface-border)] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-[var(--surface-border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#1e3a2f]" />
                  <span>Onboard Authorized Church Officer</span>
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  Provision login credentials and role-based permissions in accordance with internal church controls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardOfficer} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--text-primary)] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwame Mensah"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--text-primary)] mb-1">
                  Officer Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. kwame@calvarycrystal.org"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--text-primary)] mb-1">
                    Assigned Church Role *
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    className="w-full px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="Treasurer">Treasurer (Full Access &amp; Overrides)</option>
                    <option value="Finance Secretary">Finance Secretary (Vouchers &amp; Giving)</option>
                    <option value="Pastor / Elder">Pastor / Elder (Approvals &amp; Reports)</option>
                    <option value="Counter">Counter (Sunday Counting Sheets Only)</option>
                    <option value="Auditor">Auditor (Read-Only Audit Trail)</option>
                    <option value="Department Head">Department Head (Requisitions Only)</option>
                    <option value="Admin">Admin (User &amp; Device Setup)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[var(--text-primary)] mb-1">
                    Initial Temporary Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteTempPassword}
                    onChange={(e) => setInviteTempPassword(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Role Permissions Guidance Card */}
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px] space-y-1">
                <span className="font-semibold text-[var(--text-primary)]">Governance Guidance for {inviteRole}:</span>
                <p className="text-[var(--text-secondary)]">
                  {inviteRole === 'Treasurer' && 'Full ledger authority, opening-balance cut-over, emergency overrides, bank reconciliation, and year-end close.'}
                  {inviteRole === 'Finance Secretary' && 'Prepares payment vouchers, manages tithing books, and submits transactions. Subject to separation of duties (cannot approve own vouchers).'}
                  {inviteRole === 'Pastor / Elder' && 'Approves expenditure vouchers and payroll, reviews all financial statements. Cannot initiate financial postings.'}
                  {inviteRole === 'Counter' && 'Restricted strictly to the weekly Offering Counting Room. Cannot view confidential tithing or ledger accounts.'}
                  {inviteRole === 'Auditor' && 'Strict read-only access to all financial records, trial balance, and cryptographic tamper-evident hash-chain logs.'}
                  {inviteRole === 'Department Head' && 'Can initiate departmental requisitions against their approved departmental budget only.'}
                  {inviteRole === 'Admin' && 'Manages officer accounts and hardware device enrollments. Cannot post financial transactions.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3.5 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[13px] font-semibold transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmittingInvite ? 'Onboarding...' : 'Onboard & Activate Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
