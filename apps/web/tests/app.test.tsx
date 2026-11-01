import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';

describe('Web App Shell & Role-Based UI', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderApp = () =>
    render(
      <AuthProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </AuthProvider>
    );

  it('renders header with Accra Central Church branding and Treasurer by default', () => {
    renderApp();
    expect(screen.getByText(/Accra Central Church/i)).toBeDefined();
    expect(screen.getByText(/Accra Central Branch/i)).toBeDefined();
    expect(screen.getAllByText(/Treasurer/i).length).toBeGreaterThan(0);
  });

  it('renders the persistent sync status indicator', () => {
    renderApp();
    expect(screen.getAllByText(/Online/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/waiting to sync/i)).toBeDefined();
    expect(screen.getByText(/Need Attention/i)).toBeDefined();
  });

  it('allows switching to Counter role and masks individual giving records', () => {
    renderApp();

    // Default Treasurer sees unmasked donor names
    expect(screen.getByText('Kwame Mensah')).toBeDefined();

    // Open Role Switcher
    const roleButton = screen.getByTitle(/Click to switch test role/i);
    fireEvent.click(roleButton);

    // Select Counter
    const counterOption = screen.getByText(/Kwame Boateng \(Counter A\)/i);
    fireEvent.click(counterOption);

    // After switching to Counter, privacy rule should mask individual giving
    expect(screen.queryByText('Kwame Mensah')).toBeNull();
    expect(screen.getAllByText(/Confidential/i).length).toBeGreaterThan(0);
  });

  it('locks the app and unlocks with PIN 1234', () => {
    renderApp();

    // Click lock button
    const lockBtn = screen.getByTitle('Lock App');
    fireEvent.click(lockBtn);

    expect(screen.getByText('App Locked')).toBeDefined();

    // Enter PIN 1 2 3 4
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));

    // Should unlock and show dashboard again
    expect(screen.getByText(/Accra Central Church/i)).toBeDefined();
  });
});
