import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useDemo } from '../context/DemoContext.js';
import { Landmark, Lock, Moon, Sun, UserCheck, Sparkles } from 'lucide-react';
import { SyncIndicator } from './SyncIndicator.js';

interface Props {
  onOpenRoleSwitcher: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export const Header: React.FC<Props> = ({ onOpenRoleSwitcher, isDark, onToggleDark }) => {
  const { currentUser, lockApp } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemo();

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 sticky top-0 z-30 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left: Branding & Branch */}
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                Accra Central Church
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Accounts Office • <span className="text-blue-600 dark:text-blue-400 font-medium">{currentUser.branchName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Center: Integrated Sync Indicator */}
        <div className="flex items-center justify-center border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-slate-800/80">
          <SyncIndicator embedded />
        </div>

        {/* Right: Controls & Role Profile */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5">
          {/* Demo Mode Toggle Button */}
          <button
            onClick={toggleDemoMode}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
              isDemoMode
                ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="Toggle Demo Mode (300 members & 6 months transactions)"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isDemoMode ? 'text-amber-300' : 'text-purple-500'}`} />
            <span className="hidden sm:inline">{isDemoMode ? 'Demo Mode: ON' : 'Demo Mode'}</span>
            <span className="sm:hidden">{isDemoMode ? 'Demo ON' : 'Demo'}</span>
          </button>

          {/* Role badge button */}
          <button
            onClick={onOpenRoleSwitcher}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition text-left shadow-sm"
            title="Click to switch test role"
          >
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {currentUser.fullName}
              </div>
              <div className="text-[9px] text-blue-600 dark:text-blue-400 uppercase tracking-wider font-bold">
                {currentUser.role}
              </div>
            </div>
            <span className="sm:hidden text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
              {currentUser.role}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Lock App */}
          <button
            onClick={lockApp}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
            title="Lock App"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
