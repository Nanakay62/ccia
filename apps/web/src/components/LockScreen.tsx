import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Lock, ShieldAlert } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { currentUser, unlockApp } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verify(nextPin);
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const verify = (testPin: string) => {
    const success = unlockApp(testPin);
    if (!success) {
      setError(true);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 700);
    }
  };

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

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Invalid PIN. Try 1234</span>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === 'C') handleClear();
                else if (k === '⌫') setPin((p) => p.slice(0, -1));
                else handleKeyPress(k);
              }}
              className="h-14 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 font-semibold text-lg transition flex items-center justify-center text-slate-200"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
