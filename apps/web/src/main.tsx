import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { SyncProvider } from './context/SyncContext.js';
import { LedgerProvider } from './context/LedgerContext.js';
import { GivingProvider } from './context/GivingContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SyncProvider>
        <LedgerProvider>
          <GivingProvider>
            <App />
          </GivingProvider>
        </LedgerProvider>
      </SyncProvider>
    </AuthProvider>
  </React.StrictMode>
);
