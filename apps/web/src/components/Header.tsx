import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Landmark, Lock, Moon, Sun, UserCheck } from 'lucide-react';

interface Props {
  onOpenRoleSwitcher: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export const Header: React.FC<Props> = ({ onOpenRoleSwitcher, isDark, onToggleDark }) => {
  const { currentUser, lockApp } = useAuth();

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Branding & Branch */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
              Accra Central Church
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Accounts Office • <span className="text-blue-600 dark:text-blue-400 font-medium">{currentUser.branchName}</span>
            </p>
          </div>
        </div>

        {/* Right: Controls & Role Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Role badge button */}
          <button
            onClick={onOpenRoleSwitcher}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition text-left"
            title="Click to switch test role"
          >
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {currentUser.fullName}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
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
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Lock App */}
          <button
            onClick={lockApp}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Lock App"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
