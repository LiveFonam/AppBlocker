import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Keys we ever write to SecureStore. Add to this list when adding a new
// SecureStore key. Kept here so account-deletion can wipe them all in one go.
const KNOWN_SECURE_KEYS = [
  '@nova_pin',
  'supabase-auth-token',
  'nova_friend_secret_outgoing',
  'nova_friend_secrets_incoming',
]

// Wrapper that prefers SecureStore, falls back to AsyncStorage for backward
// compat with users who installed a build that stored values in AsyncStorage
// before we migrated. Migration is automatic: a one-time read+write.
async function getPinCompat(key) {
  try {
    const v = await SecureStore.getItemAsync(key)
    if (v != null) return v
  } catch (_) {}
  try {
    return await AsyncStorage.getItem(key)
  } catch (_) { return null }
}

async function setPinCompat(key, value) {
  try { await SecureStore.setItemAsync(key, value) } catch (_) {}
  try { await AsyncStorage.setItem(key, value) } catch (_) {}
}

async function removePinCompat(key) {
  try { await SecureStore.deleteItemAsync(key) } catch (_) {}
  try { await AsyncStorage.removeItem(key) } catch (_) {}
}

export const pinStore = {
  get:    (k) => getPinCompat(k),
  set:    (k, v) => setPinCompat(k, v),
  remove: (k) => removePinCompat(k),
}

// Wipe every SecureStore key we know about. Called by Settings -> Delete my
// account. AsyncStorage is wiped separately by the caller.
export async function wipeSecureStore() {
  for (const k of KNOWN_SECURE_KEYS) {
    try { await SecureStore.deleteItemAsync(k) } catch (_) {}
  }
}
