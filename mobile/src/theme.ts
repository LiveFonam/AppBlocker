import { TextStyle } from 'react-native'

export const colors = {
  bg: '#000000',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.4)',
  muted2: 'rgba(255,255,255,0.3)',
  muted3: 'rgba(255,255,255,0.25)',
  border: '#111111',
  outline: '#222222',
  barBorder: 'rgba(255,255,255,0.2)',
}

export const space = {
  container: 24,
  bottomNav: 88,
}

/** Fixed header title - never derived from onboarding goals. */
export const appBrandName = 'Student Focus'

export const cardRadius = 16

/**
 * System font on both platforms via fontWeight. No custom font family is loaded
 * anywhere (no useFonts), so mapping Android to Inter_* would silently drop those
 * weights. Relying on fontWeight keeps Android and iOS consistent.
 */
function face(weight: NonNullable<TextStyle['fontWeight']>): TextStyle {
  return { fontWeight: weight }
}

export const fonts = {
  light: face('300'),
  regular: face('400'),
  medium: face('500'),
  semibold: face('600'),
  bold: face('700'),
}
