import { useEffect } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useGuestSession } from '@/contexts/GuestSessionContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function GuestLayout() {
  const { loading, isGuestAuthenticated, session } = useGuestSession();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isGuestAuthenticated) {
      console.log('[GuestLayout] No active guest session');
    }
  }, [loading, isGuestAuthenticated]);

  const isValidatingSession = loading && !session;

  if (isValidatingSession) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}> 
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.message, { color: palette.textMuted }]}>Verificando acceso al grupo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isGuestAuthenticated || !session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}> 
        <View style={styles.centered}>
          <Text style={[styles.title, { color: palette.text }]}>Necesitas una invitación</Text>
          <Text style={[styles.message, { color: palette.textMuted }]}>
            Abre el enlace de invitación que compartieron contigo para acceder al grupo.
          </Text>
          <Button
            title="Volver al inicio"
            onPress={() => router.replace('/' as never)}
            variant="secondary"
            style={styles.buttonSpacer}
          />
        </View>
      </SafeAreaView>
    );
  }

  const headerTitle = session.guestName ? `Invitado • ${session.guestName}` : 'Modo invitado';

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        headerTitleStyle: { fontFamily: palette.typography.headline.fontFamily },
      }}
    >
      <Stack.Screen name="index" options={{ title: headerTitle }} />
    </Stack>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  centered: ViewStyle;
  title: TextStyle;
  message: TextStyle;
  buttonSpacer: ViewStyle;
}>({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  buttonSpacer: {
    marginTop: 20,
  },
});
