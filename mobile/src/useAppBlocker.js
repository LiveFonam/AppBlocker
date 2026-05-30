import { useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Native = NativeModules.AppBlocker ?? null;

export function useAppBlocker() {
  const [isBlocking, setIsBlocking]       = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [blockedPackages, setBlockedPackages] = useState([]); // Android
  const [installedApps, setInstalledApps]    = useState([]);  // Android

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const [blocking, count, pkgs] = await Promise.all([
          AsyncStorage.getItem('@nova_is_blocking'),
          AsyncStorage.getItem('@nova_selected_count'),
          AsyncStorage.getItem('@nova_blocked_packages'),
        ]);
        setIsBlocking(blocking === 'true');
        setSelectedCount(count ? parseInt(count, 10) : 0);
        // Guard the parse: a corrupted/legacy value must not throw and abort hydration.
        let parsed = [];
        try { parsed = pkgs ? JSON.parse(pkgs) : []; } catch (_) { parsed = []; }
        if (!Array.isArray(parsed)) parsed = [];
        setBlockedPackages(parsed);
      } catch (_) {}

      if (Platform.OS === 'ios' && Native) {
        // A rejecting native call (e.g. FamilyControls not yet authorized at cold
        // start) must not break hydration or surface as an unhandled rejection.
        try {
          const [c, b] = await Promise.all([
            Native.getSelectedCount(),
            Native.isBlocking(),
          ]);
          setSelectedCount(c);
          setIsBlocking(b);
        } catch (_) {}
      }
    })();
  }, []);

  // Load installed apps on Android
  useEffect(() => {
    if (Platform.OS === 'android' && Native) {
      Native.getInstalledApps().then(setInstalledApps).catch(() => {});
    }
  }, []);

  // Opens iOS system picker or signals Android to show custom list
  const openAppPicker = useCallback(async (setShowAndroidPicker) => {
    if (Platform.OS === 'ios') {
      if (!Native) {
        Alert.alert('Native Build Required', 'Run the app via Xcode (not Expo Go) to use the system app picker.');
        return;
      }
      // showAppPicker is now a promise that can reject (no presenter available,
      // iOS < 16). Swallow the rejection so it never surfaces as an unhandled
      // rejection; if the picker never presented there is nothing to re-read.
      try {
        await Native.showAppPicker();
        const c = await Native.getSelectedCount();
        setSelectedCount(c);
        await AsyncStorage.setItem('@nova_selected_count', String(c));
      } catch (_) {}
    } else {
      setShowAndroidPicker?.(true);
    }
  }, []);

  const startBlocking = useCallback(async (startMinutes, endMinutes) => {
    // The iOS/Android native startBlocking can now reject (e.g. "no_selection"
    // when no apps are picked). Catch it here so callers never get an unhandled
    // rejection, and so we only mark blocking active when it actually started.
    if (Platform.OS === 'ios' && Native) {
      try {
        await Native.startBlocking(startMinutes, endMinutes);
      } catch (e) {
        if (e?.code === 'no_selection') {
          Alert.alert('Pick apps first', 'Choose which apps to block before starting a focus session.');
        }
        return false;
      }
    } else if (Platform.OS === 'android' && Native && blockedPackages.length > 0) {
      try {
        await Native.startBlocking(blockedPackages);
      } catch (_) {
        return false;
      }
    } else if (!Native) {
      Alert.alert('Native Build Required', 'Real blocking requires a native build.');
    }
    setIsBlocking(true);
    await AsyncStorage.setItem('@nova_is_blocking', 'true');
    return true;
  }, [blockedPackages]);

  const stopBlocking = useCallback(async () => {
    if (Native) await Native.stopBlocking();
    setIsBlocking(false);
    await AsyncStorage.setItem('@nova_is_blocking', 'false');
  }, []);

  const requestAuthorization = useCallback(async () => {
    if (!Native) {
      Alert.alert(
        'Native Build Required',
        'Permission requests need a real build. Use "eas build" to test this on device.',
      );
      return;
    }
    if (Platform.OS === 'ios') {
      await Native.requestAuthorization();
    } else if (Platform.OS === 'android') {
      // Open Accessibility Settings so user can enable the Blocker service
      await Native.openAccessibilitySettings();
      // After they return, prompt for Usage Access too
      Alert.alert(
        'One More Step',
        'Also enable "Usage Access" for Student Focus in Settings → Apps → Special app access → Usage access.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Later', style: 'cancel' },
        ],
      );
    }
  }, []);

  const togglePackage = useCallback(async (pkg) => {
    setBlockedPackages(prev => {
      const next = prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg];
      setSelectedCount(next.length);
      AsyncStorage.setItem('@nova_blocked_packages', JSON.stringify(next));
      AsyncStorage.setItem('@nova_selected_count', String(next.length));
      return next;
    });
  }, []);

  const getUsageStats = useCallback(async () => {
    if (Platform.OS === 'android' && Native) {
      return Native.getUsageStats().catch(() => []);
    }
    return [];
  }, []);

  return { isBlocking, selectedCount, blockedPackages, installedApps, openAppPicker, startBlocking, stopBlocking, togglePackage, requestAuthorization, getUsageStats };
}
