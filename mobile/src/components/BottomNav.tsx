import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { TabId } from '../types'
import { colors, space } from '../theme'

const tabs: {
  id: TabId
  outline: keyof typeof Ionicons.glyphMap
  filled: keyof typeof Ionicons.glyphMap
}[] = [
  { id: 'home', outline: 'home-outline', filled: 'home' },
  { id: 'block', outline: 'apps-outline', filled: 'apps' },
  { id: 'stats', outline: 'bar-chart-outline', filled: 'bar-chart' },
  { id: 'settings', outline: 'settings-outline', filled: 'settings' },
]

type Props = {
  active: TabId
  onChange: (t: TabId) => void
}

export function BottomNav({ active, onChange }: Props) {
  const insets = useSafeAreaInsets()
  const bottom = Math.max(insets.bottom, 10)
  const barHeight = space.bottomNav + bottom

  return (
    <View style={[styles.shell, { height: barHeight }]} pointerEvents="box-none">
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.45, 1]}
        style={[styles.gradient, { paddingBottom: bottom }]}
      >
        <View style={styles.row}>
          {tabs.map(({ id, outline, filled }) => {
            const isActive = active === id
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => onChange(id)}
                style={styles.btn}
                hitSlop={8}
              >
                <Ionicons
                  name={isActive ? filled : outline}
                  size={26}
                  color={isActive ? colors.text : 'rgba(255,255,255,0.38)'}
                />
              </Pressable>
            )
          })}
        </View>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 14,
    paddingHorizontal: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  btn: {
    padding: 10,
    minWidth: 48,
    alignItems: 'center',
  },
})
