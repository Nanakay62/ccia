import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useDemo } from '../context/DemoContext.js';
import { defaultChurchSettings } from '../config/churchSettings.js';
import { SyncIndicator } from './SyncIndicator.js';
import {
  Landmark,
  Lock,
  Moon,
  Sun,
  UserCheck,
  Calendar,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  onOpenRoleSwitcher: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  onToggleTodaySlideOver?: () => void;
  isTodaySlideOverOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRoleSwitcher,
  isDark,
  onToggleDark,
  onToggleTodaySlideOver,
  isTodaySlideOverOpen = false,
}) => {
  const { currentUser, lockApp } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemo();

  return (
    <header className="bg-[var(--surface-panel)] border-b border-[var(--surface-border)] px-4 sm:px-6 py-2.5 sticky top-0 z-30 transition-colors">
      <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-x-4 gap-y-2">
        {/* Left: Church Identity (From Single Source of Truth) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-serif text-[16px] sm:text-[17px] font-semibold text-[var(--text-primary)] leading-tight tracking-tight">
              {defaultChurchSettings.churchName}
            </h1>
            <p className="text-[12px] text-[var(--text-secondary)] leading-none mt-0.5">
              {defaultChurchSettings.branchName}
            </p>
          </div>
        </div>

        {/* Centre: Single Sync Status Indicator (Center on desktop, wrapped row on mobile) */}
        <div className="order-3 md:order-2 w-full md:w-auto flex items-center justify-center pt-2 md:pt-0 border-t md:border-t-0 border-[var(--surface-border-subtle)]">
          <SyncIndicator />
        </div>

        {/* Right: Controls & User Profile */}
        <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Today Panel Toggle for screens < 1500px */}
          {onToggleTodaySlideOver && (
            <button
              onClick={onToggleTodaySlideOver}
              className={`min-[1500px]:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition ${
                isTodaySlideOverOpen
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent'
                  : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
              }`}
              title="Toggle Today Overview Panel"
              aria-label="Toggle Today Overview"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Today</span>
            </button>
          )}

          {/* Proper Demo Mode Switch with amber label (Section 5.3) */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius)] border text-xs transition select-none ${
              isDemoMode
                ? 'bg-[var(--status-amber)]/10 border-[var(--status-amber)]/40 text-[var(--status-amber)] font-bold'
                : 'bg-[var(--surface-subtle)] border-[var(--surface-border)] text-[var(--text-secondary)] font-medium'
            }`}
          >
            <span className="hidden sm:inline">
              {isDemoMode ? 'Demo mode: on' : 'Demo mode: off'}
            </span>
            <button
              role="switch"
              aria-checked={isDemoMode}
              onClick={toggleDemoMode}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
                isDemoMode ? 'bg-[var(--status-amber)]' : 'bg-[var(--surface-border)]'
              }`}
              title="Toggle Demo Mode"
              aria-label={isDemoMode ? 'Demo mode: on' : 'Demo mode: off'}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isDemoMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Active User / Role Switcher */}
          <button
            onClick={onOpenRoleSwitcher}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-left transition select-none"
            title="Click to switch test role"
            aria-label="Click to switch test role"
          >
            <UserCheck className="w-4 h-4 text-[var(--accent)]" />
            <div className="hidden sm:block">
              <div className="text-[13px] font-medium text-[var(--text-primary)] leading-tight">
                {currentUser.fullName}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] leading-none mt-0.5">
                {currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-[var(--radius)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
            title={isDark ? 'Light Theme' : 'Dark Theme'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Quick Lock Button (with tooltip "Lock App" for keyboard & test accessibility) */}
          <button
            onClick={lockApp}
            className="p-2 rounded-[var(--radius)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
            title="Lock App"
            aria-label="Lock terminal"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
