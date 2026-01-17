import { Text, type TextProps, type TextStyle, type StyleProp } from 'react-native';

import { Colors, type TypographyVariant } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

type LegacyType = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';

const legacyTypeToVariant: Record<LegacyType, TypographyVariant> = {
  default: 'body',
  title: 'display',
  defaultSemiBold: 'bodyBold',
  subtitle: 'headline',
  link: 'link',
};

const weightToFontFamilyKey = {
  regular: 'regular',
  medium: 'medium',
  semiBold: 'semiBold',
  bold: 'bold',
} as const;

type WeightKey = keyof typeof weightToFontFamilyKey;

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  /**
   * Preferred typography variant mapped against the global scale.
   * Defaults to `body` for regular text.
   */
  variant?: TypographyVariant;
  /**
   * Backwards compatible prop with the former API.
   * Prefer using `variant` instead.
   */
  type?: LegacyType;
  /**
   * Optional weight override that keeps the same size/lineHeight.
   */
  weight?: WeightKey;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  variant,
  type = 'default',
  weight,
  ...rest
}: ThemedTextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const resolvedVariant = variant ?? legacyTypeToVariant[type] ?? 'body';
  const color = useThemeColor({ light: lightColor, dark: darkColor }, resolvedVariant === 'link' ? 'tint' : 'text');
  const baseStyle = palette.typography[resolvedVariant] ?? palette.typography.body;

  const fontFamilyOverride = weight ? palette.fontFamily[weightToFontFamilyKey[weight]] : undefined;

  const composedStyle: StyleProp<TextStyle> = [
    baseStyle as TextStyle,
    {
      color,
      fontFamily: fontFamilyOverride ?? baseStyle.fontFamily,
    } as TextStyle,
    style,
  ];

  return <Text style={composedStyle} {...rest} />;
}
