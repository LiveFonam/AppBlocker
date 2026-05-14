import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native'

type Props = {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: ViewStyle | ViewStyle[]
}

export function Skeleton({ width = '100%', height = 16, radius = 6, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const bg = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)'],
  })

  return (
    <Animated.View
      style={[
        styles.box,
        { width: width as any, height, borderRadius: radius, backgroundColor: bg },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
})
