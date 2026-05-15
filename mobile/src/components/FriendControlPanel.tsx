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
  buildShareText,
  claimPairingBySecret,
  computeFriendCode,
  currentHourBucket,
  ensureOutgoingSecret,
  formatSecretForDisplay,
  getIncomingFriends,
  getOutgoingSecret,
  msUntilNextRotation,
  parseShareText,
  registerOutgoingPairing,
  removeIncomingFriend,
  type IncomingFriend,
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
  const [now, setNow] = useState(() => Date.now())
  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (!visible) return
    getOutgoingSecret().then(setOutgoingSecret)
    getIncomingFriends().then(setIncoming)
    setPasteInput('')
    setFriendNameInput('')
    setPasteErr('')
  }, [visible])

  useEffect(() => {
    if (!visible) return
    timerRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [visible])

  const handleGenerate = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    // Register the pairing in Supabase so a friend can claim it later
    await registerOutgoingPairing(secret)
  }

  const handleShare = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    await registerOutgoingPairing(secret)
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
    await registerOutgoingPairing(secret)
    const body = encodeURIComponent(buildShareText(secret))
    try { await Linking.openURL(`sms:?&body=${body}`) } catch (_) {}
  }

  const handleWhatsappShare = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    await registerOutgoingPairing(secret)
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
    // Claim the pairing on Supabase so the subject can approve. Don't fail locally if Supabase is offline.
    await claimPairingBySecret(parsed.secret)
    await addIncomingFriend(parsed.secret, name)
    setIncoming(await getIncomingFriends())
    setPasteInput('')
    setFriendNameInput('')
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
                  {incoming.map(f => (
                    <View key={f.pairId} style={styles.friendCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{f.friendName}</Text>
                        <Text style={styles.friendCode}>{computeFriendCode(f.secret, hour)}</Text>
                      </View>
                      <Pressable onPress={() => handleRemove(f.pairId)} hitSlop={10}>
                        <Text style={styles.removeLabel}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
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
})
