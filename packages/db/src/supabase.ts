import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Universal Supabase environment variable resolver
 * Works across both Vite browser runtime (import.meta.env) and Node.js (process.env).
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  let url = '';
  let anonKey = '';

  // 1. Check Vite browser environment
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      url = (import.meta as any).env.VITE_SUPABASE_URL || '';
      anonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
    }
  } catch {}

  // 2. Check Node.js / SSR process environment
  if (!url || !anonKey) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        url = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        anonKey = anonKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      }
    } catch {}
  }

  // Sanitize URL: strip trailing slashes or /rest/v1 if inadvertently included
  const cleanUrl = url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
  return { url: cleanUrl, anonKey: anonKey.trim() };
}

/**
 * Checks whether valid Supabase configuration is present.
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey.length > 20 &&
    !url.includes('your-project') &&
    !anonKey.includes('your-supabase-anon-key')
  );
}

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a singleton SupabaseClient if environment variables are configured,
 * or null if running in pure offline/local mode.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const { url, anonKey } = getSupabaseEnv();
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'church_accounting_supabase_auth_v1',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return cachedClient;
  } catch (err) {
    console.warn('[Supabase] Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Explicitly reset or reconfigure client (useful for testing or switching environments)
 */
export function setSupabaseClient(client: SupabaseClient | null): void {
  cachedClient = client;
}

/**
 * Helper to execute a Supabase RPC function with typed error formatting
 */
export async function executeSupabaseRpc(
  rpcName: string,
  params: Record<string, unknown>
): Promise<{
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: {
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Supabase is not configured or offline. Operating in local mode.',
      },
    };
  }

  try {
    const { data, error } = await client.rpc(rpcName, params);

    if (error) {
      return {
        success: false,
        error: {
          code: error.code || 'RPC_ERROR',
          message: error.message || 'Database RPC invocation failed',
          details: error.details || error.hint,
        },
      };
    }

    return {
      success: true,
      data,
    };
  } catch (ex) {
    return {
      success: false,
      error: {
        code: 'NETWORK_EXCEPTION',
        message: ex instanceof Error ? ex.message : 'Unknown network failure during RPC',
      },
    };
  }
}

/**
 * Storage helpers for document and voucher attachments
 */
export const ATTACHMENTS_BUCKET = 'church-attachments';

export async function uploadAttachmentToCloud(
  path: string,
  file: Blob | File | Uint8Array,
  contentType?: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client not configured' };
  }

  try {
    const { data, error } = await client.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, {
        contentType: contentType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: urlData } = client.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(data.path);
    return {
      success: true,
      publicUrl: urlData?.publicUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Storage upload error',
    };
  }
}
