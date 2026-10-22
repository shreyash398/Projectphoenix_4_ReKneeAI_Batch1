import { createClient, SupabaseClient } from '@supabase/supabase-js';

const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('your-project')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

if (!isSupabaseConfigured) {
  console.info(
    'ReKnee AI: Running in resilient synthetic demo mode (Supabase URL/Key not configured or placeholder).'
  );
}
