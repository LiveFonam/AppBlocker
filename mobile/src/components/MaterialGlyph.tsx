import { MaterialIcons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

const GLYPHS = {
  home: 'apps',
  block: 'block',
  stats: 'insert-chart',
  settings: 'settings',
  tune: 'tune',
  shield: 'security',
} as const

export type GlyphKey = keyof typeof GLYPHS

type Props = {
  name: GlyphKey
  size?: number
  color?: string
  style?: StyleProp<TextStyle>
}

export function MaterialGlyph({ name, size = 24, color = '#fff', style }: Props) {
  const glyph = GLYPHS[name]
  return (
    <MaterialIcons
      name={glyph as ComponentProps<typeof MaterialIcons>['name']}
      size={size}
      color={color}
      style={style}
    />
  )
}
