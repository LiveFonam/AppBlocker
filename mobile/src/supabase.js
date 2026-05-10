import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

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
