import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { PersistedState } from '../types'
import { cardRadius, colors, fonts, space } from '../theme'
import { patchReportedScreenTime } from '../storage'
import {
  openAppSettings,
  openFocusModesHelp,
  openScreenTimeSettings,
} from '../utils/iosSystem'

type Props = {
  data: PersistedState
  onUpdate: (next: PersistedState) => void
  onReset: () => void
  onReplaySetup: () => void
  bottomInset: number
}

export function SettingsView({
  data,
  onUpdate,
  onReset,
  onReplaySetup,
  bottomInset,
}: Props) {
  const [hoursDraft, setHoursDraft] = useState(
    String(Math.round((data.profile.reportedDailyPhoneMinutes / 60) * 10) / 10),
  )

  const applyDailyAverage = () => {
    const h = parseFloat(hoursDraft.replace(',', '.'))
    if (Number.isNaN(h) || h <= 0) {
      Alert.alert('Enter hours', 'Use a number like 3.5 for hours per day.')
      return
    }
    const minutes = Math.round(h * 60)
    onUpdate(patchReportedScreenTime(data, minutes))
    Alert.alert('Updated', 'Charts now use this daily average. Compare with Screen Time in Settings.')
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset + space.bottomNav + 28 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.kickerRow}>
        <Text style={styles.pageKicker}>System</Text>
      </View>

      <View style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name="settings-outline" size={22} color={colors.muted2} />
          </View>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>
      </View>

      <View style={[styles.card, styles.minCard]}>
        <Text style={styles.label}>Screen time average</Text>
        <Text style={styles.body}>
          iOS does not expose Screen Time to this app. Enter the daily average you see under
          Settings ▸ Screen Time so charts match your real usage.
        </Text>
        <TextInput
          value={hoursDraft}
          onChangeText={setHoursDraft}
          keyboardType="decimal-pad"
          placeholder="Hours per day"
          placeholderTextColor={colors.muted3}
          style={styles.input}
        />
        <Pressable style={styles.primaryOutline} onPress={applyDailyAverage}>
          <Text style={styles.primaryOutlineText}>Save & refresh charts</Text>
        </Pressable>
      </View>

      <View style={[styles.card, styles.minCard]}>
        <Text style={styles.label}>iPhone blocking</Text>
        <Text style={[styles.body, { marginBottom: 16 }]}>
          App limits and Downtime are controlled by Apple in Settings. These open system screens when
          iOS allows the link.
        </Text>
        <Pressable style={styles.primaryOutline} onPress={() => openScreenTimeSettings()}>
          <Text style={styles.primaryOutlineText}>Screen Time & App Limits</Text>
        </Pressable>
        <Pressable style={styles.secondaryOutline} onPress={() => openFocusModesHelp()}>
          <Text style={styles.secondaryOutlineText}>Focus modes (guide)</Text>
        </Pressable>
        <Pressable style={styles.secondaryOutline} onPress={() => openAppSettings()}>
          <Text style={styles.secondaryOutlineText}>This app in Settings</Text>
        </Pressable>
      </View>

      <View style={[styles.card, styles.minCard]}>
        <Text style={styles.label}>Setup</Text>
        <Pressable
          style={styles.secondaryOutline}
          onPress={() =>
            Alert.alert('Run setup again?', 'You will go through the questions again.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue', onPress: onReplaySetup },
            ])
          }
        >
          <Text style={styles.secondaryOutlineText}>Run setup again</Text>
        </Pressable>
      </View>

      <View style={[styles.card, styles.minCard]}>
        <Text style={styles.label}>Data</Text>
        <Text style={[styles.body, { marginBottom: 20 }]}>
          Everything stays on this device. Uninstalling clears it.
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Reset local data',
              'Reset sessions, charts, block list, and profile to defaults?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', style: 'destructive', onPress: onReset },
              ],
            )
          }
          style={styles.destructiveBtn}
        >
          <Text style={styles.destructiveLabel}>Reset local data</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
  label: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  body: {
    ...fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted2,
    marginBottom: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...fonts.regular,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  primaryOutline: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryOutlineText: {
    ...fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  secondaryOutline: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryOutlineText: {
    ...fonts.medium,
    fontSize: 14,
    color: colors.muted2,
  },
  destructiveBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,69,58,0.45)',
    borderRadius: 12,
  },
  destructiveLabel: {
    ...fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: '#ff453a',
    textTransform: 'uppercase',
  },
})
