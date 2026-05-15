import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, Vibration } from 'react-native'
import { cardRadius, colors, fonts, space } from '../theme'
import {
  approvePairing,
  listPendingApprovals,
  rejectPairing,
  subscribeToIncomingPairings,
  type SupabasePairing,
} from '../utils/friendControl'

export function ApprovalBanner() {
  const [pending, setPending] = useState<SupabasePairing | null>(null)
  const seenIds = useRef(new Set<string>())

  useEffect(() => {
    // Poll once on mount for any pending requests that arrived while the app was closed
    listPendingApprovals().then((rows) => {
      const first = rows.find((r) => !seenIds.current.has(r.id))
      if (first) {
        seenIds.current.add(first.id)
        setPending(first)
        try { Vibration.vibrate(120) } catch (_) {}
      }
    })

    // Realtime updates while app is open
    const unsubscribe = subscribeToIncomingPairings((row) => {
      if (seenIds.current.has(row.id)) return
      seenIds.current.add(row.id)
      setPending(row)
      try { Vibration.vibrate(120) } catch (_) {}
    })
    return unsubscribe
  }, [])

  if (!pending) return null

  const approve = async () => {
    await approvePairing(pending.id)
    setPending(null)
  }

  const reject = async () => {
    await rejectPairing(pending.id)
    setPending(null)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={reject}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Approve accountability friend?</Text>
          <Text style={styles.body}>
            Someone with your invite code is asking to control your blocks. Approve only if you sent
            them the code on purpose. Once approved, they can generate rotating codes to unlock your
            apps when you ask them.
          </Text>
          <Pressable onPress={approve} style={styles.approveBtn}>
            <Text style={styles.approveLabel}>Approve</Text>
          </Pressable>
          <Pressable onPress={reject} style={styles.rejectBtn}>
            <Text style={styles.rejectLabel}>Reject</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    paddingHorizontal: space.container,
  },
  card: {
    backgroundColor: '#0a0a0a',
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 24,
  },
  title: { color: colors.text, fontSize: 20, ...fonts.semibold, marginBottom: 8 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  approveBtn: {
    backgroundColor: '#30d158',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 10,
  },
  approveLabel: { color: '#000', ...fonts.semibold, fontSize: 16 },
  rejectBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  rejectLabel: { color: colors.text, ...fonts.semibold, fontSize: 14 },
})
