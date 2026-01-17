import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestSession } from '@/contexts/GuestSessionContext';

interface GuestUpgradeAccountModalProps {
  visible: boolean;
  onClose: () => void;
  name?: string | null;
  email?: string | null;
}

export const GuestUpgradeAccountModal: React.FC<GuestUpgradeAccountModalProps> = ({
  visible,
  onClose,
  name,
  email,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const router = useRouter();
  const { register } = useAuth();
  const { logoutGuest } = useGuestSession();

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => (email ?? '').trim(), [email]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const trimmedName = (name ?? '').trim();
    const parts = trimmedName ? trimmedName.split(/\s+/) : [];
    const suggestedFirst = parts[0] ?? '';
    const suggestedLast = parts.slice(1).join(' ');
    const suggestedUsername = normalizedEmail.includes('@')
      ? normalizedEmail.split('@')[0]
      : trimmedName.replace(/\s+/g, '').toLowerCase();

    setUsername(suggestedUsername || '');
    setFirstName(suggestedFirst);
    setLastName(suggestedLast);
    setPassword('');
    setConfirmPassword('');
    setError(null);
  }, [visible, name, normalizedEmail]);

  const styles = useMemo(() => createStyles(palette), [palette]);

  const closeSafely = useCallback(() => {
    if (loading) {
      return;
    }
    onClose();
  }, [loading, onClose]);

  const validate = () => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedUsername) {
      return 'Elige un nombre de usuario.';
    }

    if (!normalizedEmail) {
      return 'No se pudo recuperar tu correo para completar el registro.';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      return 'Tu correo debe tener un formato válido (ej: correo@dominio.com).';
    }

    if (!trimmedPassword || trimmedPassword.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }

    if (trimmedPassword !== trimmedConfirm) {
      return 'Las contraseñas no coinciden.';
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        username: username.trim(),
        email: normalizedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: password.trim(),
        confirmPassword: confirmPassword.trim(),
      };

      await register(payload);

      Alert.alert(
        'Cuenta creada',
        'Ahora inicia sesión con tu correo y la nueva contraseña.',
      );

      try {
        await logoutGuest();
      } catch (logoutError) {
        console.warn('[GuestUpgradeAccountModal] logout error', logoutError);
      }

      onClose();
      router.replace('/login' as Href);
    } catch (err: any) {
      const message = err?.message || 'No se pudo completar el registro.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={closeSafely}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={[styles.title, { color: palette.text }]}>Completa tu registro</Text>
              <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                Usaremos tu nombre y correo actuales. Solo agrega los datos que faltan para crear tu cuenta permanente.
              </Text>

              <View style={styles.summaryBox}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Nombre</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>{name || 'Invitado'}</Text>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Correo</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>{normalizedEmail || 'Sin correo'}</Text>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Nombre de usuario</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="usuario"
                  autoCapitalize="none"
                  style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, styles.rowItem]}>
                  <Text style={[styles.label, { color: palette.textMuted }]}>Nombre</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Nombre"
                    autoCapitalize="words"
                    style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                  />
                </View>
                <View style={[styles.field, styles.rowItem]}>
                  <Text style={[styles.label, { color: palette.textMuted }]}>Apellido</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Apellido"
                    autoCapitalize="words"
                    style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Contraseña</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="******"
                  secureTextEntry
                  style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Confirmar contraseña</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="******"
                  secureTextEntry
                  style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                />
              </View>

              {error ? <Text style={[styles.error, { color: palette.warning }]}>{error}</Text> : null}

              <View style={styles.actions}>
                <Button title="Más tarde" variant="ghost" onPress={closeSafely} disabled={loading} />
                <Button
                  title={loading ? 'Registrando...' : 'Crear cuenta' }
                  onPress={handleSubmit}
                  loading={loading}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (palette: typeof Colors.light) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      padding: 16,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
    },
    card: {
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    content: {
      padding: 24,
      gap: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
    },
    subtitle: {
      fontSize: 14,
    },
    summaryBox: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 16,
      gap: 6,
    },
    summaryLabel: {
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: '600',
    },
    field: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    rowItem: {
      flex: 1,
    },
    error: {
      textAlign: 'center',
      fontSize: 14,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
  });

export default GuestUpgradeAccountModal;
