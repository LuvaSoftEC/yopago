import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedButton } from '@/components/ui/Button';
import { Colors, type AppPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter, type Href } from 'expo-router';

const applyAlpha = (hexColor: string, alpha: number) => {
  const sanitized = hexColor.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, logout, isLoading: authLoading, isAuthenticated } = useAuth();
  const {
    preference,
    setPreference,
    isLoading: themeLoading,
    systemColorScheme,
  } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const styles = useMemo(() => createStyles(palette), [palette]);

  const currentLanguage = i18n.language;

  const changeLanguage = useCallback(async (lng: string) => {
    await i18n.changeLanguage(lng);
  }, [i18n]);

  const appearanceSummary = useMemo(() => {
    if (preference === 'system') {
      return t('profile.systemDescription', { 
        mode: systemColorScheme === 'dark' ? t('profile.dark') : t('profile.light')
      });
    }

    return preference === 'dark'
      ? t('profile.forcedDark')
      : t('profile.forcedLight');
  }, [preference, systemColorScheme, t]);

  const preferenceOptions = useMemo(
    () => [
      {
        value: 'system' as ThemePreference,
        title: 'Sincronizado con tu sistema',
        description: `Se adapta automáticamente a ${systemColorScheme === 'dark' ? 'modo oscuro' : 'modo claro'} según el dispositivo.`,
        icon: 'phone-portrait-outline' as const,
      },
      {
        value: 'light' as ThemePreference,
        title: 'Siempre claro',
        description: 'Paleta luminosa y limpia, ideal para espacios bien iluminados.',
        icon: 'sunny-outline' as const,
      },
      {
        value: 'dark' as ThemePreference,
        title: 'Siempre oscuro',
        description: 'Contrastes suaves para descansar la vista en ambientes con poca luz.',
        icon: 'moon-outline' as const,
      },
    ],
    [systemColorScheme],
  );

  const buildPreferenceHandler = useCallback(
    (value: ThemePreference) => () => {
      if (themeLoading || preference === value) {
        return;
      }

      void setPreference(value);
    },
    [preference, setPreference, themeLoading],
  );

  const handleLogout = useCallback(async () => {
    if (authLoading) {
      return;
    }

    await logout();
    router.replace('/login' as Href);
  }, [authLoading, logout, router]);

  const showAuthScreen = !isAuthenticated && !authLoading;

  const initials = useMemo(() => {
    if (!user) {
      return '?';
    }
    const first = user.firstName?.[0] ?? user.username?.[0] ?? '';
    const second = user.lastName?.[0] ?? user.username?.[1] ?? '';
    return `${first}${second}`.toUpperCase() || user.username.slice(0, 2).toUpperCase();
  }, [user]);

  if (showAuthScreen) {
    return <AuthScreen />;
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, {padding: palette.spacing.lg, borderRadius: palette.radius.lg}]}> 
          <View style={[styles.profileHeader, {marginBottom: palette.spacing.md}]}> 
            <View style={styles.avatar}> 
              <ThemedText style={styles.avatarText}>{initials}</ThemedText> 
            </View> 
            <View style={styles.profileInfo}> 
              <ThemedText style={{fontSize: palette.font.title, fontWeight: "800", color: palette.text, letterSpacing: 0.5}}> 
                {user?.firstName || user?.username || 'Invitado'} 
              </ThemedText> 
              {user?.email ? ( 
                <ThemedText style={{ color: palette.textMuted, fontSize: palette.font.small }}> 
                  {user.email} 
                </ThemedText> 
              ) : null} 
            </View> 
          </View> 
        </View>

        <View style={[styles.section, {padding: palette.spacing.lg, borderRadius: palette.radius.lg}]}> 
          <View style={[styles.sectionHeader, {marginBottom: palette.spacing.sm}]}> 
            <ThemedText style={{fontSize: palette.font.h2, fontWeight: "700", color: palette.text}}>{t('profile.appearance')}</ThemedText> 
            <ThemedText style={[styles.sectionDescription, {fontSize: palette.font.small}]}> 
              {appearanceSummary} 
            </ThemedText> 
          </View> 

          <View style={styles.preferenceList}> 
            {preferenceOptions.map((option) => { 
              const selected = preference === option.value; 

              return ( 
                <Pressable 
                  key={option.value} 
                  onPress={buildPreferenceHandler(option.value)} 
                  style={({ pressed }) => [ 
                    styles.preferenceItem, 
                    selected && styles.preferenceItemSelected, 
                    selected && { 
                      borderColor: applyAlpha(palette.primary, 0.35), 
                      backgroundColor: applyAlpha(palette.primary, 0.12), 
                    }, 
                    pressed && { opacity: 0.85 }, 
                  ]} 
                  accessibilityRole="button" 
                  accessibilityState={{ selected }} 
                > 
                  <View 
                    style={[ 
                      styles.preferenceIconWrapper, 
                      selected && { backgroundColor: applyAlpha(palette.primary, 0.18) }, 
                    ]} 
                  > 
                    <Ionicons 
                      name={option.icon} 
                      size={22} 
                      color={selected ? palette.primary : palette.textMuted} 
                    /> 
                  </View> 
                  <View style={styles.preferenceInfo}> 
                    <ThemedText style={{color: palette.text, fontWeight: "600", fontSize: palette.font.body}}>{option.title}</ThemedText> 
                    <ThemedText style={{color: palette.textMuted, fontSize: palette.font.small}}>{option.description}</ThemedText> 
                  </View> 
                  {selected ? ( 
                    <Ionicons name="checkmark-circle" size={24} color={palette.primary} /> 
                  ) : ( 
                    <Ionicons name="ellipse-outline" size={22} color={applyAlpha(palette.textMuted, 0.35)} /> 
                  )} 
                </Pressable> 
              ); 
            })} 
          </View> 

          {themeLoading ? ( 
            <View style={styles.loadingRow}> 
              <ActivityIndicator color={palette.primary} size="small" /> 
              <ThemedText style={styles.loadingText}>Sincronizando preferencia de tema…</ThemedText> 
            </View> 
          ) : null} 
        </View>

        {/* Language Section */}
        <View style={[styles.section, {padding: palette.spacing.lg, borderRadius: palette.radius.lg}]}> 
          <View style={[styles.sectionHeader, {marginBottom: palette.spacing.sm}]}> 
            <ThemedText style={{fontSize: palette.font.h2, fontWeight: "700", color: palette.text}}>{t('settings.language')}</ThemedText> 
            <ThemedText style={[styles.sectionDescription, {fontSize: palette.font.small}]}> 
              {t('settings.languageDescription')} 
            </ThemedText> 
          </View> 

          <View style={styles.preferenceList}> 
            {[
              { value: 'es', title: 'Español', icon: 'language-outline' as const },
              { value: 'en', title: 'English', icon: 'language-outline' as const },
            ].map((option) => { 
              const selected = currentLanguage === option.value; 

              return ( 
                <Pressable 
                  key={option.value} 
                  onPress={() => void changeLanguage(option.value)} 
                  style={({ pressed }) => [ 
                    styles.preferenceItem, 
                    selected && styles.preferenceItemSelected, 
                    selected && { 
                      borderColor: applyAlpha(palette.primary, 0.35), 
                      backgroundColor: applyAlpha(palette.primary, 0.12), 
                    }, 
                    pressed && { opacity: 0.85 }, 
                  ]} 
                  accessibilityRole="button" 
                  accessibilityState={{ selected }} 
                > 
                  <View 
                    style={[ 
                      styles.preferenceIconWrapper, 
                      selected && { backgroundColor: applyAlpha(palette.primary, 0.18) }, 
                    ]} 
                  > 
                    <Ionicons 
                      name={option.icon} 
                      size={22} 
                      color={selected ? palette.primary : palette.textMuted} 
                    /> 
                  </View> 
                  <View style={styles.preferenceInfo}> 
                    <ThemedText style={{color: palette.text, fontWeight: "600", fontSize: palette.font.body}}>{option.title}</ThemedText> 
                  </View> 
                  {selected ? ( 
                    <Ionicons name="checkmark-circle" size={24} color={palette.primary} /> 
                  ) : ( 
                    <Ionicons name="ellipse-outline" size={22} color={applyAlpha(palette.textMuted, 0.35)} /> 
                  )} 
                </Pressable> 
              ); 
            })} 
          </View> 
        </View>

        <View style={[styles.section, {padding: palette.spacing.lg, borderRadius: palette.radius.lg}]}> 
          <ThemedText style={{fontSize: palette.font.h2, fontWeight: "700", color: palette.text, marginBottom: palette.spacing.xs}}>{t('auth.logout')}</ThemedText> 
          <ThemedText style={[styles.sectionDescription, {fontSize: palette.font.small}]}> 
            Administra tu cuenta y cierra sesión de forma segura. 
          </ThemedText> 
          <ThemedButton 
            title={authLoading ? t('auth.loggingOut') : t('auth.logout')} 
            onPress={() => void handleLogout()} 
            variant="danger" 
            fullWidth 
            loading={authLoading} 
          /> 
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
      padding: palette.spacing.lg,
      gap: palette.spacing.lg,
    },
    profileCard: {
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      ...palette.shadow.card,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: palette.spacing.md,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: applyAlpha(palette.primary, 0.18),
      borderWidth: 2,
      borderColor: palette.primary,
    },
    avatarText: {
      fontWeight: '700',
      fontSize: 24,
      color: palette.primary,
    },
    profileInfo: {
      flex: 1,
      gap: palette.spacing.xs,
    },
    profileName: {
      color: palette.text,
    },
    profileEmail: {
      color: palette.textMuted,
    },
    section: {
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      gap: palette.spacing.md,
    },
    sectionHeader: {
      gap: palette.spacing.sm,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: palette.spacing.xs,
    },
    switchLabel: {
      color: palette.text,
      fontWeight: '600',
    },
    preferenceList: {
      gap: palette.spacing.sm,
    },
    preferenceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: palette.spacing.sm,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.sm,
      borderRadius: palette.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      backgroundColor: palette.surface,
    },
    preferenceItemSelected: {
      borderColor: palette.primary,
      backgroundColor: applyAlpha(palette.primary, 0.12),
    },
    preferenceIconWrapper: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: applyAlpha(palette.primary, 0.12),
    },
    preferenceInfo: {
      flex: 1,
      gap: 4,
    },
    preferenceTitle: {
      color: palette.text,
      fontWeight: '600',
    },
    preferenceDescription: {
      color: palette.textMuted,
      fontSize: palette.font.small,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: palette.spacing.sm,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.sm,
      backgroundColor: palette.surfaceAlt,
    },
    loadingText: {
      color: palette.textMuted,
      fontSize: palette.font.small,
    },
    sectionTitle: {
      color: palette.text,
    },
    sectionDescription: {
      color: palette.textMuted,
      fontSize: palette.font.small,
    },
  });
}
