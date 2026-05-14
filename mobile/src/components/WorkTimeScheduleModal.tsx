import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WorkSchedule } from '../types'
import { colors, fonts, space } from '../theme'
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

function formatMinutes12h(total: number): string {
  const m = ((total % 1440) + 1440) % 1440
  const h24 = Math.floor(m / 60)
  const min = m % 60
  const am = h24 < 12
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${min.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`
}

function isWeekdaysOnly(days: boolean[]): boolean {
  return (
    days.length === 7 &&
    days[0] &&
    days[1] &&
    days[2] &&
    days[3] &&
    days[4] &&
    !days[5] &&
    !days[6]
  )
}

type Props = {
  visible: boolean
  schedule: WorkSchedule
  onClose: () => void
  onSave: (next: WorkSchedule) => void
  onOpenBlockList: () => void
  onResetToDefault: () => void
}

export function WorkTimeScheduleModal({
  visible,
  schedule,
  onClose,
  onSave,
  onOpenBlockList,
  onResetToDefault,
}: Props) {
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState(schedule)

  useEffect(() => {
    if (visible) setDraft(schedule)
  }, [visible, schedule])

  const weekdayTag = useMemo(() => (isWeekdaysOnly(draft.daysActive) ? 'Weekdays' : null), [draft.daysActive])

  const bumpStart = (delta: number) => {
    setDraft((d) => ({
      ...d,
      startMinutes: Math.max(0, Math.min(1439, d.startMinutes + delta)),
    }))
  }

  const bumpEnd = (delta: number) => {
    setDraft((d) => ({
      ...d,
      endMinutes: Math.max(0, Math.min(1439, d.endMinutes + delta)),
    }))
  }

  const toggleDay = (index: number) => {
    setDraft((d) => {
      const next = [...d.daysActive]
      next[index] = !next[index]
      return { ...d, daysActive: next }
    })
  }

  const save = () => {
    onSave(draft)
    onClose()
  }

  const reset = () => {
    onResetToDefault()
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <LinearGradient colors={['#243045', '#1a2230', '#0b0e14']} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(96,120,160,0.35)', 'transparent']}
          style={[styles.skyGlow, { height: 220 + insets.top }]}
        />

        <Pressable
          onPress={onClose}
          hitSlop={16}
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.85)" />
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.glass}>
            <View style={styles.sheetHeader}>
              <Ionicons name="laptop-outline" size={22} color={colors.text} />
              <Text style={styles.sheetTitle}>Work Time</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.timeRail} />
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>From</Text>
                <View style={styles.timeAdjust}>
                  <Pressable onPress={() => bumpStart(-30)} hitSlop={8}>
                    <Ionicons name="remove-circle-outline" size={22} color={colors.muted2} />
                  </Pressable>
                  <Text style={styles.timeValue}>{formatMinutes12h(draft.startMinutes)}</Text>
                  <Pressable onPress={() => bumpStart(30)} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.muted2} />
                  </Pressable>
                </View>
              </View>
              <View style={[styles.timeRow, { marginTop: 18 }]}>
                <Text style={styles.timeLabel}>To</Text>
                <View style={styles.timeAdjust}>
                  <Pressable onPress={() => bumpEnd(-30)} hitSlop={8}>
                    <Ionicons name="remove-circle-outline" size={22} color={colors.muted2} />
                  </Pressable>
                  <Text style={styles.timeValue}>{formatMinutes12h(draft.endMinutes)}</Text>
                  <Pressable onPress={() => bumpEnd(30)} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.muted2} />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.daysHeader}>
                <Text style={styles.daysTitle}>On these days</Text>
                {weekdayTag ? <Text style={styles.daysTag}>{weekdayTag}</Text> : null}
              </View>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, i) => {
                  const on = draft.daysActive[i]
                  return (
                    <Pressable
                      key={`${label}-${i}`}
                      onPress={() => toggleDay(i)}
                      style={[styles.dayDot, on && styles.dayDotOn]}
                    >
                      <Text style={[styles.dayDotText, on && styles.dayDotTextOn]}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <Pressable style={styles.listRow} onPress={onOpenBlockList}>
              <Text style={styles.listLabel}>Apps Blocked</Text>
              <View style={styles.listRight}>
                <View style={styles.redDot} />
                <Text style={styles.listChevron}>Block List &gt;</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.listRow}
              onPress={() => setDraft((d) => ({ ...d, breaksAllowed: !d.breaksAllowed }))}
            >
              <Text style={styles.listLabel}>Breaks Allowed</Text>
              <View style={styles.listRight}>
                <Ionicons name="shield-checkmark-outline" size={18} color="rgba(255,255,255,0.55)" />
                <Text style={styles.listChevron}>{draft.breaksAllowed ? 'Yes' : 'No'} &gt;</Text>
              </View>
            </Pressable>

            <View style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listLabel}>Vacation Mode</Text>
                <Text style={styles.listSub}>Temporarily disable this Session</Text>
              </View>
              <Switch
                value={draft.vacationMode}
                onValueChange={(v) => setDraft((d) => ({ ...d, vacationMode: v }))}
                trackColor={{ false: '#3a3a3c', true: 'rgba(255,255,255,0.35)' }}
                thumbColor={draft.vacationMode ? colors.text : '#787878'}
                ios_backgroundColor="#3a3a3c"
              />
            </View>

            <Pressable style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>

            <Pressable onPress={reset} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete Schedule</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const R = 18

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0e14' },
  skyGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  closeBtn: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: space.container,
    flexGrow: 1,
  },
  glass: {
    borderRadius: R,
    backgroundColor: 'rgba(18,20,26,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  sheetTitle: {
    ...fonts.bold,
    fontSize: 22,
    color: colors.text,
  },
  card: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  timeRail: {
    position: 'absolute',
    left: 13,
    top: 24,
    bottom: 24,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    opacity: 0.9,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 22,
  },
  timeLabel: {
    ...fonts.medium,
    fontSize: 15,
    color: colors.muted2,
  },
  timeValue: {
    ...fonts.semibold,
    fontSize: 17,
    color: colors.text,
    minWidth: 100,
    textAlign: 'center',
  },
  timeAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  daysHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  daysTitle: {
    ...fonts.medium,
    fontSize: 14,
    color: colors.muted2,
  },
  daysTag: {
    ...fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dayDotOn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dayDotText: {
    ...fonts.semibold,
    fontSize: 13,
    color: colors.muted2,
  },
  dayDotTextOn: {
    color: '#000000',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  listLabel: {
    ...fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  listSub: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  listChevron: {
    ...fonts.medium,
    fontSize: 15,
    color: colors.muted2,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    ...fonts.semibold,
    fontSize: 17,
    color: '#000000',
  },
  deleteBtn: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteText: {
    ...fonts.semibold,
    fontSize: 15,
    color: '#ff453a',
  },
})
