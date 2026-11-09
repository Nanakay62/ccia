import { describe, it, expect } from 'vitest';
import {
  DEFAULT_APPROVAL_MATRIX_RULES,
  calculateGhsEquivalentPesewas,
  resolveAmountBand,
  createApprovalRequest,
  evaluateApprovalProgress,
  validateApprovalStep,
  applyApprovalStep,
  proposeApprovalMatrix,
  approveApprovalMatrix,
  evaluateSod,
  evaluateTwoCounters,
  evaluateVendorPayer,
  canTreasurerOverrideSod,
  createSodExceptionRecord,
  createControlledDetailChange,
  approveControlledDetailChange,
  formatPaymentDetailHighlight,
} from '../approvals/index.js';

describe('Phase 5 Domain: Approval Limits Matrix & Separation of Duties (Spec Section C3 & C4)', () => {
  describe('1. Approval Matrix Resolution & GHS Conversion', () => {
    it('correctly converts USD amounts to GHS equivalent pesewas', () => {
      // 100.00 USD @ 15.5000 = 1,550.00 GHS (155,000 pesewas)
      const ghsPesewas = calculateGhsEquivalentPesewas(10000n, 'USD', '15.5000');
      expect(ghsPesewas).toBe(155000n);

      // GHS returns original amount
      const nativeGhs = calculateGhsEquivalentPesewas(50000n, 'GHS');
      expect(nativeGhs).toBe(50000n);
    });

    it('resolves correct amount band and required approvals count by transaction type', () => {
      // Requisition: 500 GHS (Band 1: <= 1,000 GHS) -> 1 approval (Dept Head / Treasurer)
      const band1 = resolveAmountBand(DEFAULT_APPROVAL_MATRIX_RULES, 'requisition', 50000n);
      expect(band1.requiredApprovalsCount).toBe(1);
      expect(band1.requiredRoles).toContain('Department Head');

      // Requisition: 3,000 GHS (Band 2: 1,000.01 - 5,000 GHS) -> 1 approval (Treasurer)
      const band2 = resolveAmountBand(DEFAULT_APPROVAL_MATRIX_RULES, 'requisition', 300000n);
      expect(band2.requiredApprovalsCount).toBe(1);
      expect(band2.requiredRoles).toContain('Treasurer');

      // Requisition: 8,000 GHS (Band 3: > 5,000 GHS) -> 2 approvals (Treasurer + Pastor / Elder)
      const band3 = resolveAmountBand(DEFAULT_APPROVAL_MATRIX_RULES, 'requisition', 800000n);
      expect(band3.requiredApprovalsCount).toBe(2);
      expect(band3.requiredRoles).toContain('Pastor / Elder');

      // USD 400 @ 16.00 = 6,400 GHS -> Crosses into Band 3 (> 5,000 GHS)
      const usdPesewas = 40000n;
      const ghsEq = calculateGhsEquivalentPesewas(usdPesewas, 'USD', '16.0000');
      const usdBand = resolveAmountBand(DEFAULT_APPROVAL_MATRIX_RULES, 'requisition', ghsEq);
      expect(usdBand.requiredApprovalsCount).toBe(2);
    });
  });

  describe('2. Approval Step Rules (Spec Section C3)', () => {
    it('prohibits self-approval (requester cannot approve own request)', () => {
      const req = createApprovalRequest({
        id: 'req-01',
        transactionType: 'requisition',
        entityId: 'e-01',
        entityNumber: 'REQ-0001',
        amountPesewas: 200000n, // GHS 2,000.00
        currency: 'GHS',
        requesterUserId: 'user-kofi-treasurer',
        requesterUserName: 'Kofi Mensah',
        requesterRole: 'Treasurer',
      });

      const validation = validateApprovalStep({
        request: req,
        approverUserId: 'user-kofi-treasurer',
        approverUserName: 'Kofi Mensah',
        approverRole: 'Treasurer',
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/Self-approval prohibited/i);
    });

    it('prohibits the same person from satisfying two approvals (dual-control uniqueness)', () => {
      // 8,000 GHS requisition requires 2 approvals
      const req = createApprovalRequest({
        id: 'req-02',
        transactionType: 'requisition',
        entityId: 'e-02',
        entityNumber: 'REQ-0002',
        amountPesewas: 800000n,
        currency: 'GHS',
        requesterUserId: 'user-depthead',
        requesterUserName: 'Kwame Boateng',
        requesterRole: 'Department Head',
      });

      expect(req.requiredApprovalsCount).toBe(2);

      // Step 1 approved by Kofi Mensah (Treasurer)
      const approvedStep1 = applyApprovalStep({
        request: req,
        approverUserId: 'user-kofi-treasurer',
        approverUserName: 'Kofi Mensah',
        approverRole: 'Treasurer',
      });

      expect(approvedStep1.completedApprovalsCount).toBe(1);
      expect(approvedStep1.status).toBe('PENDING');

      // Check progress status
      const progress = evaluateApprovalProgress(approvedStep1);
      expect(progress.isFullyApproved).toBe(false);
      expect(progress.statusLabel).toMatch(/1 of 2 approvals, waiting for/i);

      // Attempt Step 2 with the same user (even if they also hold another role)
      const step2Validation = validateApprovalStep({
        request: approvedStep1,
        approverUserId: 'user-kofi-treasurer',
        approverUserName: 'Kofi Mensah',
        approverRole: 'Pastor / Elder',
      });

      expect(step2Validation.valid).toBe(false);
      expect(step2Validation.error).toMatch(/Dual-control violation.*same person cannot count as two approvals/i);
    });

    it('voids approvals if the request is edited afterwards', () => {
      const req = createApprovalRequest({
        id: 'req-03',
        transactionType: 'requisition',
        entityId: 'e-03',
        entityNumber: 'REQ-0003',
        amountPesewas: 200000n,
        currency: 'GHS',
        requesterUserId: 'user-akosua-finsec',
        requesterUserName: 'Akosua Osei',
        requesterRole: 'Finance Secretary',
      });

      const approved = applyApprovalStep({
        request: req,
        approverUserId: 'user-kofi-treasurer',
        approverUserName: 'Kofi Mensah',
        approverRole: 'Treasurer',
      });

      // Simulate request modification after approval
      const laterEditTime = new Date(Date.now() + 60000).toISOString();
      const validation = validateApprovalStep({
        request: approved,
        approverUserId: 'user-pastor',
        approverUserName: 'Rev. Emmanuel Addo',
        approverRole: 'Pastor / Elder',
        requestEditedAt: laterEditTime,
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/Approval void.*modified after approval/i);
    });
  });

  describe('3. Matrix Versioning (Treasurer proposes, Pastor/Elder approves)', () => {
    it('allows Treasurer to propose and Pastor/Elder to approve matrix versions', () => {
      const proposed = proposeApprovalMatrix({
        currentVersion: 1,
        rules: DEFAULT_APPROVAL_MATRIX_RULES,
        proposedBy: 'Kofi Mensah (Treasurer)',
        proposerRole: 'Treasurer',
        effectiveFrom: '2026-12-01',
      });

      expect(proposed.version).toBe(2);
      expect(proposed.status).toBe('PROPOSED');

      // Pastor / Elder approves
      const active = approveApprovalMatrix({
        matrixVersion: proposed,
        approverName: 'Rev. Emmanuel Addo',
        approverRole: 'Pastor / Elder',
      });

      expect(active.status).toBe('ACTIVE');
      expect(active.approvedBy).toBe('Rev. Emmanuel Addo');
    });

    it('rejects unauthorized roles from proposing or approving matrix versions', () => {
      expect(() =>
        proposeApprovalMatrix({
          currentVersion: 1,
          rules: DEFAULT_APPROVAL_MATRIX_RULES,
          proposedBy: 'Counter User',
          proposerRole: 'Counter',
          effectiveFrom: '2026-12-01',
        })
      ).toThrow(/Only the Church Treasurer can propose modifications/i);

      const proposed = proposeApprovalMatrix({
        currentVersion: 1,
        rules: DEFAULT_APPROVAL_MATRIX_RULES,
        proposedBy: 'Kofi Mensah',
        proposerRole: 'Treasurer',
        effectiveFrom: '2026-12-01',
      });

      expect(() =>
        approveApprovalMatrix({
          matrixVersion: proposed,
          approverName: 'Akosua Osei',
          approverRole: 'Finance Secretary',
        })
      ).toThrow(/require.*sign-off by a Pastor or Elder/i);
    });
  });

  describe('4. Separation of Duties (SoD) & Override Policy (Spec Section C4)', () => {
    it('blocks preparer from approving payroll, reconciliations, or requisitions', () => {
      const res = evaluateSod({
        checkType: 'PAYROLL_PREPARER_APPROVER',
        preparerUserId: 'user-001',
        approverUserId: 'user-001',
      });

      expect(res.allowed).toBe(false);
      expect(res.isBlocked).toBe(true);
      expect(res.message).toMatch(/cannot approve or authorize payment/i);
    });

    it('strictly enforces two distinct counters for collections', () => {
      const sameCounter = evaluateTwoCounters('counter-01', 'counter-01');
      expect(sameCounter.allowed).toBe(false);
      expect(sameCounter.canTreasurerOverride).toBe(false); // Hard-blocked

      const distinctCounters = evaluateTwoCounters('counter-01', 'counter-02');
      expect(distinctCounters.allowed).toBe(true);
    });

    it('blocks vendor creator/editor from paying vendor in same period without 2nd approval', () => {
      const blocked = evaluateVendorPayer({
        vendorCreatorId: 'user-finsec',
        payerUserId: 'user-finsec',
        isSamePeriod: true,
        hasSecondApproval: false,
      });

      expect(blocked.allowed).toBe(false);
      expect(blocked.message).toMatch(/cannot disburse payment to that vendor in the same period/i);

      const allowedWith2nd = evaluateVendorPayer({
        vendorCreatorId: 'user-finsec',
        payerUserId: 'user-finsec',
        isSamePeriod: true,
        hasSecondApproval: true,
      });

      expect(allowedWith2nd.allowed).toBe(true);
    });

    it('permits Treasurer override with reason ONLY on other users items, NEVER on their own', () => {
      // Overriding someone else's item
      const overrideOther = canTreasurerOverrideSod({
        actorUserId: 'user-treasurer',
        actorRole: 'Treasurer',
        preparerUserId: 'user-finsec',
        approverUserId: 'user-pastor',
      });
      expect(overrideOther.allowed).toBe(true);

      // Overriding own item
      const overrideSelf = canTreasurerOverrideSod({
        actorUserId: 'user-treasurer',
        actorRole: 'Treasurer',
        preparerUserId: 'user-treasurer',
      });
      expect(overrideSelf.allowed).toBe(false);
      expect(overrideSelf.reason).toMatch(/Treasurer self-override prohibited/i);

      // Creates exception record
      const exc = createSodExceptionRecord({
        ruleType: 'REQUISITION_PREPARER_APPROVER',
        entityType: 'REQUISITION',
        entityId: 'req-123',
        actorUserId: 'user-finsec',
        actorUserName: 'Akosua Osei',
        actorRole: 'Finance Secretary',
        isOverridden: true,
        overriddenByTreasurerId: 'user-treasurer',
        overriddenByTreasurerName: 'Kofi Mensah',
        overrideReason: 'Urgent emergency roof repair during pastor travel',
        details: 'Preparer approved requisition under emergency provisions',
      });

      expect(exc.isOverridden).toBe(true);
      expect(exc.overrideReason).toMatch(/emergency roof repair/i);
    });
  });

  describe('5. Controlled Payment Details (Spec Section C4)', () => {
    it('creates a pending change for bank/MoMo details and prevents self-approval', () => {
      const change = createControlledDetailChange({
        entityType: 'VENDOR',
        entityId: 'ven-01',
        entityName: 'Ghana Telecom / Telecel',
        detailType: 'MOMO_NUMBER',
        oldValue: '0244111222',
        newValue: '0555999888',
        changedByUserId: 'user-finsec',
        changedByUserName: 'Akosua Osei',
      });

      expect(change.status).toBe('PENDING_APPROVAL');

      // Highlight status before approval: disbursement blocked
      const preHighlight = formatPaymentDetailHighlight(change);
      expect(preHighlight.canDisburse).toBe(false);
      expect(preHighlight.isPendingApproval).toBe(true);
      expect(preHighlight.bannerText).toMatch(/Pending second-person approval/i);

      // Self-approval attempt
      expect(() =>
        approveControlledDetailChange({
          change,
          approverUserId: 'user-finsec',
          approverUserName: 'Akosua Osei',
          approverRole: 'Finance Secretary',
        })
      ).toThrow(/person who modified payment details cannot approve their own change/i);

      // Authorized 2nd person approval (Treasurer)
      const approved = approveControlledDetailChange({
        change,
        approverUserId: 'user-treasurer',
        approverUserName: 'Kofi Mensah',
        approverRole: 'Treasurer',
      });

      expect(approved.status).toBe('APPROVED');

      // Post-approval highlight shows relative change time and approver
      const postHighlight = formatPaymentDetailHighlight(approved);
      expect(postHighlight.canDisburse).toBe(true);
      expect(postHighlight.bannerText).toMatch(/Approved by Kofi Mensah/i);
    });
  });
});
