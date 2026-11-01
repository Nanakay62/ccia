import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Lock, ShieldAlert, AlertTriangle } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { currentUser, unlockApp } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleKeyPress = (num: string) => {
    if (lockoutSeconds > 0) return;
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verify(nextPin);
      }
    }
  };

  const handleClear = () => {
    if (lockoutSeconds > 0) return;
    setPin('');
    setError(false);
  };

  const verify = (testPin: string) => {
    const success = unlockApp(testPin);
    if (!success) {
      setError(true);
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);

      if (nextAttempts >= 5) {
        setLockoutSeconds(30);
        setFailedAttempts(0);
      }

      setTimeout(() => {
        setPin('');
        setError(false);
      }, 700);
    } else {
      setFailedAttempts(0);
      setLockoutSeconds(0);
    }
  };

  const isLockedOut = lockoutSeconds > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 text-white">
      <div className="max-w-xs w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 text-blue-400 mb-2 border border-blue-500/30">
          <Lock className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-xl font-bold">App Locked</h1>
          <p className="text-xs text-slate-400 mt-1">
            Session protected for {currentUser.fullName}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Default test PIN: <span className="font-mono text-blue-400">1234</span>
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border transition-all ${
                error
                  ? 'border-rose-500 bg-rose-500 animate-bounce'
                  : pin.length > idx
                  ? 'border-blue-400 bg-blue-400 scale-110'
                  : 'border-slate-700 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {isLockedOut ? (
          <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-950/60 border border-amber-800 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Too many attempts. Locked for {lockoutSeconds}s</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Invalid PIN ({5 - failedAttempts} attempts remaining)</span>
          </div>
        ) : null}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
            <button
              key={k}
              type="button"
              disabled={isLockedOut}
              onClick={() => {
                if (k === 'C') handleClear();
                else if (k === '⌫') setPin((p) => p.slice(0, -1));
                else handleKeyPress(k);
              }}
              className={`h-14 rounded-xl border font-semibold text-lg transition flex items-center justify-center ${
                isLockedOut
                  ? 'bg-slate-900/50 border-slate-900 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-800 active:scale-95 text-slate-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
