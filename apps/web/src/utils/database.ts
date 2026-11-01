/**
 * Isolated Storage Database for Church Accounting System.
 * Implements Section 5.1 (Two separate databases).
 * 
 * Strict partition between live church records ('church_live_*')
 * and sandbox training data ('church_demo_*').
 */

export function getStorageKey(prefix: string, isDemo: boolean): string {
  const namespace = isDemo ? 'church_demo_' : 'church_live_';
  return `${namespace}${prefix}`;
}

export function loadFromStore<T>(prefix: string, isDemo: boolean, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const key = getStorageKey(prefix, isDemo);
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    // Custom JSON reviver for BigInt support (pesewas amounts)
    return JSON.parse(raw, (_k, v) => {
      if (typeof v === 'string' && /^\d+n$/.test(v)) {
        return BigInt(v.slice(0, -1));
      }
      return v;
    }) as T;
  } catch (err) {
    console.warn(`Failed to read ${prefix} from storage:`, err);
    return fallback;
  }
}

export function saveToStore<T>(prefix: string, isDemo: boolean, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const key = getStorageKey(prefix, isDemo);
    // Custom JSON replacer for BigInt support
    const serialized = JSON.stringify(data, (_k, v) => {
      if (typeof v === 'bigint') {
        return `${v.toString()}n`;
      }
      return v;
    });
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.warn(`Failed to write ${prefix} to storage:`, err);
  }
}

export function clearDemoDatabase(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('church_demo_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Failed to clear demo database:', err);
  }
}
