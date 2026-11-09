import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { NavTab } from '../components/Navigation.js';

export type AppRoute =
  | { type: 'tab'; tab: NavTab }
  | { type: 'requisition'; id: string }
  | { type: 'new-requisition' }
  | { type: 'voucher'; id: string }
  | { type: 'asset'; id: string }
  | { type: 'new-asset' }
  | { type: 'tithe-batch'; id: string }
  | { type: 'new-tithe-batch' }
  | { type: 'tithe-record'; id: string }
  | { type: 'member'; id: string }
  | { type: 'journal-entry'; id: string }
  | { type: 'reconciliation'; id: string }
  | { type: 'budget-line'; id: string }
  | { type: 'new-receipt' }
  | { type: 'new-payment' }
  | { type: 'opening-balances' }
  | { type: 'imports'; id?: string }
  | { type: 'go-live' }
  | { type: 'parallel-run' }
  | { type: 'year-end' }
  | { type: 'annual-statements' }
  | { type: 'member-data-requests' }
  | { type: 'security-checklist' }
  | { type: 'sod-exceptions' }
  | { type: 'security-events' };

export interface ListViewState {
  filters?: Record<string, any>;
  scrollY?: number;
  recordIds?: string[];
  activeTab?: string;
}

interface RouterContextType {
  route: AppRoute;
  activeTab: NavTab;
  navigate: (hashOrRoute: string | AppRoute, options?: { listKey?: string; listItemIds?: string[] }) => void;
  navigateToTab: (tab: NavTab) => void;
  navigateToRecord: (type: AppRoute['type'], id: string, listKey?: string, currentRecordIds?: string[]) => void;
  goBack: (fallbackTab?: NavTab) => void;
  saveListState: (listKey: string, state: Partial<ListViewState>) => void;
  getListState: (listKey: string) => ListViewState | undefined;
  getPrevNext: (currentId: string, listKey?: string) => {
    prevId: string | null;
    nextId: string | null;
    currentIndex: number;
    totalCount: number;
  };
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

function parseHash(hash: string): AppRoute {
  const clean = hash.replace(/^#\/?/, '');
  if (!clean || clean === 'dashboard') return { type: 'tab', tab: 'dashboard' };

  const parts = clean.split('/');
  const prefix = parts[0];
  const second = parts[1];
  const third = parts[2];

  // Full page forms with > 5 fields
  if (clean === 'expenses/new-requisition' || clean === 'requisitions/new') return { type: 'new-requisition' };
  if (clean === 'cashbook/new-receipt' || clean === 'receipts/new') return { type: 'new-receipt' };
  if (clean === 'cashbook/new-payment' || clean === 'payments/new') return { type: 'new-payment' };
  if (clean === 'assets/new-asset' || clean === 'assets/new') return { type: 'new-asset' };
  if (clean === 'tithes/new-batch' || clean === 'tithes/batches/new') return { type: 'new-tithe-batch' };
  if (clean === 'opening-balances' || clean === 'settings/opening-balances') return { type: 'opening-balances' };
  if (clean === 'imports' || clean === 'settings/imports') return { type: 'imports' };
  if (prefix === 'imports' && second) return { type: 'imports', id: decodeURIComponent(second) };
  if (clean === 'go-live' || clean === 'settings/go-live') return { type: 'go-live' };
  if (clean === 'parallel-run' || clean === 'settings/parallel-run') return { type: 'parallel-run' };
  if (clean === 'year-end' || clean === 'settings/year-end') return { type: 'year-end' };
  if (clean === 'annual-statements' || clean === 'reports/annual-statements') return { type: 'annual-statements' };
  if (clean === 'member-data-requests' || clean === 'giving/member-data-requests') return { type: 'member-data-requests' };
  if (clean === 'security-checklist' || clean === 'settings/security-checklist') return { type: 'security-checklist' };
  if (clean === 'sod-exceptions' || clean === 'settings/sod-exceptions') return { type: 'sod-exceptions' };
  if (clean === 'security-events' || clean === 'settings/security-events') return { type: 'security-events' };

  // Detail records
  if (prefix === 'requisitions' && second) return { type: 'requisition', id: decodeURIComponent(second) };
  if (prefix === 'vouchers' && second) return { type: 'voucher', id: decodeURIComponent(second) };
  if (prefix === 'assets' && second) return { type: 'asset', id: decodeURIComponent(second) };
  if (prefix === 'tithes' && second === 'batches' && third) return { type: 'tithe-batch', id: decodeURIComponent(third) };
  if (prefix === 'tithes' && second === 'records' && third) return { type: 'tithe-record', id: decodeURIComponent(third) };
  if (prefix === 'members' && second) return { type: 'member', id: decodeURIComponent(second) };
  if (prefix === 'journal' && second) return { type: 'journal-entry', id: decodeURIComponent(second) };
  if (prefix === 'reconciliation' && second) return { type: 'reconciliation', id: decodeURIComponent(second) };
  if (prefix === 'budgets' && second === 'lines' && third) return { type: 'budget-line', id: decodeURIComponent(third) };

  // Standard navigation tabs
  const validTabs: NavTab[] = [
    'dashboard',
    'ledger',
    'trial-balance',
    'counting',
    'tithes',
    'expenses',
    'cashbook',
    'giving',
    'budgets',
    'payroll',
    'reports',
    'doctor',
    'settings',
    'assets',
    'style-guide',
  ];
  if (validTabs.includes(prefix as NavTab)) {
    return { type: 'tab', tab: prefix as NavTab };
  }

  return { type: 'tab', tab: 'dashboard' };
}

function routeToHash(route: AppRoute): string {
  switch (route.type) {
    case 'tab':
      return `#/${route.tab}`;
    case 'requisition':
      return `#/requisitions/${encodeURIComponent(route.id)}`;
    case 'new-requisition':
      return '#/expenses/new-requisition';
    case 'voucher':
      return `#/vouchers/${encodeURIComponent(route.id)}`;
    case 'new-receipt':
      return '#/cashbook/new-receipt';
    case 'new-payment':
      return '#/cashbook/new-payment';
    case 'asset':
      return `#/assets/${encodeURIComponent(route.id)}`;
    case 'new-asset':
      return '#/assets/new-asset';
    case 'tithe-batch':
      return `#/tithes/batches/${encodeURIComponent(route.id)}`;
    case 'new-tithe-batch':
      return '#/tithes/new-batch';
    case 'tithe-record':
      return `#/tithes/records/${encodeURIComponent(route.id)}`;
    case 'member':
      return `#/members/${encodeURIComponent(route.id)}`;
    case 'journal-entry':
      return `#/journal/${encodeURIComponent(route.id)}`;
    case 'reconciliation':
      return `#/reconciliation/${encodeURIComponent(route.id)}`;
    case 'budget-line':
      return `#/budgets/lines/${encodeURIComponent(route.id)}`;
    case 'opening-balances':
      return '#/opening-balances';
    case 'imports':
      return route.id ? `#/imports/${encodeURIComponent(route.id)}` : '#/imports';
    case 'go-live':
      return '#/go-live';
    case 'parallel-run':
      return '#/parallel-run';
    case 'year-end':
      return '#/year-end';
    case 'annual-statements':
      return '#/annual-statements';
    case 'member-data-requests':
      return '#/member-data-requests';
    case 'security-checklist':
      return '#/security-checklist';
    case 'sod-exceptions':
      return '#/sod-exceptions';
    case 'security-events':
      return '#/security-events';
  }
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window !== 'undefined') {
      return parseHash(window.location.hash);
    }
    return { type: 'tab', tab: 'dashboard' };
  });

  // Track parent tab for breadcrumbs and fallback navigation
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const initial = typeof window !== 'undefined' ? parseHash(window.location.hash) : { type: 'tab', tab: 'dashboard' as NavTab };
    if (initial.type === 'tab') return initial.tab;
    if (initial.type === 'requisition' || initial.type === 'new-requisition' || initial.type === 'voucher') return 'expenses';
    if (initial.type === 'new-receipt' || initial.type === 'new-payment' || initial.type === 'reconciliation') return 'cashbook';
    if (initial.type === 'asset' || initial.type === 'new-asset') return 'assets';
    if (initial.type === 'tithe-batch' || initial.type === 'new-tithe-batch' || initial.type === 'tithe-record') return 'tithes';
    if (initial.type === 'member') return 'giving';
    if (initial.type === 'journal-entry') return 'ledger';
    if (initial.type === 'budget-line') return 'budgets';
    if (
      initial.type === 'opening-balances' ||
      initial.type === 'imports' ||
      initial.type === 'go-live' ||
      initial.type === 'parallel-run'
    )
      return 'settings';
    return 'dashboard';
  });

  const [listStates, setListStates] = useState<Record<string, ListViewState>>({});

  // Sync hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash(window.location.hash);
      setRoute(parsed);
      if (parsed.type === 'tab') {
        setActiveTab(parsed.tab);
      } else if (parsed.type === 'requisition' || parsed.type === 'new-requisition' || parsed.type === 'voucher') {
        setActiveTab('expenses');
      } else if (parsed.type === 'new-receipt' || parsed.type === 'new-payment' || parsed.type === 'reconciliation') {
        setActiveTab('cashbook');
      } else if (parsed.type === 'asset' || parsed.type === 'new-asset') {
        setActiveTab('assets');
      } else if (parsed.type === 'tithe-batch' || parsed.type === 'new-tithe-batch' || parsed.type === 'tithe-record') {
        setActiveTab('tithes');
      } else if (parsed.type === 'member') {
        setActiveTab('giving');
      } else if (parsed.type === 'journal-entry') {
        setActiveTab('ledger');
      } else if (parsed.type === 'budget-line') {
        setActiveTab('budgets');
      } else if (
        parsed.type === 'opening-balances' ||
        parsed.type === 'imports' ||
        parsed.type === 'go-live' ||
        parsed.type === 'parallel-run'
      ) {
        setActiveTab('settings');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const saveListState = useCallback((listKey: string, state: Partial<ListViewState>) => {
    setListStates((prev) => ({
      ...prev,
      [listKey]: {
        ...prev[listKey],
        ...state,
      },
    }));
  }, []);

  const navigate = useCallback(
    (hashOrRoute: string | AppRoute, options?: { listKey?: string; listItemIds?: string[] }) => {
      if (options?.listKey) {
        saveListState(options.listKey, {
          scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
          recordIds: options.listItemIds,
        });
      }
      const targetHash = typeof hashOrRoute === 'string' ? hashOrRoute : routeToHash(hashOrRoute);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else {
        setRoute(parseHash(targetHash));
      }
    },
    [saveListState]
  );

  const navigateToTab = useCallback(
    (tab: NavTab) => {
      setActiveTab(tab);
      navigate(`#/${tab}`);
    },
    [navigate]
  );

  const getListState = useCallback((listKey: string) => {
    return listStates[listKey];
  }, [listStates]);

  const navigateToRecord = useCallback(
    (type: AppRoute['type'], id: string, listKey?: string, currentRecordIds?: string[]) => {
      if (listKey) {
        saveListState(listKey, {
          scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
          recordIds: currentRecordIds,
        });
      }
      let hash = '';
      switch (type) {
        case 'requisition':
          hash = `#/requisitions/${encodeURIComponent(id)}`;
          break;
        case 'voucher':
          hash = `#/vouchers/${encodeURIComponent(id)}`;
          break;
        case 'asset':
          hash = `#/assets/${encodeURIComponent(id)}`;
          break;
        case 'tithe-batch':
          hash = `#/tithes/batches/${encodeURIComponent(id)}`;
          break;
        case 'tithe-record':
          hash = `#/tithes/records/${encodeURIComponent(id)}`;
          break;
        case 'member':
          hash = `#/members/${encodeURIComponent(id)}`;
          break;
        case 'journal-entry':
          hash = `#/journal/${encodeURIComponent(id)}`;
          break;
        case 'reconciliation':
          hash = `#/reconciliation/${encodeURIComponent(id)}`;
          break;
        case 'budget-line':
          hash = `#/budgets/lines/${encodeURIComponent(id)}`;
          break;
      }
      if (hash) {
        navigate(hash);
      }
    },
    [navigate, saveListState]
  );

  const goBack = useCallback(
    (fallbackTab?: NavTab) => {
      const targetTab = fallbackTab || activeTab || 'dashboard';
      navigate(`#/${targetTab}`);
      // Restore scroll position
      setTimeout(() => {
        const saved = listStates[targetTab];
        if (saved && typeof saved.scrollY === 'number' && typeof window !== 'undefined') {
          window.scrollTo({ top: saved.scrollY, behavior: 'instant' });
        }
      }, 50);
    },
    [activeTab, listStates, navigate]
  );

  const getPrevNext = useCallback(
    (currentId: string, listKey?: string) => {
      const key = listKey || activeTab;
      const saved = listStates[key];
      const recordIds = saved?.recordIds || [];
      const currentIndex = recordIds.indexOf(currentId);

      if (currentIndex === -1 || recordIds.length === 0) {
        return {
          prevId: null,
          nextId: null,
          currentIndex: -1,
          totalCount: recordIds.length,
        };
      }

      const prevId = currentIndex > 0 ? recordIds[currentIndex - 1]! : null;
      const nextId = currentIndex < recordIds.length - 1 ? recordIds[currentIndex + 1]! : null;

      return {
        prevId,
        nextId,
        currentIndex: currentIndex + 1,
        totalCount: recordIds.length,
      };
    },
    [activeTab, listStates]
  );

  return (
    <RouterContext.Provider
      value={{
        route,
        activeTab,
        navigate,
        navigateToTab,
        navigateToRecord,
        goBack,
        saveListState,
        getListState,
        getPrevNext,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

const defaultRouterContext: RouterContextType = {
  route: { type: 'tab', tab: 'dashboard' },
  activeTab: 'dashboard',
  navigate: (target) => {
    if (typeof target === 'string') {
      window.location.hash = target;
    }
  },
  navigateToTab: (tab) => {
    window.location.hash = `#/${tab}`;
  },
  navigateToRecord: (type, id) => {
    window.location.hash = `#/${type}/${id}`;
  },
  goBack: () => {
    try {
      window.history.back();
    } catch {}
  },
  saveListState: () => {},
  getListState: () => undefined,
  getPrevNext: () => ({
    prevId: null,
    nextId: null,
    currentIndex: -1,
    totalCount: 0,
  }),
};

export function useRouter(): RouterContextType {
  const ctx = useContext(RouterContext);
  return ctx || defaultRouterContext;
}
