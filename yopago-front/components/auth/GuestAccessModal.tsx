import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useGuestSession } from '@/contexts/GuestSessionContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface GuestAccessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function GuestAccessModal({ visible, onClose }: GuestAccessModalProps) {
  const { accessWithCode, loading, error, clearError } = useGuestSession();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const router = useRouter();

  const [groupCode, setGroupCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isSubmitDisabled = useMemo(() => {
    return loading || !groupCode.trim() || !guestName.trim() || !email.trim();
  }, [loading, groupCode, guestName, email]);

  const resetState = () => {
    setGroupCode('');
    setGuestName('');
    setEmail('');
    setLocalError(null);
    clearError();
  };

  const handleClose = () => {
    if (loading) {
      return;
    }
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedCode = groupCode.trim();
    const trimmedName = guestName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedCode || !trimmedName) {
      setLocalError('Necesitas ingresar el código del grupo y tu nombre.');
      return;
    }

    if (!trimmedEmail) {
      setLocalError('El correo electrónico es obligatorio. Usa el mismo que registraste la primera vez.');
      return;
    }

    try {
      setLocalError(null);
      await accessWithCode({
        groupCode: trimmedCode,
        guestName: trimmedName,
        email: trimmedEmail,
      });
      resetState();
      onClose();
      router.replace('/guest' as Href);
    } catch (submissionError: any) {
      const message = submissionError?.message || 'No se pudo acceder con el código proporcionado.';
      setLocalError(message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { justifyContent: 'center' }]}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[styles.heading, { color: palette.text }]}>Accede con tu código</Text>
            <Text style={[styles.subheading, { color: palette.textMuted }]}>
              Ingresa el código compartido, tu nombre y el correo con el que te identificaste.
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.textMuted }]}>Código del grupo</Text>
              <TextInput
                value={groupCode}
                onChangeText={setGroupCode}
                placeholder="Ej: ABCD1234"
                autoCapitalize="characters"
                style={[
                  styles.input,
                  {
                    borderColor: palette.divider,
                    color: palette.text,
                    backgroundColor: colorScheme === 'dark' ? palette.surfaceAlt : '#ffffff',
                  },
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.textMuted }]}>Tu nombre</Text>
              <TextInput
                value={guestName}
                onChangeText={setGuestName}
                placeholder="Cómo quieres que te vean"
                autoCapitalize="words"
                style={[
                  styles.input,
                  {
                    borderColor: palette.divider,
                    color: palette.text,
                    backgroundColor: colorScheme === 'dark' ? palette.surfaceAlt : '#ffffff',
                  },
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.textMuted }]}>Correo electrónico</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tucorreo@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                style={[
                  styles.input,
                  {
                    borderColor: palette.divider,
                    color: palette.text,
                    backgroundColor: colorScheme === 'dark' ? palette.surfaceAlt : '#ffffff',
                  },
                ]}
              />
            </View>
            {(localError || error) ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: palette.warning }]}>
                  {localError || error}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={handleClose}
                disabled={loading}
                style={styles.cancelButton}
              />
              <Button
                title={loading ? 'Validando...' : 'Ingresar como invitado'}
                onPress={handleSubmit}
                disabled={isSubmitDisabled}
                loading={loading}
              />
            </View>

            {loading ? (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="small" color={palette.primary} />
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 18, 0.55)',
  },
  modalContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    marginRight: 12,
  },
  loaderOverlay: {
    marginTop: 18,
    alignItems: 'center',
  },
});
