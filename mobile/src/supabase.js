import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl     = 'https://mmxlaboadcwlbwnshmxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1teGxhYm9hZGN3bGJ3bnNobXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyOTA2NjYsImV4cCI6MjA5Mzg2NjY2Nn0.XbfJog8Mq5ku-FRCd0Dadi62eGY2vXSz7mBcG24BWRQ';

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
