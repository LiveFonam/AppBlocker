import { useEffect, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { cardRadius, colors, fonts, space } from '../theme'
import {
  addIncomingFriend,
  buildShareText,
  computeFriendCode,
  currentHourBucket,
  ensureOutgoingSecret,
  getIncomingFriends,
  getOutgoingSecret,
  msUntilNextRotation,
  parseShareText,
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

  const handleGenerateAndShare = async () => {
    const secret = await ensureOutgoingSecret()
    setOutgoingSecret(secret)
    try {
      await Share.share({
        message: `${buildShareText(secret)}\n\nI'm using Student Focus and asked you to be my accountability friend. Open the app, go to Settings, Friend Control, "Help a Friend", and paste this code.`,
      })
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
                hourly codes to unlock your apps when you ask them.
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Your invite code</Text>
                <Text style={styles.codeValue}>{outgoingSecret || 'Not set up yet'}</Text>
              </View>
              <Pressable onPress={handleGenerateAndShare} style={styles.primaryBtn}>
                <Text style={styles.primaryLabel}>
                  {outgoingSecret ? 'Share with friend' : 'Generate and share'}
                </Text>
              </Pressable>
              <Text style={styles.hint}>
                Send it via iMessage, WhatsApp, whatever. The code is only useful to one friend who
                pastes it into their copy of Student Focus.
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
              <TextInput
                style={[styles.input, pasteErr ? styles.inputErr : null]}
                value={pasteInput}
                onChangeText={v => { setPasteInput(v); setPasteErr('') }}
                placeholder="Paste nfocus-XXXX..."
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {!!pasteErr && <Text style={styles.errLabel}>{pasteErr}</Text>}
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
