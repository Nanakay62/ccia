import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { ApprovalProvider } from './context/ApprovalContext.js';
import { DemoProvider } from './context/DemoContext.js';
import { SyncProvider } from './context/SyncContext.js';
import { LedgerProvider } from './context/LedgerContext.js';
import { SecurityEventsProvider } from './context/SecurityEventsContext.js';
import { GivingProvider } from './context/GivingContext.js';
import { ExpensesProvider } from './context/ExpensesContext.js';
import { ReportsProvider } from './context/ReportsContext.js';
import { BudgetProvider } from './context/BudgetContext.js';
import { PayrollProvider } from './context/PayrollContext.js';
import { CashbookProvider } from './context/CashbookContext.js';
import { TithesProvider } from './context/TithesContext.js';
import { FixedAssetsProvider } from './context/FixedAssetsContext.js';
import { ToastProvider } from './context/ToastContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ApprovalProvider>
        <DemoProvider>
          <SyncProvider>
            <LedgerProvider>
              <SecurityEventsProvider>
                <GivingProvider>
                  <ExpensesProvider>
                    <ReportsProvider>
                      <BudgetProvider>
                        <PayrollProvider>
                          <CashbookProvider>
                            <TithesProvider>
                              <FixedAssetsProvider>
                                <ToastProvider>
                                  <App />
                                </ToastProvider>
                              </FixedAssetsProvider>
                            </TithesProvider>
                          </CashbookProvider>
                        </PayrollProvider>
                      </BudgetProvider>
                    </ReportsProvider>
                  </ExpensesProvider>
                </GivingProvider>
              </SecurityEventsProvider>
            </LedgerProvider>
          </SyncProvider>
        </DemoProvider>
      </ApprovalProvider>
    </AuthProvider>
  </React.StrictMode>
);
