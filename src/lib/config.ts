// ReKnee AI - Configuration & Environment Variable Handler
// Safe client-side environment handling strictly adhering to 08_PROJECT_SETUP.md and 16_SECURITY_AUDIT.md

interface AppConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  isConfigured: boolean;
  appEnv: 'development' | 'production' | 'test';
}

function resolveConfig(): AppConfig {
  const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<string, string | undefined>;
  const url = (env.VITE_SUPABASE_URL as string) || null;
  const anonKey = (env.VITE_SUPABASE_ANON_KEY as string) || null;

  const isConfigured = Boolean(
    url &&
    anonKey &&
    url !== 'https://your-project.supabase.co' &&
    !url.includes('your-project')
  );

  return {
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    isConfigured,
    appEnv: (env.MODE as AppConfig['appEnv']) || 'development',
  };
}

export const config = resolveConfig();
