/**
 * Financial Reports domain types.
 * Pure TypeScript representation of all 11 financial statements and reporting views.
 */

import type { AccountType, FundType } from '../ledger/types.js';

export interface ReportLineItem {
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType?: AccountType;
  readonly fundId?: string;
  readonly fundName?: string;
  readonly amountPesewas: bigint;
}

// 1. Income & Expenditure Statement
export interface IncomeExpenditureReport {
  readonly title: string;
  readonly churchName: string;
  readonly branchName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: 'GHS';
  readonly incomes: readonly ReportLineItem[];
  readonly totalIncomePesewas: bigint;
  readonly expenses: readonly ReportLineItem[];
  readonly totalExpensePesewas: bigint;
  readonly netSurplusDeficitPesewas: bigint; // positive = surplus, negative = deficit
  readonly fundBreakdown: readonly {
    readonly fundId: string;
    readonly fundName: string;
    readonly fundType: FundType;
    readonly incomePesewas: bigint;
    readonly expensePesewas: bigint;
    readonly netPesewas: bigint;
  }[];
}

// 2. Balance Sheet / Statement of Financial Position
export interface BalanceSheetReport {
  readonly title: string;
  readonly churchName: string;
  readonly branchName: string;
  readonly asOfDate: string;
  readonly currency: 'GHS';
  readonly currentAssets: readonly ReportLineItem[];
  readonly nonCurrentAssets: readonly ReportLineItem[];
  readonly totalAssetsPesewas: bigint;
  readonly currentLiabilities: readonly ReportLineItem[];
  readonly nonCurrentLiabilities: readonly ReportLineItem[];
  readonly totalLiabilitiesPesewas: bigint;
  readonly unrestrictedFundBalancesPesewas: bigint;
  readonly restrictedFundBalancesPesewas: bigint;
  readonly fundBalances: readonly {
    readonly fundId: string;
    readonly fundName: string;
    readonly fundType: FundType;
    readonly balancePesewas: bigint;
  }[];
  readonly totalFundBalancesPesewas: bigint;
  readonly totalLiabilitiesAndFundsPesewas: bigint;
  readonly isBalanced: boolean; // Assets === Liabilities + Fund Balances
}

// 3. Fund Balance Report (Restricted vs Unrestricted)
export interface FundBalanceItemReport {
  readonly fundId: string;
  readonly fundCode: string;
  readonly fundName: string;
  readonly fundType: FundType;
  readonly openingBalancePesewas: bigint;
  readonly receiptsPesewas: bigint;
  readonly disbursementsPesewas: bigint;
  readonly interfundTransfersPesewas: bigint;
  readonly closingBalancePesewas: bigint;
  readonly isOverdrawn: boolean;
}

export interface FundBalanceReport {
  readonly title: string;
  readonly asOfDate: string;
  readonly currency: 'GHS';
  readonly funds: readonly FundBalanceItemReport[];
  readonly totalUnrestrictedPesewas: bigint;
  readonly totalRestrictedPesewas: bigint;
  readonly grandTotalPesewas: bigint;
}

// 4. Budget vs Actual Report
export interface BudgetVsActualItem {
  readonly accountCode: string;
  readonly accountName: string;
  readonly category: 'INCOME' | 'EXPENSE';
  readonly budgetPesewas: bigint;
  readonly actualPesewas: bigint;
  readonly variancePesewas: bigint; // For Income: Actual - Budget. For Expense: Budget - Actual.
  readonly variancePercentage: number;
  readonly isFavourable: boolean;
}

export interface BudgetVsActualReport {
  readonly title: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: 'GHS';
  readonly items: readonly BudgetVsActualItem[];
  readonly totalBudgetIncomePesewas: bigint;
  readonly totalActualIncomePesewas: bigint;
  readonly totalBudgetExpensePesewas: bigint;
  readonly totalActualExpensePesewas: bigint;
  readonly netBudgetSurplusPesewas: bigint;
  readonly netActualSurplusPesewas: bigint;
}

// 5. Cash Flow Summary (Direct method)
export interface CashFlowReport {
  readonly title: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: 'GHS';
  readonly operatingInflows: readonly ReportLineItem[];
  readonly totalOperatingInflowsPesewas: bigint;
  readonly operatingOutflows: readonly ReportLineItem[];
  readonly totalOperatingOutflowsPesewas: bigint;
  readonly netCashFromOperationsPesewas: bigint;
  readonly investingOutflows: readonly ReportLineItem[];
  readonly netCashFromInvestingPesewas: bigint;
  readonly financingInflows: readonly ReportLineItem[];
  readonly netCashFromFinancingPesewas: bigint;
  readonly netChangeInCashPesewas: bigint;
  readonly openingCashAndBankPesewas: bigint;
  readonly closingCashAndBankPesewas: bigint;
}

