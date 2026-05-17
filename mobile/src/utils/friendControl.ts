import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../supabase'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion
const SECRET_LEN = 10

const KEY_OUTGOING = '@nova_friend_secret_outgoing' // secret YOU share with your friend (so they can control your blocks)
const KEY_INCOMING = '@nova_friend_secrets_incoming' // array of secrets shared WITH you (the friends you control)

export function formatSecretForDisplay(secret: string): string {
  // 5-5 split: ABCDE-FGHIJ
  if (secret.length === 10) return `${secret.slice(0, 5)}-${secret.slice(5)}`
  // Fallback for any other length
  return secret.replace(/(.{4})(?=.)/g, '$1-')
}

export function stripDashes(s: string): string {
  return s.replace(/[\s-]/g, '').toUpperCase()
}

export type IncomingFriend = {
  pairId: string
  secret: string
  friendName: string
  addedAt: string
}

function randomChar(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
}

export function generateSecret(): string {
  let s = ''
  for (let i = 0; i < SECRET_LEN; i++) s += randomChar()
  return s
}

export function buildShareText(secret: string, _userLabel?: string): string {
  const display = formatSecretForDisplay(secret)
  return `Take control of my Student Focus app. Code:\n\n${display}\n\nOpen Student Focus, go to Settings, Friend Control, "Help a friend", and paste this code.`
}

export function parseShareText(input: string): { secret: string; from?: string } | null {
  const stripped = stripDashes(input || '')
  if (!stripped) return null
  const re = new RegExp(`([A-Z0-9]{${SECRET_LEN}})`)
  const match = stripped.match(re)
  if (!match) return null
  return { secret: match[1] }
}

/**
 * Deterministic 6-digit code derived from secret + current hour bucket.
 * Same input on both phones produces the same output.
 * Not cryptographically secure; sufficient for friend-control verification.
 */
