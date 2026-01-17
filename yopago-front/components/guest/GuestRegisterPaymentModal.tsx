import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { guestService } from '@/services/guestService';
import { GuestMemberSummary } from '@/services/types';

interface GuestRegisterPaymentModalProps {
  visible: boolean;
  members: GuestMemberSummary[];
  currentMemberId: number | null;
  onClose: () => void;
  onRegistered: () => Promise<void> | void;
}

const sanitizeAmount = (value: string) => {
  if (!value) {
    return 0;
  }
  const normalized = value.replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const GuestRegisterPaymentModal: React.FC<GuestRegisterPaymentModalProps> = ({
  visible,
  members,
  currentMemberId,
  onClose,
  onRegistered,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const recipientOptions = useMemo(() => {
    return members.filter((member) => member.id !== currentMemberId);
  }, [members, currentMemberId]);

  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    if (!visible) {
      setSelectedMemberId(null);
      setAmount('');
      setNote('');
      setError(null);
      return;
    }

    if (recipientOptions.length > 0) {
      setSelectedMemberId(recipientOptions[0].id);
    }
  }, [visible, recipientOptions]);

  const closeSafely = () => {
    if (loading) {
      return;
    }
    setSelectedMemberId(null);
    setAmount('');
    setNote('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      setError('Selecciona a quién le estás pagando.');
      return;
    }

    const numericAmount = sanitizeAmount(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await guestService.registerPayment({
        toMemberId: selectedMemberId,
        amount: Number(numericAmount.toFixed(2)),
        note: note.trim() || undefined,
      });
      Alert.alert('Pago registrado', response.message || 'Se registró el pago correctamente.');
      await Promise.resolve(onRegistered());
      closeSafely();
    } catch (err: any) {
      const message = err?.message || 'No se pudo registrar el pago.';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const activeRecipient = recipientOptions.find((member) => member.id === selectedMemberId) || null;

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={closeSafely}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={[styles.title, { color: palette.text }]}>Registrar pago</Text>
              <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                Este pago quedará pendiente hasta que el destinatario lo confirme.
              </Text>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Destinatario</Text>
                {recipientOptions.length === 0 ? (
                  <Text style={[styles.empty, { color: palette.textMuted }]}>
                    No hay otros miembros disponibles para registrar pagos.
                  </Text>
                ) : (
                  <View style={styles.recipientList}>
                    {recipientOptions.map((member) => {
                      const isActive = member.id === selectedMemberId;
                      return (
                        <TouchableOpacity
                          key={member.id}
                          onPress={() => setSelectedMemberId(member.id)}
                          style={[
                            styles.recipientItem,
                            isActive && { borderColor: palette.primary, backgroundColor: palette.surfaceAlt },
                          ]}
                        >
                          <Text
                            style={[styles.recipientName, { color: isActive ? palette.primary : palette.text }]}
                          >
                            {member.name || member.email || `Miembro #${member.id}`}
                          </Text>
                          {member.email ? (
                            <Text style={[styles.recipientEmail, { color: palette.textMuted }]}>{member.email}</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Monto</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Nota (opcional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ej: Transferencia bancaria"
                  multiline
                  style={[styles.input, styles.noteInput, { borderColor: palette.divider, color: palette.text }]}
                />
              </View>

              {activeRecipient ? (
                <Text style={[styles.helper, { color: palette.textMuted }]}>
                  Registrarás un pago hacia {activeRecipient.name || 'este miembro'}.
                </Text>
              ) : null}

              {error ? <Text style={[styles.error, { color: palette.warning }]}>{error}</Text> : null}

              <View style={styles.actions}>
                <Button title="Cancelar" variant="ghost" onPress={closeSafely} disabled={loading} />
                <Button
                  title={loading ? 'Enviando...' : 'Registrar pago'}
                  onPress={handleSubmit}
                  disabled={recipientOptions.length === 0}
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
    field: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
    },
    empty: {
      fontSize: 14,
      fontStyle: 'italic',
    },
    recipientList: {
      gap: 8,
    },
    recipientItem: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    recipientName: {
      fontSize: 16,
      fontWeight: '600',
    },
    recipientEmail: {
      fontSize: 13,
      marginTop: 4,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
    },
    noteInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    helper: {
      fontSize: 13,
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

export default GuestRegisterPaymentModal;
