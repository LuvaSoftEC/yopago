import React from 'react';
import {
    ActivityIndicator,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type VariantStyle = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  spinnerColor: string;
  disabledBackground: string;
  disabledBorderColor?: string;
  disabledTextColor: string;
};

export interface ThemedButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}

export const ThemedButton: React.FC<ThemedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
  leftIcon,
  rightIcon,
  accessibilityLabel,
  testID,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const variantMap: Record<ButtonVariant, VariantStyle> = {
    primary: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
      borderWidth: 0,
      textColor: colorScheme === 'dark' ? palette.text : palette.surface,
      spinnerColor: colorScheme === 'dark' ? palette.text : palette.surface,
      disabledBackground: colorScheme === 'dark' ? 'rgba(30,211,139,0.32)' : 'rgba(15,184,110,0.32)',
      disabledTextColor: colorScheme === 'dark' ? palette.textMuted : 'rgba(255,255,255,0.86)',
    },
    secondary: {
      backgroundColor: palette.surfaceAlt,
      borderColor: palette.primary,
      borderWidth: 1,
      textColor: palette.primary,
      spinnerColor: palette.primary,
      disabledBackground: colorScheme === 'dark' ? 'rgba(16,32,26,0.75)' : 'rgba(11,18,32,0.06)',
      disabledBorderColor: colorScheme === 'dark' ? 'rgba(30,211,139,0.3)' : 'rgba(11,18,32,0.12)',
      disabledTextColor: palette.textMuted,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      textColor: palette.primary,
      spinnerColor: palette.primary,
      disabledBackground: 'transparent',
      disabledTextColor: palette.textMuted,
    },
    danger: {
      backgroundColor: '#ef4444',
      borderColor: '#ef4444',
      borderWidth: 0,
      textColor: '#ffffff',
      spinnerColor: '#ffffff',
      disabledBackground: colorScheme === 'dark' ? 'rgba(220,38,38,0.32)' : 'rgba(239,68,68,0.32)',
      disabledTextColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.86)',
    },
  };

  const currentVariant = variantMap[variant];
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    {
      borderRadius: palette.radius.md,
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.lg,
      backgroundColor: isDisabled ? currentVariant.disabledBackground : currentVariant.backgroundColor,
      borderColor: isDisabled
        ? currentVariant.disabledBorderColor ?? currentVariant.borderColor
        : currentVariant.borderColor,
      borderWidth: currentVariant.borderWidth,
    },
    fullWidth && styles.fullWidth,
    style,
  ];

  const textColor = isDisabled ? currentVariant.disabledTextColor : currentVariant.textColor;
  const buttonTypography = palette.typography.button;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={containerStyle}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={currentVariant.spinnerColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
              <Text
                style={[
                  buttonTypography,
                  { color: textColor },
                  textStyle,
                ]}
              >
                {title}
              </Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});

export default ThemedButton;