export function computeFriendCode(secret: string, hourBucket: number): string {
  let h = 2166136261
  const s = `${secret}:${hourBucket}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return String(Math.abs(h) % 1_000_000).padStart(6, '0')
}

export function currentHourBucket(now: number = Date.now()): number {
  return Math.floor(now / 3_600_000)
}

/**
 * Accept the current hour's code OR the previous hour's, so a code shared at
 * 3:59 still works at 4:00. One-hour grace window.
 */
export function verifyFriendCode(secret: string, typedCode: string, now: number = Date.now()): boolean {
  const cleaned = (typedCode || '').replace(/\D/g, '')
  if (cleaned.length !== 6) return false
  const hour = currentHourBucket(now)
  return cleaned === computeFriendCode(secret, hour) || cleaned === computeFriendCode(secret, hour - 1)
}

// ---------- Storage: outgoing (your secret, your friend controls you) ----------

export async function getOutgoingSecret(): Promise<string | null> {
  return await AsyncStorage.getItem(KEY_OUTGOING)
}

export async function setOutgoingSecret(secret: string): Promise<void> {
  await AsyncStorage.setItem(KEY_OUTGOING, secret)
}

export async function clearOutgoingSecret(): Promise<void> {
  await AsyncStorage.removeItem(KEY_OUTGOING)
}

export async function ensureOutgoingSecret(): Promise<string> {
  const existing = await getOutgoingSecret()
  if (existing) return existing
  const fresh = generateSecret()
  await setOutgoingSecret(fresh)
  return fresh
}

// ---------- Storage: incoming (secrets you've accepted from friends) ----------

export async function getIncomingFriends(): Promise<IncomingFriend[]> {
  const raw = await AsyncStorage.getItem(KEY_INCOMING)
  if (!raw) return []
  try { return JSON.parse(raw) as IncomingFriend[] } catch { return [] }
}

export async function addIncomingFriend(secret: string, friendName: string): Promise<IncomingFriend> {
  const all = await getIncomingFriends()
  // De-dupe by secret
  const filtered = all.filter(f => f.secret !== secret)
  const entry: IncomingFriend = {
    pairId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    secret,
    friendName: friendName.trim() || 'Friend',
    addedAt: new Date().toISOString(),
  }
  filtered.unshift(entry)
  await AsyncStorage.setItem(KEY_INCOMING, JSON.stringify(filtered))
  return entry
}

export async function removeIncomingFriend(pairId: string): Promise<void> {
  const all = await getIncomingFriends()
  const next = all.filter(f => f.pairId !== pairId)
  await AsyncStorage.setItem(KEY_INCOMING, JSON.stringify(next))
}

/** Milliseconds until the next hour bucket flips. */
export function msUntilNextRotation(now: number = Date.now()): number {
  const next = (Math.floor(now / 3_600_000) + 1) * 3_600_000
  return next - now
}

// ---------- Supabase pairing flow (real-time approval) ----------

export type SupabasePairing = {
  id: string
  user_id: string
  friend_user_id: string | null
  secret: string
  approved_at: string | null
  revoked_at: string | null
  created_at: string
}

/** Subject side: register the secret in Supabase as an open pairing slot. */
export async function registerOutgoingPairing(secret: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Find an existing active pairing for this user
    const { data: existing } = await supabase
      .from('friend_pairings')
      .select('id')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .limit(1)
    if (existing && existing.length > 0) {
      await supabase
        .from('friend_pairings')
        .update({ secret, friend_user_id: null, approved_at: null })
        .eq('id', existing[0].id)
    } else {
      await supabase.from('friend_pairings').insert({
        user_id: user.id,
        secret,
        friend_user_id: null,
        approved_at: null,
        revoked_at: null,
      })
    }
  } catch (_) {}
}

export type ClaimResult =
  | { ok: true; pairing: SupabasePairing }
  | { ok: false; reason: 'not_signed_in' | 'no_match' | 'self' | 'network' }

/**
 * Friend side: claim a pending pairing by matching secret. Returns a discriminated
 * result so callers can show actionable error messages instead of silently succeeding.
 */
export async function claimPairingBySecret(secret: string): Promise<ClaimResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, reason: 'not_signed_in' }
    const { data: rows, error } = await supabase
      .from('friend_pairings')
      .select('*')
      .eq('secret', secret)
      .is('friend_user_id', null)
      .is('revoked_at', null)
      .limit(1)
    if (error) return { ok: false, reason: 'network' }
    if (!rows || rows.length === 0) return { ok: false, reason: 'no_match' }
    const row = rows[0]
    if (row.user_id === user.id) return { ok: false, reason: 'self' }
    const { data: updated, error: upErr } = await supabase
      .from('friend_pairings')
      .update({ friend_user_id: user.id })
      .eq('id', row.id)
      .select()
      .single()
    if (upErr) return { ok: false, reason: 'network' }
    return { ok: true, pairing: updated as SupabasePairing }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** Subject side: list every pairing row this user owns (history + pending). Newest first. */
export async function listAllPairings(): Promise<SupabasePairing[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('friend_pairings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error || !data) return []
    return data as SupabasePairing[]
  } catch {
    return []
  }
}

/** Subject side: list pending approval requests (friend assigned but not yet approved). */
export async function listPendingApprovals(): Promise<SupabasePairing[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('friend_pairings')
      .select('*')
      .eq('user_id', user.id)
      .not('friend_user_id', 'is', null)
      .is('approved_at', null)
      .is('revoked_at', null)
    if (error || !data) return []
    return data as SupabasePairing[]
  } catch {
    return []
  }
}

export async function approvePairing(pairingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friend_pairings')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', pairingId)
    return !error
  } catch {
    return false
  }
}

export async function rejectPairing(pairingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friend_pairings')
      .update({ revoked_at: new Date().toISOString(), friend_user_id: null })
      .eq('id', pairingId)
    return !error
  } catch {
    return false
  }
}

/** Subject side: subscribe to incoming pending pairings. Returns an unsubscribe function. */
export function subscribeToIncomingPairings(
  onInsert: (row: SupabasePairing) => void,
): () => void {
  let channel: any = null
  ;(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      channel = supabase
        .channel(`friend_pairings:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friend_pairings', filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            const row = payload.new as SupabasePairing | undefined
            if (!row) return
            if (row.friend_user_id && !row.approved_at && !row.revoked_at) {
              onInsert(row)
            }
          }
        )
        .subscribe()
    } catch (_) {}
  })()
  return () => {
    try { if (channel) supabase.removeChannel(channel) } catch (_) {}
  }
}
