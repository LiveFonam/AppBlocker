import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PersistedState } from '../types'
import { cardRadius, colors, fonts, space } from '../theme'
import { patchReportedScreenTime } from '../storage'
import { supabase } from '../supabase'
import {
  openAppSettings,
  openFocusModesHelp,
  openScreenTimeSettings,
} from '../utils/iosSystem'
import { wipeSecureStore } from '../utils/secureStore'
import { FriendControlPanel } from './FriendControlPanel'

type Props = {
  data: PersistedState
  onUpdate: (next: PersistedState) => void
  onReset: () => void
  onReplaySetup: () => void
  bottomInset: number
  autoOpenFriendPanel?: boolean
  onFriendPanelOpened?: () => void
}

export function SettingsView({
  data,
  onUpdate,
  onReset,
  onReplaySetup,
  bottomInset,
  autoOpenFriendPanel,
  onFriendPanelOpened,
}: Props) {
  const [hoursDraft, setHoursDraft] = useState(
    String(Math.round((data.profile.reportedDailyPhoneMinutes / 60) * 10) / 10),
  )
  const [friendPanelOpen, setFriendPanelOpen] = useState(false)

  useEffect(() => {
    if (autoOpenFriendPanel) {
      setFriendPanelOpen(true)
      onFriendPanelOpened?.()
    }
  }, [autoOpenFriendPanel])

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
        <Text style={styles.label}>Friend Control</Text>
        <Text style={[styles.body, { marginBottom: 16 }]}>
          Share an invite code with a trusted friend so they can unlock apps for you, or paste a
          friend's code to control theirs. Codes rotate every hour.
        </Text>
        <Pressable style={styles.primaryOutline} onPress={() => setFriendPanelOpen(true)}>
          <Text style={styles.primaryOutlineText}>Open Friend Control</Text>
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

      <View style={[styles.card, styles.minCard]}>
        <Text style={styles.label}>Need help?</Text>
        <Text style={[styles.body, { marginBottom: 12 }]}>
          Email us and we will get back to you.
        </Text>
        <Pressable
          onPress={() => Linking.openURL('mailto:livefonam@gmail.com')}
          style={styles.supportBtn}
        >
          <Text style={styles.supportLabel}>Contact support</Text>
        </Pressable>
      </View>

      <View style={[styles.card, styles.minCard, styles.dangerCard]}>
        <Text style={[styles.label, { color: '#ff453a' }]}>Danger zone</Text>
        <Text style={[styles.body, { marginBottom: 20 }]}>
          Permanently delete your account and every row of your data on our
          servers. This cannot be undone.
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Delete your account?',
              'This wipes your account, friend pairings, and any synced settings. You will be signed out and cannot recover this data. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Really delete?',
                      'Last chance. Tap Delete to permanently remove your account.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              const { error } = await supabase.rpc('delete_my_account')
                              if (error) {
                                Alert.alert(
                                  'Could not delete account',
                                  `Please try again, or email livefonam@gmail.com.\n\nError: ${error.message}`,
                                )
                                return
                              }
                              try { await supabase.auth.signOut() } catch (_) {}
                              try { await AsyncStorage.clear() } catch (_) {}
                              try { await wipeSecureStore() } catch (_) {}
                              Alert.alert(
                                'Account deleted',
                                'Your account and all server data are gone. The app will restart.',
                                [{ text: 'OK', onPress: onReplaySetup }],
                              )
                            } catch (e: any) {
                              Alert.alert(
                                'Could not delete account',
                                e?.message || 'Unknown error. Email livefonam@gmail.com.',
                              )
                            }
                          },
                        },
                      ],
                    )
                  },
                },
              ],
            )
          }
          style={styles.destructiveBtn}
        >
          <Text style={styles.destructiveLabel}>Delete my account</Text>
        </Pressable>
      </View>

      <FriendControlPanel visible={friendPanelOpen} onClose={() => setFriendPanelOpen(false)} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  dangerCard: {
    borderColor: 'rgba(255, 69, 58, 0.35)',
  },
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
  supportBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    alignItems: 'center',
  },
  supportLabel: {
    ...fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
})
