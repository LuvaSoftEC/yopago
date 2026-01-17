import React, { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthGradientColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthScreenProps {
  style?: StyleProp<ViewStyle>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ style }) => {
  const [isLogin, setIsLogin] = useState(true);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';

  const handleSwitchToLogin = () => setIsLogin(true);
  const handleSwitchToRegister = () => setIsLogin(false);

  const gradientColors = (isDark ? AuthGradientColors.dark : AuthGradientColors.light) as [
    string,
    string,
    ...string[],
  ];

  const headline = useMemo(
    () =>
      isLogin
        ? 'Comparte y divide tus gastos, sin olvidar ninguno!'
        : 'Crea una cuenta y manten tus finanzas compartidas al dia',
    [isLogin],
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: palette.background }, style]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.accentCircle,
          styles.circleTop,
          { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)' },
        ]}
      />
      <View
        style={[
          styles.accentCircle,
          styles.circleBottom,
          { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(34, 197, 94, 0.12)' },
        ]}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.authCard,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.88)',
              borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.7)',
              shadowColor: isDark ? '#0f172a' : '#93c5fd',
            },
            palette.shadow.card,
          ]}
        >
          <View style={styles.brandBadgeWrapper}>
            <View
              style={[
                styles.brandBadge,
                {
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255,255,255,0.9)',
                  borderColor: palette.divider,
                },
              ]}
            >
              <View style={[styles.brandDot, { backgroundColor: palette.tint }]} />
              <ThemedText variant="label" weight="semiBold" style={styles.brandText}>
                Yopago
              </ThemedText>
            </View>
          </View>

          <View style={styles.formSection}>
            <ThemedText
              variant="label"
              weight="bold"
              style={[styles.headlineText, { color: palette.tint }]}
            >
              {headline}
            </ThemedText>

            <ThemedText variant="headline" weight="bold" style={styles.title}>
              {isLogin ? 'Iniciar Sesion' : 'Crear Cuenta'}
            </ThemedText>

            {isLogin ? (
              <LoginForm
                variant="plain"
                onSwitchToRegister={handleSwitchToRegister}
                showDemoUsers={false}
                style={styles.form}
              />
            ) : (
              <RegisterForm onSwitchToLogin={handleSwitchToLogin} style={styles.form} />
            )}

            <View style={styles.switchWrapper}>
              {isLogin ? (
                <ThemedText variant="body" style={styles.switchText} onPress={handleSwitchToRegister}>
                  No tienes cuenta?{' '}
                  <ThemedText variant="link" style={styles.switchLink}>
                    Registrate
                  </ThemedText>
                </ThemedText>
              ) : (
                <ThemedText variant="body" style={styles.switchText} onPress={handleSwitchToLogin}>
                  Ya tienes cuenta?{' '}
                  <ThemedText variant="link" style={styles.switchLink}>
                    Inicia sesion
                  </ThemedText>
                </ThemedText>
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <ThemedText variant="caption" style={styles.footerText}>
              by LuVaSoft
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
  },
  authCard: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  brandBadgeWrapper: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brandText: {
    letterSpacing: 0.5,
  },
  formSection: {
    padding: 4,
    gap: 18,
  },
  title: {
    textAlign: 'center',
  },
  form: {
    alignSelf: 'stretch',
  },
  switchWrapper: {
    alignItems: 'center',
    marginTop: 18,
  },
  switchText: {
    color: '#22d3ee',
    fontWeight: '600',
    textAlign: 'center',
  },
  switchLink: {
    color: '#38bdf8',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#7dd3fc',
    opacity: 0.7,
  },
  accentCircle: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.7,
  },
  circleTop: {
    top: -60,
    right: -40,
  },
  circleBottom: {
    bottom: -80,
    left: -60,
  },
  headlineText: {
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(34,211,238,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});

export default AuthScreen;
