import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { BlockTarget } from '../types'
import { cardRadius, colors, fonts, space } from '../theme'

const CATALOG = [
  'Instagram',
  'TikTok',
  'X (Twitter)',
  'YouTube',
  'Reddit',
  'Snapchat',
  'Facebook',
  'Discord',
  'Threads',
  'LinkedIn',
  'Pinterest',
  'Twitch',
  'Netflix',
  'Safari',
  'Chrome',
  'Mail',
  'Messages',
] as const

type ActiveSession = {
  title: string
  startedAt: number
  endAt: number
  durationMinutes: number
  stopAvailableAt: number
}

type Props = {
  targets: BlockTarget[]
  enabledBlockCount: number
  active: ActiveSession | null
  now: number
  onToggle: (id: string) => void
  onAdd: (name: string) => void
  onStartSession: (minutes: number, title: string) => void
  onStopSessionEarly: () => void
  bottomInset: number
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function IconBadge({ children }: { children: ReactNode }) {
  return <View style={styles.iconBadge}>{children}</View>
}

export function BlockView({
  targets,
  enabledBlockCount,
  active,
  now,
  onToggle,
  onAdd,
  onStartSession,
  onStopSessionEarly,
  bottomInset,
}: Props) {
  const [draft, setDraft] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customMinutes, setCustomMinutes] = useState(25)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const lastHapticMinutesRef = useRef<number | null>(null)

  const byName = useMemo(() => {
    const m = new Map<string, BlockTarget>()
    targets.forEach((t) => m.set(t.name.toLowerCase(), t))
    return m
  }, [targets])

  const remaining = active ? Math.max(0, active.endAt - now) : 0
  const stopInMs = active ? Math.max(0, active.stopAvailableAt - now) : 0
  const canStopEarly = active != null && now >= active.stopAvailableAt

  const toggleCatalog = (name: string) => {
    const key = name.toLowerCase()
    const existing = byName.get(key)
    if (existing) onToggle(existing.id)
    else onAdd(name)
  }

  const openStartModal = () => {
    if (active) return
    setCustomTitle('')
    setCustomMinutes(25)
    lastHapticMinutesRef.current = 25
    setCreateOpen(true)
  }

  const onSessionLengthChange = (value: number) => {
    setCustomMinutes(value)
    if (Platform.OS === 'web') return
    if (lastHapticMinutesRef.current === value) return
    lastHapticMinutesRef.current = value
    void Haptics.selectionAsync().catch(() => {})
  }

  const startFromModal = () => {
    const title = customTitle.trim() || 'Focus session'
    if (active) return
    onStartSession(customMinutes, title)
    setCreateOpen(false)
  }

  const addCustomFromManage = () => {
    const name = draft.trim()
    if (!name) return
    if (!byName.get(name.toLowerCase())) onAdd(name)
    setDraft('')
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + space.bottomNav + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.kickerRow}>
          <Text style={styles.pageKicker}>Apps</Text>
        </View>

        <View style={styles.pageHeader}>
          <View style={styles.headerLeft}>
            <IconBadge>
              <Ionicons name="lock-closed-outline" size={22} color={colors.muted2} />
            </IconBadge>
            <Text style={styles.pageTitle}>Blocks</Text>
          </View>
        </View>

        <View style={[styles.card, styles.minCard]}>
          <Text style={styles.cardKicker}>Focus session</Text>
          <Text style={styles.cardBody}>
            While a timer runs, the apps you pick in the list below are what you intend to avoid—real
            limits still use Screen Time or Focus on your iPhone.
          </Text>
          <Text style={styles.metaLine}>
            {enabledBlockCount} {enabledBlockCount === 1 ? 'app' : 'apps'} on for sessions
          </Text>

          {active ? (
            <View style={styles.activeBox}>
              <Text style={styles.activeKicker}>Active</Text>
              <Text style={styles.activeTitle}>{active.title}</Text>
              <Text style={styles.activeTimer}>{formatCountdown(remaining)}</Text>
              {!canStopEarly ? (
                <Text style={styles.stopWait}>End unlocks in {Math.ceil(stopInMs / 1000)}s…</Text>
              ) : (
                <Pressable
                  onPress={onStopSessionEarly}
                  style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.endBtnText}>End session early</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              onPress={openStartModal}
              style={({ pressed }) => [styles.openRow, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.openRowLeft}>
                <Ionicons name="play-outline" size={22} color={colors.text} />
                <View style={styles.openRowText}>
                  <Text style={styles.openRowTitle}>Start focus timer</Text>
                  <Text style={styles.openRowSub}>Choose length in the next step</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted3} />
            </Pressable>
          )}
        </View>

        <View style={[styles.card, styles.minCard]}>
          <Text style={styles.cardKicker}>Block list</Text>
          <Text style={styles.sectionHint}>
            Open a screen, then tap items in the list. Fewer taps here; choices live inside each sheet.
          </Text>

          <Pressable
            onPress={() => setCatalogOpen(true)}
            style={({ pressed }) => [styles.openRow, styles.openRowSpaced, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.openRowLeft}>
              <Ionicons name="list-outline" size={22} color={colors.text} />
              <View style={styles.openRowText}>
                <Text style={styles.openRowTitle}>Browse catalog</Text>
                <Text style={styles.openRowSub}>Pick common apps from a list</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted3} />
          </Pressable>

          <Pressable
            onPress={() => setManageOpen(true)}
            style={({ pressed }) => [styles.openRow, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.openRowLeft}>
              <Ionicons name="create-outline" size={22} color={colors.text} />
              <View style={styles.openRowText}>
                <Text style={styles.openRowTitle}>Manage my list</Text>
                <Text style={styles.openRowSub}>
                  {targets.length === 0
                    ? 'Custom names and on/off per app'
                    : `${targets.length} ${targets.length === 1 ? 'item' : 'items'} · custom add & toggles`}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted3} />
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={catalogOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setCatalogOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setCatalogOpen(false)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Catalog</Text>
              <Pressable onPress={() => setCatalogOpen(false)} hitSlop={12}>
                <Text style={styles.sheetDone}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.sheetHint}>Tap a row to add it, or toggle it off your list.</Text>
            <ScrollView
              style={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {CATALOG.map((name) => {
                const hit = byName.get(name.toLowerCase())
                const on = hit?.enabled ?? false
                const listed = !!hit
                return (
                  <Pressable
                    key={name}
                    onPress={() => toggleCatalog(name)}
                    style={({ pressed }) => [styles.catalogRow, pressed && { opacity: 0.88 }]}
                  >
                    <Text style={styles.catalogName} numberOfLines={1}>
                      {name}
                    </Text>
                    <View style={styles.catalogRight}>
                      {!listed ? (
                        <Text style={styles.catalogMeta}>Add</Text>
                      ) : on ? (
                        <>
                          <Text style={styles.catalogMetaOn}>On</Text>
                          <Ionicons name="checkmark-circle" size={22} color={colors.text} />
                        </>
                      ) : (
                        <>
                          <Text style={styles.catalogMeta}>Off</Text>
                          <Ionicons name="ellipse-outline" size={22} color={colors.muted2} />
                        </>
                      )}
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={manageOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setManageOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setManageOpen(false)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>My block list</Text>
              <Pressable onPress={() => setManageOpen(false)} hitSlop={12}>
                <Text style={styles.sheetDone}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.subLabel}>Custom name</Text>
            <View style={styles.form}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Other app or site"
                placeholderTextColor={colors.muted3}
                style={styles.input}
                onSubmitEditing={addCustomFromManage}
                returnKeyType="done"
              />
              <Pressable onPress={addCustomFromManage} style={styles.addBtn}>
                <Text style={styles.addLabel}>Add</Text>
              </Pressable>
            </View>
            <Text style={[styles.subLabel, { marginTop: 18 }]}>Your apps</Text>
            {targets.length === 0 ? (
              <Text style={styles.empty}>Nothing here yet. Use the field above or the catalog.</Text>
            ) : (
              <ScrollView
                style={styles.sheetScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {targets.map((t, i) => (
                  <View
                    key={t.id}
                    style={[
                      styles.row,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.outline,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={styles.rowMeta}>{t.enabled ? 'On for sessions' : 'Off'}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: t.enabled }}
                      onPress={() => onToggle(t.id)}
                      style={[
                        styles.switchTrack,
                        t.enabled ? styles.switchOn : styles.switchOff,
                      ]}
                    >
                      <View
                        style={[
                          styles.switchThumb,
                          { transform: [{ translateX: t.enabled ? 20 : 0 }] },
                        ]}
                      />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={createOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>New focus session</Text>
            <Text style={styles.modalLabel}>What are you working on?</Text>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="Optional label"
              placeholderTextColor={colors.muted3}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>Length · {customMinutes} min</Text>
            <Slider
              style={styles.modalSlider}
              minimumValue={10}
              maximumValue={180}
              step={5}
              value={customMinutes}
              onValueChange={onSessionLengthChange}
              minimumTrackTintColor={colors.text}
              maximumTrackTintColor={colors.outline}
              thumbTintColor={colors.text}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={styles.modalSecondary}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={startFromModal} style={styles.modalPrimary}>
                <Text style={styles.modalPrimaryText}>Start</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    maxWidth: 672,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.container,
    paddingTop: 12,
  },
  minCard: {
    borderRadius: cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    backgroundColor: 'transparent',
  },
  kickerRow: { marginBottom: 20 },
  pageKicker: {
    ...fonts.semibold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    ...fonts.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.text,
    flex: 1,
  },
  card: {
    padding: 18,
    marginBottom: 16,
  },
  cardKicker: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  cardBody: {
    ...fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted2,
    marginBottom: 12,
  },
  metaLine: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted3,
    marginBottom: 16,
  },
  activeBox: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  activeKicker: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  activeTitle: {
    ...fonts.medium,
    fontSize: 18,
    color: colors.text,
    marginTop: 8,
  },
  activeTimer: {
    ...fonts.light,
    fontSize: 44,
    marginTop: 12,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  stopWait: {
    marginTop: 14,
    ...fonts.regular,
    fontSize: 13,
    color: colors.muted2,
  },
  endBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  endBtnText: {
    ...fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  openRowSpaced: {
    marginBottom: 12,
  },
  openRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  openRowText: { flex: 1, minWidth: 0 },
  openRowTitle: {
    ...fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  openRowSub: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted2,
    marginTop: 2,
  },
  sectionHint: {
    ...fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted2,
    marginBottom: 16,
  },
  subLabel: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  form: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    ...fonts.regular,
    fontSize: 15,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text,
    borderRadius: 12,
  },
  addLabel: {
    ...fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  empty: {
    ...fonts.regular,
    fontSize: 14,
    color: colors.muted2,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowTitle: {
    ...fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  rowMeta: {
    marginTop: 4,
    ...fonts.regular,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.muted3,
    textTransform: 'uppercase',
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: {
    borderColor: colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  switchOff: {
    borderColor: colors.outline,
    backgroundColor: 'transparent',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
    marginLeft: 2,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    paddingHorizontal: space.container,
    paddingBottom: space.container,
  },
  sheetCard: {
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    borderRadius: cardRadius,
    padding: 18,
    maxHeight: '82%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    ...fonts.bold,
    fontSize: 20,
    color: colors.text,
  },
  sheetDone: {
    ...fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  sheetHint: {
    ...fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted2,
    marginBottom: 12,
  },
  sheetScroll: {
    maxHeight: 360,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  catalogName: {
    ...fonts.medium,
    fontSize: 16,
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  catalogRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catalogMeta: {
    ...fonts.medium,
    fontSize: 13,
    color: colors.muted2,
  },
  catalogMetaOn: {
    ...fonts.medium,
    fontSize: 13,
    color: colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: space.container,
  },
  modalCard: {
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    padding: 22,
    gap: 8,
    borderRadius: cardRadius,
  },
  modalTitle: {
    ...fonts.bold,
    fontSize: 22,
    color: colors.text,
    marginBottom: 8,
  },
  modalLabel: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    padding: 14,
    ...fonts.regular,
    fontSize: 16,
    color: colors.text,
    marginTop: 8,
    borderRadius: 12,
  },
  modalSlider: {
    width: '100%',
    height: 44,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    justifyContent: 'flex-end',
  },
  modalSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    borderRadius: 12,
  },
  modalSecondaryText: {
    ...fonts.medium,
    fontSize: 15,
    color: colors.muted2,
  },
  modalPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    backgroundColor: colors.text,
    borderRadius: 12,
  },
  modalPrimaryText: {
    ...fonts.semibold,
    fontSize: 15,
    color: colors.bg,
  },
})
