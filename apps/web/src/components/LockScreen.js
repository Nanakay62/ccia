import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Lock, ShieldAlert } from 'lucide-react';
export const LockScreen = () => {
    const { currentUser, unlockApp } = useAuth();
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const handleKeyPress = (num) => {
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
    const verify = (testPin) => {
        const success = unlockApp(testPin);
        if (!success) {
            setError(true);
            setTimeout(() => {
                setPin('');
                setError(false);
            }, 700);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 text-white", children: _jsxs("div", { className: "max-w-xs w-full text-center space-y-6", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 text-blue-400 mb-2 border border-blue-500/30", children: _jsx(Lock, { className: "w-8 h-8" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold", children: "App Locked" }), _jsxs("p", { className: "text-xs text-slate-400 mt-1", children: ["Session protected for ", currentUser.fullName] }), _jsxs("p", { className: "text-[11px] text-slate-500 mt-0.5", children: ["Default test PIN: ", _jsx("span", { className: "font-mono text-blue-400", children: "1234" })] })] }), _jsx("div", { className: "flex justify-center gap-4 py-2", children: [0, 1, 2, 3].map((idx) => (_jsx("div", { className: `w-4 h-4 rounded-full border transition-all ${error
                            ? 'border-rose-500 bg-rose-500 animate-bounce'
                            : pin.length > idx
                                ? 'border-blue-400 bg-blue-400 scale-110'
                                : 'border-slate-700 bg-slate-800'}` }, idx))) }), error && (_jsxs("div", { className: "flex items-center justify-center gap-1.5 text-xs text-rose-400", children: [_jsx(ShieldAlert, { className: "w-4 h-4" }), _jsx("span", { children: "Invalid PIN. Try 1234" })] })), _jsx("div", { className: "grid grid-cols-3 gap-3 pt-2", children: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (_jsx("button", { type: "button", onClick: () => {
                            if (k === 'C')
                                handleClear();
                            else if (k === '⌫')
                                setPin((p) => p.slice(0, -1));
                            else
                                handleKeyPress(k);
                        }, className: "h-14 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 font-semibold text-lg transition flex items-center justify-center text-slate-200", children: k }, k))) })] }) }));
};
