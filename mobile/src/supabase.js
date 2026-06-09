import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Read from EXPO_PUBLIC_* env vars so the actual values live in `.env`
// (gitignored) and are inlined into the bundle at build time by Metro.
// The "anon" Supabase key is designed to be public: it is the same key that
// ships in every client, and Supabase security depends on Row Level Security,
// not on hiding the key. The only key that must NEVER be committed is the
// `service_role` key (kept only in the EAS Submit / Supabase dashboard).
const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL     || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const ExpoSecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} catch (e) {
  console.error('Supabase init failed:', e);
  supabase = { auth: { getSession: () => Promise.resolve({ data: null }), signInWithOtp: () => Promise.resolve({ error: new Error('Supabase unavailable') }), verifyOtp: () => Promise.resolve({ error: new Error('Supabase unavailable') }) } };
}

export { supabase };
