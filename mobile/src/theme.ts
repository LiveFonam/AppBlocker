import { Platform, TextStyle } from 'react-native'

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

/** Fixed header title — never derived from onboarding goals. */
export const appBrandName = 'Austerity'

export const cardRadius = 16

/** iOS: San Francisco via system font weights. Android: Inter. */
function face(
  iosWeight: NonNullable<TextStyle['fontWeight']>,
  androidFamily: string,
): TextStyle {
  return Platform.OS === 'ios'
    ? { fontWeight: iosWeight }
    : { fontFamily: androidFamily }
}

export const fonts = {
  light: face('300', 'Inter_300Light'),
  regular: face('400', 'Inter_400Regular'),
  medium: face('500', 'Inter_500Medium'),
  semibold: face('600', 'Inter_600SemiBold'),
  bold: face('700', 'Inter_700Bold'),
}
