import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useGuestSession } from '@/contexts/GuestSessionContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RedeemInvitationScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { redeemInvitation, loading, error, session } = useGuestSession();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');

  const token = useMemo(() => {
    const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
    return typeof rawToken === 'string' ? rawToken : '';
  }, [params]);

  useEffect(() => {
    const rawEmail = Array.isArray(params.email) ? params.email[0] : params.email;
    const rawName = Array.isArray(params.name) ? params.name[0] : params.name;

    if (typeof rawEmail === 'string') {
      setEmail(rawEmail);
    }
    if (typeof rawName === 'string') {
      setGuestName(rawName);
    }
  }, [params.email, params.name]);

  useEffect(() => {
    if (session?.groupId) {
      router.replace('/guest' as Href);
    }
  }, [session, router]);

  const handleRedeem = async () => {
    if (!token) {
      return;
    }
    const trimmedName = guestName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      return;
    }
    await redeemInvitation(token, { guestName: trimmedName, email: trimmedEmail });
    router.replace('/guest' as Href);
  };

  const isSubmitDisabled = loading || !guestName.trim() || !email.trim();

  return (
  <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}> 
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: palette.background }}
        >
          <Text style={[styles.title, { color: palette.text }]}>Únete al grupo</Text>
          <Text style={[styles.description, { color: palette.textMuted }]}>
            Completa tus datos para acceder como invitado al grupo compartido contigo.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Nombre</Text>
            <TextInput
              placeholder="Tu nombre"
              value={guestName}
              onChangeText={setGuestName}
              autoCapitalize="words"
              style={[styles.input, {
                borderColor: palette.divider,
                color: palette.text,
              }]}
            />
          </View>

          <View style={[styles.formGroup, styles.lastFormGroup]}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Correo electrónico</Text>
            <TextInput
              placeholder="invita@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={[styles.input, {
                borderColor: palette.divider,
                color: palette.text,
              }]}
            />
          </View>

          <View style={[styles.tokenContainer, {
            backgroundColor: palette.surface,
            borderColor: palette.divider,
          }]}>
            <Text style={[styles.tokenLabel, { color: palette.textMuted }]}>Código de invitación</Text>
            <Text style={[styles.tokenValue, { color: palette.text }]}>{token || 'Token no encontrado'}</Text>
          </View>

          {error ? <Text style={[styles.error, { color: palette.warning }]}>{error}</Text> : null}

          <Button
            title={loading ? 'Ingresando...' : 'Ingresar'}
            onPress={handleRedeem}
            disabled={isSubmitDisabled}
            loading={loading}
            fullWidth
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  lastFormGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  tokenContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  tokenLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tokenValue: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    marginTop: 12,
  },
});
