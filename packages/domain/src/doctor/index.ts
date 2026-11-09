import Big from 'big.js';
import { toMajorUnitsString } from '../money/index.js';
import { verifyLedgerHashChain } from '../security/hashChain.js';
import type {
  Account,
  Fund,
  AccountingPeriod,
  ExchangeRate,
  JournalEntry,
  JournalLine,
} from '../ledger/types.js';

export type DiagnosticSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface DoctorFinding {
  readonly id: string;
  readonly ruleNumber: number; // 1 to 10
  readonly severity: DiagnosticSeverity;
  readonly title: string;
  readonly description: string;
  readonly probableCause: string;
  readonly recommendedFix: string;
  readonly evidence: {
    readonly entryIds?: readonly string[];
    readonly documentNumbers?: readonly string[];
    readonly dates?: readonly string[];
    readonly userIds?: readonly string[];
    readonly deviceIds?: readonly string[];
    readonly amountsPesewas?: readonly bigint[];
    readonly details?: Record<string, unknown>;
  };
  readonly relatedEntryId?: string | null;
  readonly likelihoodScore: number; // 1 (lowest) to 100 (highest)
}

export interface DoctorReport {
  readonly runId: string;
  readonly timestamp: string;
  readonly totalDebitsGhs: bigint;
  readonly totalCreditsGhs: bigint;
  readonly totalDifferenceGhs: bigint;
  readonly explainedDifferenceGhs: bigint;
  readonly unexplainedDifferenceGhs: bigint;
  readonly isClean: boolean;
  readonly plainLanguageSummary: string;
  readonly breakdowns: {
    readonly byFund: readonly { fundId: string; fundName: string; differenceGhs: bigint }[];
    readonly byAccount: readonly { accountId: string; accountName: string; differenceGhs: bigint }[];
    readonly byCurrency: readonly { currency: string; differenceGhs: bigint }[];
    readonly byMonth: readonly { yearMonth: string; differenceGhs: bigint }[];
    readonly bySource: readonly { source: string; differenceGhs: bigint; count: number }[];
  };
  readonly findings: readonly DoctorFinding[];
}

export interface DoctorDiagnosticInput {
  readonly runId?: string;
  readonly entries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly periods?: readonly AccountingPeriod[];
  readonly exchangeRates?: readonly ExchangeRate[];
  readonly orphanedLines?: readonly JournalLine[];
  readonly emptyHeaders?: readonly JournalEntry[];
  readonly serverComparison?: {
    readonly serverEntryCount: number;
    readonly serverChecksum?: string;
    readonly missingOnClientIds?: readonly string[];
    readonly missingOnServerIds?: readonly string[];
  };
  readonly subledgerChecks?: {
    readonly cashbookComparisons?: readonly {
      readonly accountId: string;
      readonly accountName: string;
      readonly cashbookBalancePesewas: bigint;
      readonly ledgerBalancePesewas: bigint;
    }[];
    readonly tithesControl?: {
      readonly period: string;
      readonly titheRecordsTotalPesewas: bigint;
      readonly explainedUnallocatedPesewas: bigint;
      readonly ledgerTithesIncomePesewas: bigint;
    };
    readonly assetRegisterComparison?: {
      readonly activeCostPesewas: bigint;
      readonly ledgerCostPesewas: bigint;
      readonly activeAccDepPesewas: bigint;
      readonly ledgerAccDepPesewas: bigint;
    };
    readonly countingSheetRefs?: readonly string[];
    readonly voucherPaymentRefs?: readonly string[];
    readonly bankReconciliations?: readonly {
      readonly bankAccountName: string;
      readonly lastSignedOffDate: string;
      readonly referenceDate?: string;
    }[];
    readonly remittanceLiability?: {
      readonly totalAccruedPesewas: bigint;
      readonly totalPaidPesewas: bigint;
      readonly ledgerRemittancePayablePesewas: bigint;
    };
    readonly hashChainCheck?: {
      readonly isClean: boolean;
      readonly brokenLinksCount: number;
      readonly summary?: string;
    };
  };
}

/**
 * Checks if a transposition of adjacent digits in a number could produce difference D.
 */
function checkDigitTranspositionSuspect(amount: bigint, targetDiff: bigint): boolean {
  if (targetDiff % 9n !== 0n) return false;
  const s = amount.toString();
  const absDiff = targetDiff < 0n ? -targetDiff : targetDiff;

  for (let i = 0; i < s.length - 1; i++) {
    const chars = s.split('');
    const temp = chars[i]!;
    chars[i] = chars[i + 1]!;
    chars[i + 1] = temp;
    const swappedVal = BigInt(chars.join(''));
    const diff = swappedVal > amount ? swappedVal - amount : amount - swappedVal;
    if (diff === absDiff) {
      return true;
    }
  }
  return false;
}

/**
 * The 10-step Trial Balance Doctor.
 * Pure diagnostic engine that investigates where and why books do not balance.
 * Strictly diagnostic: NEVER auto-fixes.
 */
