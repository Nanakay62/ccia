import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { DemoProvider } from './context/DemoContext.js';
import { SyncProvider } from './context/SyncContext.js';
import { LedgerProvider } from './context/LedgerContext.js';
import { GivingProvider } from './context/GivingContext.js';
import { ExpensesProvider } from './context/ExpensesContext.js';
import { ReportsProvider } from './context/ReportsContext.js';
import { BudgetProvider } from './context/BudgetContext.js';
import { PayrollProvider } from './context/PayrollContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <DemoProvider>
        <SyncProvider>
          <LedgerProvider>
            <GivingProvider>
              <ExpensesProvider>
                <ReportsProvider>
                  <BudgetProvider>
                    <PayrollProvider>
                      <App />
                    </PayrollProvider>
                  </BudgetProvider>
                </ReportsProvider>
              </ExpensesProvider>
            </GivingProvider>
          </LedgerProvider>
        </SyncProvider>
      </DemoProvider>
    </AuthProvider>
  </React.StrictMode>
);
