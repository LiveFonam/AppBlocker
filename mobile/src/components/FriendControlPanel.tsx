import { useEffect, useRef, useState } from 'react'
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { cardRadius, colors, fonts, space } from '../theme'
import {
  addIncomingFriend,
  approvePairing,
  buildShareText,
  claimPairingBySecret,
  computeFriendCode,
  currentHourBucket,
  ensureOutgoingSecret,
  formatSecretForDisplay,
  getIncomingFriends,
  getOutgoingSecret,
  listAllPairings,
  msUntilNextRotation,
  parseShareText,
  registerOutgoingPairing,
  rejectPairing,
  removeIncomingFriend,
  subscribeToIncomingPairings,
  type IncomingFriend,
  type SupabasePairing,
} from '../utils/friendControl'

type Props = {
  visible: boolean
  onClose: () => void
}

type Tab = 'be-controlled' | 'control-friend'

function fmtRotation(ms: number): string {
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function FriendControlPanel({ visible, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('be-controlled')
  const [outgoingSecret, setOutgoingSecret] = useState<string | null>(null)
  const [pasteInput, setPasteInput] = useState('')
  const [friendNameInput, setFriendNameInput] = useState('')
  const [pasteErr, setPasteErr] = useState('')
  const [copyToast, setCopyToast] = useState('')
  const [pasteToast, setPasteToast] = useState('')
  const [incoming, setIncoming] = useState<IncomingFriend[]>([])
  const [pairings, setPairings] = useState<SupabasePairing[]>([])
  const [actingId, setActingId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (!visible) return
    getOutgoingSecret().then(setOutgoingSecret)
    getIncomingFriends().then(setIncoming)
    listAllPairings().then(setPairings)
    setPasteInput('')
    setFriendNameInput('')
    setPasteErr('')
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const unsub = subscribeToIncomingPairings(() => {
      listAllPairings().then(setPairings)
    })
    return unsub
  }, [visible])

  useEffect(() => {
    if (!visible) return
    timerRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [visible])

  const handleApprovePairing = async (id: string) => {
    setActingId(id)
    await approvePairing(id)
    setPairings(await listAllPairings())
    setActingId(null)
  }

  const handleRejectPairing = async (id: string) => {
    setActingId(id)
    await rejectPairing(id)
    setPairings(await listAllPairings())
    setActingId(null)
  }

  const pairingStatus = (p: SupabasePairing): 'pending' | 'approved' | 'rejected' | 'open' => {
    if (p.revoked_at) return 'rejected'
    if (p.approved_at) return 'approved'
    if (p.friend_user_id) return 'pending'
    return 'open' // Person A generated/shared but no friend has claimed yet
  }

  const visibleInbox = pairings.filter((p) => pairingStatus(p) !== 'open')
  const pendingCount = pairings.filter((p) => pairingStatus(p) === 'pending').length

  const reportRegisterError = (reason: string, debug?: string) => {
    const base = reason === 'not_signed_in'
      ? "Code not saved — finish onboarding first."
      : "Code not saved — server rejected it."
    const msg = debug ? `${base}\nDEBUG: ${debug}` : base
    setCopyToast(msg)
    setTimeout(() => setCopyToast(''), 12000)
  }

  const handleGenerate = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    const res: any = await registerOutgoingPairing(secret)
    if (!res.ok) reportRegisterError(res.reason, res.debug)
    else { setCopyToast(`Code ready to share${res.debug ? `\nDEBUG: ${res.debug}` : ''}`); setTimeout(() => setCopyToast(''), 8000) }
  }

  const handleShare = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    const res: any = await registerOutgoingPairing(secret)
    if (!res.ok) { reportRegisterError(res.reason, res.debug); return }
    try {
      await Share.share({ message: buildShareText(secret) })
    } catch (_) {}
  }

  const handleCopyCode = async () => {
    if (!outgoingSecret) return
    try {
      await Clipboard.setStringAsync(formatSecretForDisplay(outgoingSecret))
      setCopyToast('Code copied')
      setTimeout(() => setCopyToast(''), 1800)
    } catch (_) {}
  }

  const handleSmsShare = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    const res: any = await registerOutgoingPairing(secret)
    if (!res.ok) { reportRegisterError(res.reason, res.debug); return }
    const body = encodeURIComponent(buildShareText(secret))
    try { await Linking.openURL(`sms:?&body=${body}`) } catch (_) {}
  }

  const handleWhatsappShare = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    const res: any = await registerOutgoingPairing(secret)
    if (!res.ok) { reportRegisterError(res.reason, res.debug); return }
    const body = encodeURIComponent(buildShareText(secret))
    try { await Linking.openURL(`whatsapp://send?text=${body}`) } catch (_) {}
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync()
      if (text) {
        setPasteInput(text)
        setPasteErr('')
        setPasteToast('Pasted')
        setTimeout(() => setPasteToast(''), 1500)
      }
    } catch (_) {}
  }

  const handleAcceptPaste = async () => {
    const parsed = parseShareText(pasteInput)
    if (!parsed) {
      setPasteErr('That does not look like a Student Focus friend code.')
      return
    }
    setPasteErr('')
    const name = friendNameInput.trim() || parsed.from || 'Friend'
    const result: any = await claimPairingBySecret(parsed.secret)
    if (!result.ok) {
      const base = ({
        not_signed_in: "You're not signed in. Finish onboarding (email + verification code) first.",
        no_match: "Code not found. Ask your friend to tap Generate or Share in their app first, then try again.",
        self: "That's your own code — you can't claim your own pairing.",
        network: "Couldn't reach the server. Check your connection and try again.",
      })[result.reason] || 'Could not register this pairing.'
      const msg = result.debug ? `${base}\nDEBUG: ${result.debug}` : base
      setPasteErr(msg)
      return
    }
    await addIncomingFriend(parsed.secret, name)
    setIncoming(await getIncomingFriends())
    setPasteInput('')
    setFriendNameInput('')
    setPasteToast('Sent — your friend will get an approval request')
    setTimeout(() => setPasteToast(''), 4000)
  }

  const handleRemove = async (pairId: string) => {
    await removeIncomingFriend(pairId)
    setIncoming(await getIncomingFriends())
  }

  const hour = currentHourBucket(now)
  const rotationLeft = msUntilNextRotation(now)

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Friend Control</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.tabBar}>
          {([
            { id: 'be-controlled' as const, label: 'Get help' },
            { id: 'control-friend' as const, label: 'Help a friend' },
          ]).map(t => {
            const on = tab === t.id
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tabBtn, on && styles.tabBtnOn]}>
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {tab === 'be-controlled' ? (
            <View>
              <Text style={styles.sectionBody}>
                Share a one-time code with a friend you trust. They will be able to generate rotating
                hourly codes to unlock your apps when you ask them. You will see an in-app prompt
                to approve them before they get any control.
              </Text>
              <View style={styles.codeBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.codeLabel}>Your invite code</Text>
                  {outgoingSecret && (
                    <Pressable onPress={handleCopyCode} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="copy-outline" size={16} color={colors.text} />
                      <Text style={{ color: colors.text, fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{copyToast || 'Copy'}</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.codeValue}>
                  {outgoingSecret ? formatSecretForDisplay(outgoingSecret) : 'Not set up yet'}
                </Text>
              </View>
              {!outgoingSecret && (
                <Pressable onPress={handleGenerate} style={styles.primaryBtn}>
                  <Text style={styles.primaryLabel}>Generate code</Text>
                </Pressable>
              )}
              {outgoingSecret && (
                <>
                  <Pressable onPress={handleShare} style={styles.primaryBtn}>
                    <Text style={styles.primaryLabel}>Share via...</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <Pressable onPress={handleSmsShare} style={[styles.quickBtn, { flex: 1 }]}>
                      <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
                      <Text style={styles.quickBtnLabel}>SMS</Text>
                    </Pressable>
                    <Pressable onPress={handleWhatsappShare} style={[styles.quickBtn, { flex: 1 }]}>
                      <Ionicons name="logo-whatsapp" size={18} color={colors.text} />
                      <Text style={styles.quickBtnLabel}>WhatsApp</Text>
                    </Pressable>
                  </View>
                </>
              )}
              <Text style={styles.hint}>
                Send it via iMessage, WhatsApp, Discord, Instagram, WeChat, whatever. The code is
                only useful to one friend who pastes it into their copy of Student Focus, and you
                still have to approve them on this phone first.
              </Text>

              <View style={styles.inboxHeader}>
                <Text style={styles.inboxTitle}>Incoming requests</Text>
                {pendingCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount}</Text>
                  </View>
                )}
              </View>
              {visibleInbox.length === 0 ? (
                <Text style={styles.inboxEmpty}>
                  No friends have used your code yet.
                </Text>
              ) : (
                visibleInbox.map((p) => {
                  const status = pairingStatus(p)
                  const friendTag = p.friend_user_id
                    ? `Friend …${p.friend_user_id.slice(-4)}`
                    : 'Friend'
                  const created = new Date(p.created_at)
                  const acting = actingId === p.id
                  return (
                    <View key={p.id} style={styles.inboxRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.inboxRowTitle} numberOfLines={1}>{friendTag}</Text>
                        <Text style={styles.inboxRowMeta}>
                          {created.toLocaleString()}
                        </Text>
                        <View style={styles.inboxStatusRow}>
                          <View style={[styles.statusPill, status === 'pending' && styles.statusPillPending, status === 'approved' && styles.statusPillApproved, status === 'rejected' && styles.statusPillRejected]}>
                            <Text style={[styles.statusPillText, status === 'pending' && styles.statusPillTextPending, status === 'approved' && styles.statusPillTextApproved, status === 'rejected' && styles.statusPillTextRejected]}>
                              {status === 'pending' ? 'Pending' : status === 'approved' ? 'Approved' : 'Rejected'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {status === 'pending' && (
                        <View style={styles.inboxActions}>
                          <Pressable
                            onPress={() => handleApprovePairing(p.id)}
                            disabled={acting}
                            style={[styles.approveSmall, acting && { opacity: 0.4 }]}
                          >
                            <Text style={styles.approveSmallLabel}>Approve</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRejectPairing(p.id)}
                            disabled={acting}
                            style={[styles.rejectSmall, acting && { opacity: 0.4 }]}
                          >
                            <Text style={styles.rejectSmallLabel}>Reject</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )
                })
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.sectionBody}>
                Paste the code your friend sent you. Then you can read off the 6-digit code below
                whenever they ask, refreshes every hour.
              </Text>
              <TextInput
                style={styles.input}
                value={friendNameInput}
                onChangeText={setFriendNameInput}
                placeholder="Friend's name (optional)"
                placeholderTextColor={colors.muted}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TextInput
                  style={[styles.input, pasteErr ? styles.inputErr : null, { flex: 1, marginBottom: 0 }]}
                  value={pasteInput}
                  onChangeText={v => { setPasteInput(v); setPasteErr('') }}
                  placeholder="Paste invite code"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Pressable onPress={handlePasteFromClipboard} hitSlop={10} style={styles.iconBtn}>
                  <Ionicons name="clipboard-outline" size={18} color={colors.text} />
                </Pressable>
              </View>
              {!!pasteErr && <Text style={styles.errLabel}>{pasteErr}</Text>}
              {!!pasteToast && <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>{pasteToast}</Text>}
              <Pressable
                onPress={handleAcceptPaste}
                style={[styles.primaryBtn, !pasteInput.trim() && styles.primaryBtnDisabled]}
                disabled={!pasteInput.trim()}
              >
                <Text style={styles.primaryLabel}>Add friend</Text>
              </Pressable>

              {incoming.length > 0 && (
                <View style={{ marginTop: 28 }}>
                  <View style={styles.rotationRow}>
                    <Text style={styles.rotationLabel}>Codes rotate in</Text>
                    <Text style={styles.rotationValue}>{fmtRotation(rotationLeft)}</Text>
                  </View>
                  {!!copyToast && (
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8, alignSelf: 'center' }}>
                      {copyToast}
                    </Text>
                  )}
                  {incoming.map(f => {
                    const code = computeFriendCode(f.secret, hour)
                    return (
                      <View key={f.pairId} style={styles.friendCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.friendName}>{f.friendName}</Text>
                          <Text style={styles.friendCode}>{code}</Text>
                        </View>
                        <Pressable
                          onPress={async () => {
                            try {
                              await Clipboard.setStringAsync(code)
                              setCopyToast(`Copied ${code}`)
                              setTimeout(() => setCopyToast(''), 1800)
                            } catch (_) {}
                          }}
                          hitSlop={10}
                          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}
                        >
                          <Ionicons name="copy-outline" size={16} color={colors.text} />
                          <Text style={{ color: colors.text, fontSize: 12, marginLeft: 4, fontWeight: '600' }}>Copy</Text>
                        </Pressable>
                        <Pressable onPress={() => handleRemove(f.pairId)} hitSlop={10}>
                          <Text style={styles.removeLabel}>Remove</Text>
                        </Pressable>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.container,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  closeLabel: { color: colors.muted, fontSize: 15, width: 60 },
  title: { color: colors.text, fontSize: 17, ...fonts.semibold },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: space.container,
    paddingTop: 14,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 24,
  },
  tabBtnOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabLabel: { color: colors.muted, ...fonts.semibold, fontSize: 14 },
  tabLabelOn: { color: '#000' },
  body: { padding: space.container, paddingBottom: 60 },
  sectionBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  codeBox: {
    backgroundColor: '#111',
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 18,
    marginBottom: 16,
  },
  codeLabel: { color: colors.muted, fontSize: 11, ...fonts.semibold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  codeValue: { color: colors.text, fontSize: 22, ...fonts.bold, letterSpacing: 2 },
  primaryBtn: {
    backgroundColor: colors.text,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryLabel: { color: '#000', ...fonts.semibold, fontSize: 16 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: '#111',
  },
  quickBtnLabel: { color: colors.text, fontSize: 14, ...fonts.semibold },
  iconBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: '#111',
  },
  hint: { color: colors.muted3, fontSize: 12, lineHeight: 18, marginTop: 4 },
  input: {
    backgroundColor: '#111',
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    marginBottom: 12,
  },
  inputErr: { borderColor: '#ff453a' },
  errLabel: { color: '#ff453a', fontSize: 13, marginBottom: 12 },
  rotationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rotationLabel: { color: colors.muted, fontSize: 13 },
  rotationValue: { color: colors.text, ...fonts.semibold, fontSize: 14 },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  friendName: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  friendCode: { color: colors.text, fontSize: 32, ...fonts.bold, letterSpacing: 6 },
  removeLabel: { color: '#ff453a', fontSize: 13 },
  inboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
    gap: 8,
  },
  inboxTitle: { color: colors.text, fontSize: 16, ...fonts.semibold },
  badge: {
    backgroundColor: '#ff9f0a',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#000', fontSize: 12, ...fonts.bold },
  inboxEmpty: { color: colors.muted2, fontSize: 13, lineHeight: 19 },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  inboxRowTitle: { color: colors.text, fontSize: 14, ...fonts.semibold },
  inboxRowMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  inboxStatusRow: { flexDirection: 'row', marginTop: 6 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  statusPillPending: { backgroundColor: 'rgba(255,159,10,0.18)' },
  statusPillApproved: { backgroundColor: 'rgba(48,209,88,0.18)' },
  statusPillRejected: { backgroundColor: 'rgba(255,69,58,0.18)' },
  statusPillText: { color: colors.muted, fontSize: 10, ...fonts.semibold, letterSpacing: 0.6, textTransform: 'uppercase' },
  statusPillTextPending: { color: '#ff9f0a' },
  statusPillTextApproved: { color: '#30d158' },
  statusPillTextRejected: { color: '#ff453a' },
  inboxActions: { flexDirection: 'column', gap: 6, alignItems: 'flex-end' },
  approveSmall: {
    backgroundColor: '#30d158',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  approveSmallLabel: { color: '#000', fontSize: 12, ...fonts.semibold },
  rejectSmall: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outline,
    minWidth: 78,
    alignItems: 'center',
  },
  rejectSmallLabel: { color: colors.text, fontSize: 12, ...fonts.semibold },
})
