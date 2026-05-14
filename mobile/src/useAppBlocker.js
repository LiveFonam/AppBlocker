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
      const [blocking, count, pkgs] = await Promise.all([
        AsyncStorage.getItem('@nova_is_blocking'),
        AsyncStorage.getItem('@nova_selected_count'),
        AsyncStorage.getItem('@nova_blocked_packages'),
      ]);
      setIsBlocking(blocking === 'true');
      setSelectedCount(count ? parseInt(count, 10) : 0);
      setBlockedPackages(pkgs ? JSON.parse(pkgs) : []);

      if (Platform.OS === 'ios' && Native) {
        const [c, b] = await Promise.all([
          Native.getSelectedCount(),
          Native.isBlocking(),
        ]);
        setSelectedCount(c);
        setIsBlocking(b);
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
      await Native.showAppPicker();
      const c = await Native.getSelectedCount();
      setSelectedCount(c);
      await AsyncStorage.setItem('@nova_selected_count', String(c));
    } else {
      setShowAndroidPicker?.(true);
    }
  }, []);

  const startBlocking = useCallback(async (startMinutes, endMinutes) => {
    if (Platform.OS === 'ios' && Native) {
      await Native.startBlocking(startMinutes, endMinutes);
    } else if (Platform.OS === 'android' && Native && blockedPackages.length > 0) {
      await Native.startBlocking(blockedPackages);
    } else if (!Native) {
      Alert.alert('Native Build Required', 'Real blocking requires a native build.');
    }
    setIsBlocking(true);
    await AsyncStorage.setItem('@nova_is_blocking', 'true');
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