// 6. Giving Summary by Fund & Category
export interface GivingCategoryBreakdown {
  readonly category: string;
  readonly count: number;
  readonly totalPesewas: bigint;
  readonly percentage: number;
}

export interface GivingChannelBreakdown {
  readonly channel: 'CASH_GHS' | 'CASH_USD' | 'CHEQUE' | 'MOMO';
  readonly channelLabel: string;
  readonly count: number;
  readonly totalPesewas: bigint;
}

export interface GivingSummaryReport {
  readonly title: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: 'GHS';
  readonly byCategory: readonly GivingCategoryBreakdown[];
  readonly byFund: readonly {
    readonly fundName: string;
    readonly totalPesewas: bigint;
    readonly percentage: number;
  }[];
  readonly byChannel: readonly GivingChannelBreakdown[];
  readonly totalGivingPesewas: bigint;
  readonly totalTransactions: number;
}

// 7. Pledge Status Report
export interface CampaignPledgeSummary {
  readonly campaignName: string;
  readonly fundName: string;
  readonly targetPesewas: bigint;
  readonly totalPledgedPesewas: bigint;
  readonly totalFulfilledPesewas: bigint;
  readonly outstandingPesewas: bigint;
  readonly fulfillmentPercentage: number;
  readonly donorCount: number;
}

export interface PledgeStatusItem {
  readonly pledgeId: string;
  readonly donorName: string;
  readonly campaignName: string;
  readonly pledgedPesewas: bigint;
  readonly fulfilledPesewas: bigint;
  readonly outstandingPesewas: bigint;
  readonly status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
}

export interface PledgeStatusReport {
  readonly title: string;
  readonly asOfDate: string;
  readonly campaigns: readonly CampaignPledgeSummary[];
  readonly pledges: readonly PledgeStatusItem[];
  readonly totalPledgedPesewas: bigint;
  readonly totalFulfilledPesewas: bigint;
  readonly totalOutstandingPesewas: bigint;
}

// 8. Bank & Cash Reconciliation Report
export interface BankReconciliationReport {
  readonly title: string;
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly asOfDate: string;
  readonly currency: 'GHS';
  readonly bookBalancePesewas: bigint;
  readonly outstandingCheques: readonly { readonly reference: string; readonly payee: string; readonly amountPesewas: bigint }[];
  readonly totalOutstandingChequesPesewas: bigint;
  readonly depositsInTransit: readonly { readonly reference: string; readonly source: string; readonly amountPesewas: bigint }[];
  readonly totalDepositsInTransitPesewas: bigint;
  readonly adjustedBookBalancePesewas: bigint;
  readonly bankStatementBalancePesewas: bigint;
  readonly discrepancyPesewas: bigint;
  readonly isReconciled: boolean;
}

// 9. Append-Only Audit Log Report
export interface AuditLogReportItem {
  readonly id: string;
  readonly timestamp: string;
  readonly userId: string;
  readonly userName: string;
  readonly userRole: string;
  readonly deviceId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly details: string;
}

export interface AuditLogReport {
  readonly title: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly entries: readonly AuditLogReportItem[];
  readonly totalEvents: number;
}

// 10. Denomination USD Summary Report
export interface DenominationUsdSummaryReport {
  readonly title: string;
  readonly churchName: string;
  readonly branchName: string;
  readonly asOfDate: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly exchangeRate: string; // e.g. "15.5000"
  readonly rateBasis: 'CLOSING_RATE' | 'PERIOD_AVERAGE';
  readonly statementOfActivities: {
    readonly totalIncomeUsdCents: bigint;
    readonly totalExpenseUsdCents: bigint;
    readonly netSurplusDeficitUsdCents: bigint;
    readonly mainIncomeLines: readonly { readonly name: string; readonly amountUsdCents: bigint }[];
    readonly mainExpenseLines: readonly { readonly name: string; readonly amountUsdCents: bigint }[];
  };
  readonly statementOfPosition: {
    readonly totalAssetsUsdCents: bigint;
    readonly totalLiabilitiesUsdCents: bigint;
    readonly unrestrictedFundsUsdCents: bigint;
    readonly restrictedFundsUsdCents: bigint;
    readonly totalNetAssetsUsdCents: bigint;
    readonly cashAndBankUsdCents: bigint;
  };
  readonly mandatoryDisclosureFootnote: string;
}