export function diagnoseLedger(input: DoctorDiagnosticInput): DoctorReport {
  const runId = input.runId ?? `diag-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const findings: DoctorFinding[] = [];

  const accountsMap = new Map(input.accounts.map((a) => [a.id, a]));
  const fundsMap = new Map(input.funds.map((f) => [f.id, f]));

  // =========================================================================
  // STEP 1: SUMMARY & MULTI-DIMENSIONAL BREAKDOWNS
  // =========================================================================
  let totalDebits = 0n;
  let totalCredits = 0n;

  const fundDebits = new Map<string, bigint>();
  const fundCredits = new Map<string, bigint>();

  const accountDebits = new Map<string, bigint>();
  const accountCredits = new Map<string, bigint>();

  const currencyDebits = new Map<string, bigint>();
  const currencyCredits = new Map<string, bigint>();

  const monthDebits = new Map<string, bigint>();
  const monthCredits = new Map<string, bigint>();

  const sourceMap = new Map<string, { debits: bigint; credits: bigint; count: number }>();

  for (const entry of input.entries) {
    const month = entry.entryDate.slice(0, 7); // 'YYYY-MM'
    const sourceKey = `${entry.entryType} on ${entry.deviceId} (${entry.createdBy})`;

    const src = sourceMap.get(sourceKey) ?? { debits: 0n, credits: 0n, count: 0 };
    src.count += 1;

    for (const line of entry.lines) {
      totalDebits += line.debitAmountGhs;
      totalCredits += line.creditAmountGhs;

      // Fund
      fundDebits.set(line.fundId, (fundDebits.get(line.fundId) ?? 0n) + line.debitAmountGhs);
      fundCredits.set(line.fundId, (fundCredits.get(line.fundId) ?? 0n) + line.creditAmountGhs);

      // Account
      accountDebits.set(line.accountId, (accountDebits.get(line.accountId) ?? 0n) + line.debitAmountGhs);
      accountCredits.set(line.accountId, (accountCredits.get(line.accountId) ?? 0n) + line.creditAmountGhs);

      // Currency
      currencyDebits.set(line.originalCurrency, (currencyDebits.get(line.originalCurrency) ?? 0n) + line.debitAmountGhs);
      currencyCredits.set(line.originalCurrency, (currencyCredits.get(line.originalCurrency) ?? 0n) + line.creditAmountGhs);

      // Month
      monthDebits.set(month, (monthDebits.get(month) ?? 0n) + line.debitAmountGhs);
      monthCredits.set(month, (monthCredits.get(month) ?? 0n) + line.creditAmountGhs);

      src.debits += line.debitAmountGhs;
      src.credits += line.creditAmountGhs;
    }

    sourceMap.set(sourceKey, src);
  }

  // Add any orphaned lines to totals
  if (input.orphanedLines) {
    for (const line of input.orphanedLines) {
      totalDebits += line.debitAmountGhs;
      totalCredits += line.creditAmountGhs;
    }
  }

  const overallDifference = totalDebits - totalCredits;

  // Compile breakdowns
  const byFund = Array.from(fundsMap.values()).map((f) => ({
    fundId: f.id,
    fundName: f.name,
    differenceGhs: (fundDebits.get(f.id) ?? 0n) - (fundCredits.get(f.id) ?? 0n),
  })).filter((x) => x.differenceGhs !== 0n);

  const byAccount = Array.from(accountsMap.values()).map((a) => ({
    accountId: a.id,
    accountName: a.name,
    differenceGhs: (accountDebits.get(a.id) ?? 0n) - (accountCredits.get(a.id) ?? 0n),
  })).filter((x) => x.differenceGhs !== 0n);

  const byCurrency = ['GHS', 'USD'].map((curr) => ({
    currency: curr,
    differenceGhs: (currencyDebits.get(curr) ?? 0n) - (currencyCredits.get(curr) ?? 0n),
  })).filter((x) => x.differenceGhs !== 0n);

  const allMonths = new Set([...monthDebits.keys(), ...monthCredits.keys()]);
  const byMonth = Array.from(allMonths).sort().map((m) => ({
    yearMonth: m,
    differenceGhs: (monthDebits.get(m) ?? 0n) - (monthCredits.get(m) ?? 0n),
  })).filter((x) => x.differenceGhs !== 0n);

  const bySource = Array.from(sourceMap.entries()).map(([k, v]) => ({
    source: k,
    differenceGhs: v.debits - v.credits,
    count: v.count,
  })).filter((x) => x.differenceGhs !== 0n);

  // Track explained amount
  let explainedDifference = 0n;

  // =========================================================================
  // STEP 2: UNBALANCED ENTRIES
  // =========================================================================
  const unbalancedEntries: { entry: JournalEntry; diff: bigint }[] = [];

  for (const entry of input.entries) {
    let entryDr = 0n;
    let entryCr = 0n;
    for (const line of entry.lines) {
      entryDr += line.debitAmountGhs;
      entryCr += line.creditAmountGhs;
    }
    const diff = entryDr - entryCr;
    if (diff !== 0n) {
      unbalancedEntries.push({ entry, diff });
      findings.push({
        id: `finding-r2-${entry.id}`,
        ruleNumber: 2,
        severity: 'ERROR',
        title: `Unbalanced Journal Entry: ${entry.documentNumber}`,
        description: `Journal entry "${entry.documentNumber}" (${entry.narration}) has debits (${entryDr} pesewas) differing from credits (${entryCr} pesewas).`,
        probableCause: `Entry lines do not net to zero (difference of GHS ${toMajorUnitsString(diff)}).`,
        recommendedFix: `Treasurer should post a linked reversal entry for ${entry.documentNumber} and re-enter the balanced entry.`,
        evidence: {
          entryIds: [entry.id],
          documentNumbers: [entry.documentNumber],
          dates: [entry.entryDate],
          userIds: [entry.createdBy],
          deviceIds: [entry.deviceId],
          amountsPesewas: [diff],
        },
        relatedEntryId: entry.id,
        likelihoodScore: 95,
      });
      explainedDifference += diff;
    }
  }

  // =========================================================================
  // STEP 3: STRUCTURAL PROBLEMS
  // =========================================================================
  // 3a. Orphaned lines (lines without headers)
  if (input.orphanedLines && input.orphanedLines.length > 0) {
    findings.push({
      id: `finding-r3-orphaned-lines`,
      ruleNumber: 3,
      severity: 'ERROR',
      title: `${input.orphanedLines.length} Orphaned Journal Lines Detected`,
      description: `Detected journal lines in local database that have no corresponding journal entry header.`,
      probableCause: `Incomplete sync or interrupted database transaction.`,
      recommendedFix: `Identify source transaction and purge or re-link orphaned lines with parent header.`,
      evidence: {
        amountsPesewas: input.orphanedLines.map((l) => l.debitAmountGhs || l.creditAmountGhs),
        details: { orphanedLineIds: input.orphanedLines.map((l) => l.id) },
      },
      likelihoodScore: 90,
    });
  }

  // 3b. Headers without lines
  if (input.emptyHeaders && input.emptyHeaders.length > 0) {
    for (const h of input.emptyHeaders) {
      findings.push({
        id: `finding-r3-empty-${h.id}`,
        ruleNumber: 3,
        severity: 'WARNING',
        title: `Empty Journal Entry Header: ${h.documentNumber}`,
        description: `Journal entry header "${h.documentNumber}" exists with 0 lines.`,
        probableCause: `Partial sync upload or incomplete drafting.`,
        recommendedFix: `Remove empty header or sync missing line details.`,
        evidence: {
          entryIds: [h.id],
          documentNumbers: [h.documentNumber],
        },
        relatedEntryId: h.id,
        likelihoodScore: 80,
      });
    }
  }

  // 3c. Single-line entries, missing/inactive accounts or funds, negative amounts
  for (const entry of input.entries) {
    if (entry.lines.length === 1) {
      findings.push({
        id: `finding-r3-single-line-${entry.id}`,
        ruleNumber: 3,
        severity: 'ERROR',
        title: `Single-Line Entry: ${entry.documentNumber}`,
        description: `Entry contains only 1 line, violating double-entry rules.`,
        probableCause: `Counterpart line failed to insert or was omitted.`,
        recommendedFix: `Reverse single-line entry and re-post with balancing credit/debit.`,
        evidence: {
          entryIds: [entry.id],
          documentNumbers: [entry.documentNumber],
        },
        relatedEntryId: entry.id,
        likelihoodScore: 92,
      });
    }

    for (const line of entry.lines) {
      const acct = accountsMap.get(line.accountId);
      if (!acct) {
        findings.push({
          id: `finding-r3-missing-acct-${line.id}`,
          ruleNumber: 3,
          severity: 'ERROR',
          title: `Line Points to Non-Existent Account in ${entry.documentNumber}`,
          description: `Line references account ID ${line.accountId} which is missing from Chart of Accounts.`,
          probableCause: `Account deleted or sync reference broken.`,
          recommendedFix: `Restore missing account or reverse entry to post to valid account.`,
          evidence: { entryIds: [entry.id], documentNumbers: [entry.documentNumber] },
          relatedEntryId: entry.id,
          likelihoodScore: 85,
        });
      } else if (!acct.isActive) {
        findings.push({
          id: `finding-r3-inactive-acct-${line.id}`,
          ruleNumber: 3,
          severity: 'WARNING',
          title: `Line Uses Inactive Account "${acct.name}" in ${entry.documentNumber}`,
          description: `Account ${acct.name} (${acct.code}) was archived/inactive when entry was active.`,
          probableCause: `Posting to decommissioned account.`,
          recommendedFix: `Reclassify lines to active account via reversal entry.`,
          evidence: { entryIds: [entry.id], documentNumbers: [entry.documentNumber] },
          relatedEntryId: entry.id,
          likelihoodScore: 60,
        });
      }

      const f = fundsMap.get(line.fundId);
      if (!f) {
        findings.push({
          id: `finding-r3-missing-fund-${line.id}`,
          ruleNumber: 3,
          severity: 'ERROR',
          title: `Line Points to Non-Existent Fund in ${entry.documentNumber}`,
          description: `Line references fund ID ${line.fundId} which does not exist.`,
          probableCause: `Corrupted fund foreign key.`,
          recommendedFix: `Re-link entry to appropriate fund.`,
          evidence: { entryIds: [entry.id] },
          relatedEntryId: entry.id,
          likelihoodScore: 85,
        });
      }

      if (line.originalAmount <= 0n) {
        findings.push({
          id: `finding-r3-nonpositive-amt-${line.id}`,
          ruleNumber: 3,
          severity: 'ERROR',
          title: `Zero or Negative Amount in ${entry.documentNumber}`,
          description: `Line amount is ${line.originalAmount}, violating positive-value rule.`,
          probableCause: `Erroneous zero or negative voucher entry.`,
          recommendedFix: `Reverse entry with zero/negative amount and re-enter positive value.`,
          evidence: { entryIds: [entry.id] },
          relatedEntryId: entry.id,
          likelihoodScore: 85,
        });
      }

      if (line.debitAmountGhs > 0n && line.creditAmountGhs > 0n) {
        findings.push({
          id: `finding-r3-both-dr-cr-${line.id}`,
          ruleNumber: 3,
          severity: 'ERROR',
          title: `Simultaneous Debit and Credit on Line in ${entry.documentNumber}`,
          description: `Line has Dr: ${line.debitAmountGhs} and Cr: ${line.creditAmountGhs}.`,
          probableCause: `Malformed input data payload.`,
          recommendedFix: `Reverse entry and separate into distinct debit and credit lines.`,
          evidence: { entryIds: [entry.id] },
          relatedEntryId: entry.id,
          likelihoodScore: 88,
        });
      }
    }
  }

  // =========================================================================
  // STEP 4: SYNC GAPS
  // =========================================================================
  for (const entry of input.entries) {
    if (entry.lines.length < entry.lineCount) {
      findings.push({
        id: `finding-r4-sync-lines-${entry.id}`,
        ruleNumber: 4,
        severity: 'ERROR',
        title: `Partial Sync Detected for ${entry.documentNumber}`,
        description: `Entry header specifies ${entry.lineCount} lines, but only ${entry.lines.length} lines are synced to device SQLite.`,
        probableCause: `Interrupted sync mid-transaction or network drop during replication.`,
        recommendedFix: `Trigger full sync refresh from server or re-fetch entry lines.`,
        evidence: {
          entryIds: [entry.id],
          documentNumbers: [entry.documentNumber],
          details: { expectedLines: entry.lineCount, actualLines: entry.lines.length },
        },
        relatedEntryId: entry.id,
        likelihoodScore: 94,
      });
    }
  }

  if (input.serverComparison) {
    const sc = input.serverComparison;
    if (sc.missingOnClientIds && sc.missingOnClientIds.length > 0) {
      findings.push({
        id: `finding-r4-missing-client`,
        ruleNumber: 4,
        severity: 'WARNING',
        title: `${sc.missingOnClientIds.length} Entries on Server Missing from Device`,
        description: `Server has entries not yet present in device SQLite.`,
        probableCause: `Device sync is pending or client filter excluded bucket.`,
        recommendedFix: `Click "Sync Now" to download missing entries from server.`,
        evidence: { details: { missingIds: sc.missingOnClientIds } },
        likelihoodScore: 85,
      });
    }
    if (sc.missingOnServerIds && sc.missingOnServerIds.length > 0) {
      findings.push({
        id: `finding-r4-missing-server`,
        ruleNumber: 4,
        severity: 'WARNING',
        title: `${sc.missingOnServerIds.length} Offline Entries Pending Server Upload`,
        description: `Device has local entries queued for upload.`,
        probableCause: `Operating in offline mode.`,
        recommendedFix: `Connect to internet and trigger sync.`,
        evidence: { details: { pendingUploadIds: sc.missingOnServerIds } },
        likelihoodScore: 80,
      });
    }
  }

  // =========================================================================
  // STEP 5: CURRENCY INTEGRITY
  // =========================================================================
  for (const entry of input.entries) {
    for (const line of entry.lines) {
      if (line.originalCurrency === 'USD') {
        const rate = new Big(line.exchangeRate || '0');
        if (rate.lte(0)) {
          findings.push({
            id: `finding-r5-zero-rate-${line.id}`,
            ruleNumber: 5,
            severity: 'ERROR',
            title: `Zero or Missing Exchange Rate in ${entry.documentNumber}`,
            description: `USD line has invalid rate "${line.exchangeRate}".`,
            probableCause: `Exchange rate not set before entering foreign currency transaction.`,
            recommendedFix: `Reverse entry and re-post with valid historical USD rate.`,
            evidence: { entryIds: [entry.id] },
            relatedEntryId: entry.id,
            likelihoodScore: 92,
          });
        } else {
          // Check rate calculation
          const expectedExact = new Big(line.originalAmount.toString()).times(rate);
          const expectedRounded = BigInt(expectedExact.round(0, Big.roundHalfEven).toFixed(0));
          const lineBase = line.debitAmountGhs || line.creditAmountGhs;

          const diff = lineBase > expectedRounded ? lineBase - expectedRounded : expectedRounded - lineBase;
          if (diff > 1n) {
            findings.push({
              id: `finding-r5-rate-calc-${line.id}`,
              ruleNumber: 5,
              severity: 'ERROR',
              title: `Currency Conversion Mismatch in ${entry.documentNumber}`,
              description: `USD line base GHS is ${lineBase} pesewas, but ${line.originalAmount} cents at rate ${line.exchangeRate} converts to ${expectedRounded} pesewas.`,
              probableCause: `Manual override without rounding compensation or formula error.`,
              recommendedFix: `Reverse entry and recalculate base amount using standard rate.`,
              evidence: { entryIds: [entry.id] },
              relatedEntryId: entry.id,
              likelihoodScore: 88,
            });
          } else if (diff === 1n) {
            findings.push({
              id: `finding-r5-rounding-${line.id}`,
              ruleNumber: 5,
              severity: 'INFO',
              title: `1 Pesewa Rounding Discrepancy in ${entry.documentNumber}`,
              description: `USD line has 1 pesewa fractional rounding difference.`,
              probableCause: `Standard line-by-line foreign exchange conversion rounding.`,
              recommendedFix: `Post 1 pesewa difference to Rounding Differences account (code 5990).`,
              evidence: { entryIds: [entry.id] },
              relatedEntryId: entry.id,
              likelihoodScore: 70,
            });
          }
        }
      }
    }
  }

  // =========================================================================
  // STEP 6: DUPLICATES AND REVERSALS
  // =========================================================================
  const seenEntries = new Map<string, JournalEntry>();
  for (const entry of input.entries) {
    if (entry.isReversal) continue;

    // Signature: date + totalDebit + narration snippet
    const sig = `${entry.entryDate}_${entry.totalDebitGhs}_${entry.lines.map((l) => `${l.accountId}:${l.debitAmountGhs}:${l.creditAmountGhs}`).join(';')}`;
    if (seenEntries.has(sig)) {
      const original = seenEntries.get(sig)!;
      findings.push({
        id: `finding-r6-duplicate-${entry.id}`,
        ruleNumber: 6,
        severity: 'WARNING',
        title: `Probable Duplicate Posting: ${entry.documentNumber}`,
        description: `Entry ${entry.documentNumber} is identical in date (${entry.entryDate}), amount (${toMajorUnitsString(entry.totalDebitGhs)} GHS), and line structure to ${original.documentNumber}.`,
        probableCause: `User submitted form twice or offline retry created duplicate document.`,
        recommendedFix: `Verify with receipt/voucher. If duplicate, Treasurer should reverse ${entry.documentNumber}.`,
        evidence: {
          entryIds: [entry.id, original.id],
          documentNumbers: [entry.documentNumber, original.documentNumber],
          dates: [entry.entryDate],
        },
        relatedEntryId: entry.id,
        likelihoodScore: 82,
      });
    } else {
      seenEntries.set(sig, entry);
    }
  }

  // Check reversals integrity
  for (const entry of input.entries) {
    if (entry.isReversal && entry.reversalOfId) {
      const orig = input.entries.find((e) => e.id === entry.reversalOfId);
      if (!orig) {
        findings.push({
          id: `finding-r6-missing-orig-${entry.id}`,
          ruleNumber: 6,
          severity: 'WARNING',
          title: `Reversal Missing Target Entry: ${entry.documentNumber}`,
          description: `Entry is marked as a reversal of ${entry.reversalOfId}, but target entry is not in ledger.`,
          probableCause: `Target entry was deleted or not synced to local database.`,
          recommendedFix: `Locate original entry on server or investigate missing record.`,
          evidence: { entryIds: [entry.id], documentNumbers: [entry.documentNumber] },
          relatedEntryId: entry.id,
          likelihoodScore: 75,
        });
      } else {
        // Reversal debits must equal original credits and vice versa
        if (entry.totalDebitGhs !== orig.totalCreditGhs || entry.totalCreditGhs !== orig.totalDebitGhs) {
          findings.push({
            id: `finding-r6-flawed-reversal-${entry.id}`,
            ruleNumber: 6,
            severity: 'ERROR',
            title: `Flawed Reversal Entry: ${entry.documentNumber}`,
            description: `Reversal does not exactly mirror ${orig.documentNumber}. Expected Dr: ${orig.totalCreditGhs}, got ${entry.totalDebitGhs}.`,
            probableCause: `Amounts or lines were manually edited during reversal generation.`,
            recommendedFix: `Post correcting entry to bring combined impact to exactly zero.`,
            evidence: {
              entryIds: [entry.id, orig.id],
              documentNumbers: [entry.documentNumber, orig.documentNumber],
            },
            relatedEntryId: entry.id,
            likelihoodScore: 90,
          });
        }
      }
    }
  }

  // =========================================================================
  // STEP 7: PATTERN DETECTION ON THE REMAINING DIFFERENCE D
  // =========================================================================
  const unexplainedDiff = overallDifference - explainedDifference;
  const absUnexplained = unexplainedDiff < 0n ? -unexplainedDiff : unexplainedDiff;
  const absOverall = overallDifference < 0n ? -overallDifference : overallDifference;
  // Examine the active discrepancy (unexplained difference, or overall difference if unbalanced entries exist)
  const targetD = absUnexplained > 0n ? absUnexplained : absOverall;

  if (targetD > 0n) {
    // 7a. Single line or entry equals D (Missing Counterpart)
    for (const entry of input.entries) {
      for (const line of entry.lines) {
        const lineAmt = line.debitAmountGhs || line.creditAmountGhs;
        if (lineAmt === targetD) {
          findings.push({
            id: `finding-r7-match-d-${line.id}`,
            ruleNumber: 7,
            severity: 'ERROR',
            title: `Difference Matches Exact Line Amount in ${entry.documentNumber}`,
            description: `Line amount of GHS ${toMajorUnitsString(lineAmt)} exactly matches the trial balance discrepancy (GHS ${toMajorUnitsString(targetD)}).`,
            probableCause: `This line is likely missing its balancing counterpart or was posted unilaterally.`,
            recommendedFix: `Inspect ${entry.documentNumber} and post the missing counterpart line or reverse the entry.`,
            evidence: {
              entryIds: [entry.id],
              documentNumbers: [entry.documentNumber],
              amountsPesewas: [lineAmt],
            },
            relatedEntryId: entry.id,
            likelihoodScore: 89,
          });
        }
      }
    }

    // 7b. D / 2 equals a line amount (Debit/Credit Sign Flip)
    if (targetD % 2n === 0n) {
      const halfDiff = targetD / 2n;
      for (const entry of input.entries) {
        for (const line of entry.lines) {
          const lineAmt = line.debitAmountGhs || line.creditAmountGhs;
          if (lineAmt === halfDiff) {
            findings.push({
              id: `finding-r7-half-d-${line.id}`,
              ruleNumber: 7,
              severity: 'ERROR',
              title: `Probable Debit/Credit Sign Inversion in ${entry.documentNumber}`,
              description: `Line amount GHS ${toMajorUnitsString(lineAmt)} is exactly half the discrepancy (${toMajorUnitsString(targetD)}).`,
              probableCause: `A debit was mistakenly entered as a credit (or vice versa), which shifts the balance by exactly 2 × amount (${toMajorUnitsString(targetD)}).`,
              recommendedFix: `Reverse ${entry.documentNumber} and swap the debit/credit columns for this line.`,
              evidence: {
                entryIds: [entry.id],
                documentNumbers: [entry.documentNumber],
                amountsPesewas: [lineAmt],
              },
              relatedEntryId: entry.id,
              likelihoodScore: 93,
            });
          }
        }
      }
    }

    // 7c. D divisible by 9 (Digit Transposition)
    if (targetD % 9n === 0n) {
      const transpositionSuspects: { entry: JournalEntry; line: JournalLine }[] = [];
      for (const entry of input.entries) {
        for (const line of entry.lines) {
          const lineAmt = line.debitAmountGhs || line.creditAmountGhs;
          if (checkDigitTranspositionSuspect(lineAmt, targetD)) {
            transpositionSuspects.push({ entry, line });
          }
        }
      }

      if (transpositionSuspects.length > 0) {
        findings.push({
          id: `finding-r7-transposition`,
          ruleNumber: 7,
          severity: 'ERROR',
          title: `Digit Transposition Suspected (Difference Divisible by 9)`,
          description: `The discrepancy GHS ${toMajorUnitsString(targetD)} is divisible by 9, a classic signature of swapped adjacent digits.`,
          probableCause: `User typed numbers with swapped adjacent digits (e.g. 54 instead of 45). Found ${transpositionSuspects.length} candidate line(s).`,
          recommendedFix: `Inspect candidate entries: ${transpositionSuspects.map((t) => t.entry.documentNumber).slice(0, 5).join(', ')} against physical source documents.`,
          evidence: {
            entryIds: transpositionSuspects.map((t) => t.entry.id),
            documentNumbers: transpositionSuspects.map((t) => t.entry.documentNumber),
            amountsPesewas: transpositionSuspects.map((t) => t.line.debitAmountGhs || t.line.creditAmountGhs),
          },
          likelihoodScore: 87,
        });
      }
    }

    // 7d. Decimal Slip (10x or 100x or 0.1x)
    for (const entry of input.entries) {
      for (const line of entry.lines) {
        const lineAmt = line.debitAmountGhs || line.creditAmountGhs;
        // If slip by 10x: new = 10 * orig -> diff = 9 * orig
        if (lineAmt * 9n === targetD || lineAmt * 99n === targetD) {
          findings.push({
            id: `finding-r7-decimal-slip-${line.id}`,
            ruleNumber: 7,
            severity: 'ERROR',
            title: `Decimal Slip Detected in ${entry.documentNumber}`,
            description: `Discrepancy corresponds to a 10x or 100x decimal entry slip on line of GHS ${toMajorUnitsString(lineAmt)}.`,
            probableCause: `A decimal point was entered in the wrong position during manual entry.`,
            recommendedFix: `Compare line against voucher or receipt and reverse with correct decimal position.`,
            evidence: {
              entryIds: [entry.id],
              documentNumbers: [entry.documentNumber],
              amountsPesewas: [lineAmt],
            },
            relatedEntryId: entry.id,
            likelihoodScore: 86,
          });
        }
      }
    }
  }

  // =========================================================================
  // STEP 8: TIME BISECT
  // =========================================================================
  // Determine the exact first date that the trial balance fell out of balance
  const dateTotals = new Map<string, { dr: bigint; cr: bigint }>();
  for (const entry of input.entries) {
    const cur = dateTotals.get(entry.entryDate) ?? { dr: 0n, cr: 0n };
    for (const line of entry.lines) {
      cur.dr += line.debitAmountGhs;
      cur.cr += line.creditAmountGhs;
    }
    dateTotals.set(entry.entryDate, cur);
  }

  const sortedDates = Array.from(dateTotals.keys()).sort();
  let cumulativeDr = 0n;
  let cumulativeCr = 0n;
  let firstImbalanceDate: string | null = null;
  let imbalanceEntriesOnDate: string[] = [];

  for (const d of sortedDates) {
    const t = dateTotals.get(d)!;
    cumulativeDr += t.dr;
    cumulativeCr += t.cr;
    if (cumulativeDr !== cumulativeCr && !firstImbalanceDate) {
      firstImbalanceDate = d;
      imbalanceEntriesOnDate = input.entries
        .filter((e) => e.entryDate === d)
        .map((e) => e.documentNumber);
      break;
    }
  }

  if (firstImbalanceDate) {
    findings.push({
      id: `finding-r8-first-date`,
      ruleNumber: 8,
      severity: 'INFO',
      title: `Time Bisect: Balance First Broke on ${firstImbalanceDate}`,
      description: `Cumulative trial balance was healthy prior to ${firstImbalanceDate}, where it first went out of balance.`,
      probableCause: `Discrepancy originated from transactions posted on or around ${firstImbalanceDate}.`,
      recommendedFix: `Focus auditing on transactions posted on ${firstImbalanceDate}: ${imbalanceEntriesOnDate.join(', ')}.`,
      evidence: {
        dates: [firstImbalanceDate],
        documentNumbers: imbalanceEntriesOnDate,
      },
      likelihoodScore: 84,
    });
  }

  // =========================================================================
  // STEP 9: SOURCE BREAKDOWN (USER / DEVICE / DOC TYPE)
  // =========================================================================
  if (bySource.length > 0 && absUnexplained > 0n) {
    for (const src of bySource) {
      if (src.differenceGhs !== 0n) {
        findings.push({
          id: `finding-r9-source-${src.source.slice(0, 20)}`,
          ruleNumber: 9,
          severity: 'INFO',
          title: `Discrepancy Concentrated in Source: ${src.source}`,
          description: `Transactions from ${src.source} account for GHS ${toMajorUnitsString(src.differenceGhs)} of the imbalance across ${src.count} entries.`,
          probableCause: `Local device sync corruption or user entry error on specific device.`,
          recommendedFix: `Review all recent batches uploaded from this device.`,
          evidence: { details: { source: src.source, diff: src.differenceGhs.toString() } },
          likelihoodScore: 78,
        });
      }
    }
  }

  // =========================================================================
  // STEP 10: OPENING BALANCES & IMPORTS
  // =========================================================================
  const openingEntries = input.entries.filter((e) => e.entryType === 'OPENING_BALANCE');
  for (const op of openingEntries) {
    let opDr = 0n;
    let opCr = 0n;
    for (const l of op.lines) {
      opDr += l.debitAmountGhs;
      opCr += l.creditAmountGhs;
    }
    if (opDr !== opCr) {
      findings.push({
        id: `finding-r10-opening-${op.id}`,
        ruleNumber: 10,
        severity: 'ERROR',
        title: `Opening Balance Entry Does Not Balance: ${op.documentNumber}`,
        description: `Opening balances must balance on their own. Debits: ${opDr}, Credits: ${opCr}.`,
        probableCause: `Migration or initial setup spreadsheet data entry omission.`,
        recommendedFix: `Treasurer must reconcile opening balance migration against prior year audited statements and post balancing adjustment.`,
        evidence: {
          entryIds: [op.id],
          documentNumbers: [op.documentNumber],
          amountsPesewas: [opDr - opCr],
        },
        relatedEntryId: op.id,
        likelihoodScore: 98,
      });
      explainedDifference += (opDr - opCr);
    }
  }

  // =========================================================================
  // STEPS 11-16: SUB-LEDGER & MODULE INTEGRITY CHECKS (Section 5)
  // =========================================================================
  if (input.subledgerChecks) {
    const sc = input.subledgerChecks;

    // 11. Cashbook vs ledger: for each cash account, the cashbook closing balance equals the ledger balance
    if (sc.cashbookComparisons) {
      for (const cmp of sc.cashbookComparisons) {
        const diff = cmp.cashbookBalancePesewas - cmp.ledgerBalancePesewas;
        if (diff !== 0n) {
          findings.push({
            id: `finding-r11-cashbook-${cmp.accountId}`,
            ruleNumber: 11,
            severity: 'ERROR',
            title: `Cashbook vs Ledger Discrepancy: ${cmp.accountName}`,
            description: `Cashbook closing balance (GHS ${toMajorUnitsString(cmp.cashbookBalancePesewas)}) does not equal the general ledger balance (GHS ${toMajorUnitsString(cmp.ledgerBalancePesewas)}).`,
            probableCause: `Unlinked manual journal entry posted directly to cash/bank control account or failed sub-ledger posting.`,
            recommendedFix: `Reconcile ${cmp.accountName} lines in Cashbook against General Ledger and reverse unlinked manual entries.`,
            evidence: {
              amountsPesewas: [diff],
              details: { accountId: cmp.accountId, accountName: cmp.accountName },
            },
            likelihoodScore: 96,
          });
        }
      }
    }

    // 12. Tithes control: total of tithe records for a period equals the ledger balance of Tithes income
    if (sc.tithesControl) {
      const tc = sc.tithesControl;
      const allocatedAndExplained = tc.titheRecordsTotalPesewas + tc.explainedUnallocatedPesewas;
      const unallocatedDiff = tc.ledgerTithesIncomePesewas - allocatedAndExplained;
      if (unallocatedDiff !== 0n) {
        findings.push({
          id: `finding-r12-tithes-${tc.period}`,
          ruleNumber: 12,
          severity: 'WARNING',
          title: `Unallocated Tithes Control Difference (${tc.period})`,
          description: `Total member tithe records plus explained anonymous tithes (GHS ${toMajorUnitsString(allocatedAndExplained)}) differ from the Tithes income account ledger balance (GHS ${toMajorUnitsString(tc.ledgerTithesIncomePesewas)}) by GHS ${toMajorUnitsString(unallocatedDiff)}.`,
          probableCause: `Pending Sunday counting sheet tithe batch not yet allocated to individual member envelopes.`,
          recommendedFix: `Open Tithes → Batches for ${tc.period} and allocate remaining envelope amounts or mark unreadable envelopes as explained anonymous.`,
          evidence: {
            amountsPesewas: [unallocatedDiff],
            details: { period: tc.period },
          },
          likelihoodScore: 90,
        });
      }
    }

    // 13. Asset register vs ledger: total cost and accumulated depreciation equal control account balances
    if (sc.assetRegisterComparison) {
      const arc = sc.assetRegisterComparison;
      const costDiff = arc.activeCostPesewas - arc.ledgerCostPesewas;
      const accDepDiff = arc.activeAccDepPesewas - arc.ledgerAccDepPesewas;
      if (costDiff !== 0n || accDepDiff !== 0n) {
        findings.push({
          id: `finding-r13-assets-reconciliation`,
          ruleNumber: 13,
          severity: 'ERROR',
          title: `Fixed Asset Register vs General Ledger Out of Balance`,
          description: `Active asset register cost diff: GHS ${toMajorUnitsString(costDiff)}; Accumulated depreciation diff: GHS ${toMajorUnitsString(accDepDiff)}.`,
          probableCause: `Capital purchase voucher or depreciation journal posted without updating asset register sub-ledger.`,
          recommendedFix: `Run Fixed Assets → Reports → Sub-Ledger Reconciliation to identify the category with the variance.`,
          evidence: {
            amountsPesewas: [costDiff !== 0n ? costDiff : accDepDiff],
          },
          likelihoodScore: 95,
        });
      }
    }

    // 14. No double posting: counting sheet line or voucher payment appears once in the ledger
    if (sc.countingSheetRefs) {
      const seenSheets = new Set<string>();
      for (const ref of sc.countingSheetRefs) {
        if (seenSheets.has(ref)) {
          findings.push({
            id: `finding-r14-double-cs-${ref}`,
            ruleNumber: 14,
            severity: 'ERROR',
            title: `Double-Posted Counting Sheet: ${ref}`,
            description: `Counting sheet ${ref} appears more than once in general ledger postings.`,
            probableCause: `Counting sheet was manually re-entered in Cashbook after automatic posting.`,
            recommendedFix: `Reverse the duplicate manual receipt entry in Cashbook.`,
            evidence: { documentNumbers: [ref] },
            likelihoodScore: 99,
          });
        }
        seenSheets.add(ref);
      }
    }

    if (sc.voucherPaymentRefs) {
      const seenVouchers = new Set<string>();
      for (const vRef of sc.voucherPaymentRefs) {
        if (seenVouchers.has(vRef)) {
          findings.push({
            id: `finding-r14-double-pv-${vRef}`,
            ruleNumber: 14,
            severity: 'ERROR',
            title: `Double-Posted Payment Voucher: ${vRef}`,
            description: `Payment voucher ${vRef} has multiple disbursement postings in the ledger.`,
            probableCause: `Voucher was paid twice in Cashbook or Expenses.`,
            recommendedFix: `Reverse the duplicate payment journal entry.`,
            evidence: { documentNumbers: [vRef] },
            likelihoodScore: 99,
          });
        }
        seenVouchers.add(vRef);
      }
    }

    // 15. Bank reconciliation currency: last signed-off reconciliation within 35 days (warning, non-blocking)
    if (sc.bankReconciliations) {
      for (const br of sc.bankReconciliations) {
        const refDate = new Date(br.referenceDate || new Date().toISOString().slice(0, 10));
        const signedDate = new Date(br.lastSignedOffDate);
        const diffDays = Math.floor((refDate.getTime() - signedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 35) {
          findings.push({
            id: `finding-r15-stale-recon-${br.bankAccountName}`,
            ruleNumber: 15,
            severity: 'WARNING',
            title: `Bank Reconciliation Overdue (${diffDays} days): ${br.bankAccountName}`,
            description: `Last signed-off bank reconciliation for ${br.bankAccountName} was on ${br.lastSignedOffDate} (${diffDays} days ago, exceeding the 35-day threshold).`,
            probableCause: `Monthly bank statement has not yet been imported or signed off for the prior month.`,
            recommendedFix: `Open Cashbook → Bank Reconciliation and complete statement matching for ${br.bankAccountName}.`,
            evidence: { dates: [br.lastSignedOffDate] },
            likelihoodScore: 85,
          });
        }
      }
    }

    // 16. Remittance liability: remittance payable equals accrued less paid
    if (sc.remittanceLiability) {
      const rl = sc.remittanceLiability;
      const expectedPayable = rl.totalAccruedPesewas - rl.totalPaidPesewas;
      const diff = expectedPayable - rl.ledgerRemittancePayablePesewas;
      if (diff !== 0n) {
        findings.push({
          id: `finding-r16-remittance-liability`,
          ruleNumber: 16,
          severity: 'ERROR',
          title: `Tithe Remittance Liability Mismatch`,
          description: `Sub-ledger net remittance payable (Accrued less Paid = GHS ${toMajorUnitsString(expectedPayable)}) does not match the Remittances Payable ledger balance (GHS ${toMajorUnitsString(rl.ledgerRemittancePayablePesewas)}).`,
          probableCause: `Remittance payment voucher was posted to an expense account instead of clearing the Remittances Payable liability account.`,
          recommendedFix: `Reconcile Tithes → Remittance schedule against Account 2120 (Remittances Payable).`,
          evidence: { amountsPesewas: [diff] },
          likelihoodScore: 94,
        });
      }
    }
  }

  // 17. General ledger hash-chain anti-tampering (SHA-256 cryptographic link verification)
  const sc = input.subledgerChecks;
  if (sc?.hashChainCheck) {
    if (!sc.hashChainCheck.isClean) {
      findings.push({
        id: 'finding-r17-hash-chain-tamper',
        ruleNumber: 17,
        severity: 'ERROR',
        title: 'General Ledger Anti-Tampering Hash-Chain Broken',
        description: `Cryptographic audit check detected ${sc.hashChainCheck.brokenLinksCount} broken links or modified entries in the general ledger. ${sc.hashChainCheck.summary || ''}`,
        probableCause: 'Direct database edit, deleted entry, or unauthorized schema modification post-signing.',
        recommendedFix: 'Freeze all postings, inspect Security Events log, and verify database against the latest verified backup.',
        evidence: { details: { brokenLinksCount: sc.hashChainCheck.brokenLinksCount } },
        likelihoodScore: 99,
      });
    }
  } else {
    // Automatic on-the-fly verification if entries have cryptographic signatures or hash-chains
    const chainedEntries = (input.entries || []).filter((e) => (e as any).entryHash || (e as any).prevHash);
    if (chainedEntries.length > 0) {
      const hashResult = verifyLedgerHashChain(chainedEntries as any);
      if (!hashResult.isClean) {
        findings.push({
          id: 'finding-r17-hash-chain-tamper',
          ruleNumber: 17,
          severity: 'ERROR',
          title: 'General Ledger Anti-Tampering Hash-Chain Broken',
          description: `Cryptographic verification detected ${hashResult.brokenLinks.length} broken links or corrupted entry hashes in the general ledger.`,
          probableCause: 'Journal entry content (amounts, lines, dates) altered outside normal posting workflow.',
          recommendedFix: 'Review the cryptographic audit trail, audit log, and restore from the last clean backup archive.',
          evidence: {
            documentNumbers: hashResult.brokenLinks.map((b) => b.documentNumber),
            details: { brokenLinks: hashResult.brokenLinks },
          },
          likelihoodScore: 99,
        });
      }
    }
  }

  // Sort findings by likelihood score descending
  const rankedFindings = [...findings].sort((a, b) => b.likelihoodScore - a.likelihoodScore);

  const finalUnexplained = overallDifference - explainedDifference;
  const isClean = overallDifference === 0n && findings.filter((f) => f.severity === 'ERROR').length === 0;

  const plainLanguageSummary = isClean
    ? 'Trial Balance is Healthy: All debits equal credits in base currency (GHS) and per fund. No structural errors detected.'
    : `Difference: GHS ${toMajorUnitsString(overallDifference)}. Explained: GHS ${toMajorUnitsString(explainedDifference)}. Unexplained: GHS ${toMajorUnitsString(finalUnexplained)}. Found ${rankedFindings.length} diagnostic findings.`;

  return {
    runId,
    timestamp,
    totalDebitsGhs: totalDebits,
    totalCreditsGhs: totalCredits,
    totalDifferenceGhs: overallDifference,
    explainedDifferenceGhs: explainedDifference,
    unexplainedDifferenceGhs: finalUnexplained,
    isClean,
    plainLanguageSummary,
    breakdowns: {
      byFund,
      byAccount,
      byCurrency,
      byMonth,
      bySource,
    },
    findings: rankedFindings,
  };
}
