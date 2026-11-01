import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
export const SAMPLE_USERS = {
    treasurer: {
        id: 'user-0001-treasurer',
        fullName: 'Kofi Mensah (Treasurer)',
        email: 'treasurer@accrachurch.org',
        role: 'Treasurer',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-TR-01',
        devicePrefix: 'TR-D01',
    },
    finance_sec: {
        id: 'user-0002-finsec',
        fullName: 'Akosua Osei (Finance Secretary)',
        email: 'finance.sec@accrachurch.org',
        role: 'Finance Secretary',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-FS-01',
        devicePrefix: 'FS-D01',
    },
    counter1: {
        id: 'user-0003-counter1',
        fullName: 'Kwame Boateng (Counter A)',
        email: 'counter1@accrachurch.org',
        role: 'Counter',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-CS-01',
        devicePrefix: 'CS-D01',
    },
    counter2: {
        id: 'user-0004-counter2',
        fullName: 'Abena Poku (Counter B)',
        email: 'counter2@accrachurch.org',
        role: 'Counter',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-CS-02',
        devicePrefix: 'CS-D02',
    },
    pastor: {
        id: 'user-0005-pastor',
        fullName: 'Rev. Emmanuel Addo (Senior Pastor / Elder)',
        email: 'pastor@accrachurch.org',
        role: 'Pastor / Elder',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-PE-01',
        devicePrefix: 'PE-D01',
    },
    auditor: {
        id: 'user-0006-auditor',
        fullName: 'Justice Appiah, CA (Auditor)',
        email: 'auditor@accrachurch.org',
        role: 'Auditor',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-AU-01',
        devicePrefix: 'AU-D01',
    },
    dept_head: {
        id: 'user-0007-depthead',
        fullName: 'Yaw Kwarteng (Youth Director)',
        email: 'youth@accrachurch.org',
        role: 'Department Head',
        departmentId: 'dept_youth',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-DH-01',
        devicePrefix: 'DH-D01',
    },
    admin: {
        id: 'user-0008-admin',
        fullName: 'Admin User (IT Administrator)',
        email: 'admin@accrachurch.org',
        role: 'Admin',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Accra Central Branch',
        deviceId: 'DEV-AD-01',
        devicePrefix: 'AD-D01',
    },
};
const AuthContext = createContext(undefined);
const CACHED_USER_KEY = 'church_accounts_cached_user';
const CACHED_LOCK_STATE = 'church_accounts_is_locked';
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const cached = localStorage.getItem(CACHED_USER_KEY);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch {
            // Fallback
        }
        return SAMPLE_USERS.treasurer;
    });
    const [isLocked, setIsLocked] = useState(() => {
        return localStorage.getItem(CACHED_LOCK_STATE) === 'true';
    });
    useEffect(() => {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(currentUser));
    }, [currentUser]);
    useEffect(() => {
        localStorage.setItem(CACHED_LOCK_STATE, isLocked ? 'true' : 'false');
    }, [isLocked]);
    const lockApp = () => {
        setIsLocked(true);
    };
    const unlockApp = (pin) => {
        // Standard church dev pin: 1234
        if (pin === '1234' || pin === '0000') {
            setIsLocked(false);
            return true;
        }
        return false;
    };
    const switchUser = (userKey) => {
        const user = SAMPLE_USERS[userKey];
        if (user) {
            setCurrentUser(user);
        }
    };
    const switchRole = (role) => {
        const found = Object.values(SAMPLE_USERS).find((u) => u.role === role);
        if (found) {
            setCurrentUser(found);
        }
        else {
            setCurrentUser((prev) => ({ ...prev, role }));
        }
    };
    return (_jsx(AuthContext.Provider, { value: {
            currentUser,
            isLocked,
            lockApp,
            unlockApp,
            switchUser,
            switchRole,
        }, children: children }));
};
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
