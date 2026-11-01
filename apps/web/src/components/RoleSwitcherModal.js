import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth, SAMPLE_USERS } from '../context/AuthContext.js';
import { Check, Shield, X } from 'lucide-react';
export const RoleSwitcherModal = ({ isOpen, onClose }) => {
    const { currentUser, switchUser } = useAuth();
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800", children: [_jsxs("div", { className: "flex items-center gap-2 font-semibold text-slate-900 dark:text-white", children: [_jsx(Shield, { className: "w-5 h-5 text-blue-600" }), _jsx("span", { children: "Switch Role / User (Testing)" })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 dark:hover:text-white p-1", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-2", children: "Select a role to verify permission gates, giving privacy, and workflow approvals:" }), _jsx("div", { className: "mt-4 space-y-2", children: Object.entries(SAMPLE_USERS).map(([key, u]) => {
                        const isSelected = currentUser.id === u.id;
                        return (_jsxs("button", { onClick: () => {
                                switchUser(key);
                                onClose();
                            }, className: `w-full text-left p-3 rounded-lg border transition flex items-center justify-between ${isSelected
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-medium'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'}`, children: [_jsxs("div", { children: [_jsxs("div", { className: "text-sm font-medium flex items-center gap-2", children: [_jsx("span", { children: u.fullName }), _jsx("span", { className: "text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300", children: u.role })] }), _jsxs("div", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: ["Prefix: ", u.devicePrefix, " \u2022 Device: ", u.deviceId] })] }), isSelected && _jsx(Check, { className: "w-5 h-5 text-blue-600" })] }, key));
                    }) }), _jsx("div", { className: "mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end", children: _jsx("button", { onClick: onClose, className: "px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded font-medium text-xs", children: "Close" }) })] }) }));
};
