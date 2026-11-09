import React from 'react';
import { useCashbook } from '../../context/CashbookContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { BankReconciliationTab } from './BankReconciliationTab.js';

export interface BankReconciliationDetailPageProps {
  id: string;
}

export const BankReconciliationDetailPage: React.FC<BankReconciliationDetailPageProps> = ({ id }) => {
  const { reconciliations, cashAccounts } = useCashbook();
  const { navigate, goBack } = useRouter();

  const rec = reconciliations.find((r) => r.id === id);
  const acct = cashAccounts.find((a) => a.id === rec?.bankAccountId);
  const accountLabel = acct?.name || rec?.bankAccountId || 'Bank Account';

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <PageBreadcrumb
        items={[
          { label: 'Cashbook', onClick: () => navigate('#/cashbook') },
          { label: 'Bank Reconciliations', onClick: () => navigate('#/cashbook') },
          { label: rec ? `${accountLabel} (${rec.statementDate})` : id },
        ]}
        currentId={rec?.id || id}
        listKey="reconciliation"
        onBack={() => goBack('cashbook')}
      />

      <BankReconciliationTab />
    </div>
  );
};
