import AsyncStorage from '@react-native-async-storage/async-storage'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion
const SECRET_LEN = 16
const TAG = 'nfocus-' // share text prefix so we can recognize the format

const KEY_OUTGOING = '@nova_friend_secret_outgoing' // secret YOU share with your friend (so they can control your blocks)
const KEY_INCOMING = '@nova_friend_secrets_incoming' // array of secrets shared WITH you (the friends you control)

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

export function buildShareText(secret: string, userLabel?: string): string {
  const labelPart = userLabel ? `?from=${encodeURIComponent(userLabel)}` : ''
  return `${TAG}${secret}${labelPart}`
}

export function parseShareText(input: string): { secret: string; from?: string } | null {
  const trimmed = (input || '').trim()
  if (!trimmed) return null
  // Accept either a bare secret (just the SECRET_LEN-char string) or the full tagged form
  const directMatch = trimmed.match(/^[A-Z0-9]{16}$/)
  if (directMatch) return { secret: trimmed }
  const taggedMatch = trimmed.match(/nfocus-([A-Z0-9]{16})(?:\?from=([^&\s]+))?/i)
  if (!taggedMatch) return null
  return { secret: taggedMatch[1].toUpperCase(), from: taggedMatch[2] ? decodeURIComponent(taggedMatch[2]) : undefined }
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
