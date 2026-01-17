import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as ImagePicker from 'expo-image-picker';

export type PaymentMethod = 'transfer' | 'cash' | 'other';

export type PaymentAttachment = {
  uri: string;
  base64?: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
};

export type PaymentFormSubmission = {
  amount: number;
  note: string;
  paymentMethod: PaymentMethod;
  attachment?: PaymentAttachment | null;
};

interface RecordPaymentModalProps {
  visible: boolean;
  amountSuggested: number;
  payerName: string;
  initialPaymentMethod?: PaymentMethod;
  initialNote?: string;
  onClose: () => void;
  onSubmit: (payload: PaymentFormSubmission) => Promise<void>;
}

const applyAlpha = (hexColor: string, alpha: number) => {
  const sanitized = hexColor.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  visible,
  amountSuggested,
  payerName,
  initialPaymentMethod,
  initialNote,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [attachment, setAttachment] = useState<PaymentAttachment | null>(null);

  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const placeholderColor = applyAlpha(palette.textMuted, 0.55);

  const paymentMethodOptions: Array<{ key: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }> = useMemo(
    () => [
      { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
      { key: 'cash', label: 'Efectivo', icon: 'cash-outline' },
      { key: 'other', label: 'Otro', icon: 'card-outline' },
    ],
    []
  );

  useEffect(() => {
    if (visible) {
      setAmount(amountSuggested > 0 ? amountSuggested.toFixed(2) : '');
      setNote(initialNote ?? '');
      setPaymentMethod(initialPaymentMethod ?? 'transfer');
      setAttachment(null);
      setIsSubmitting(false);
    }
  }, [visible, amountSuggested, initialPaymentMethod, initialNote]);

  const pickAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.7,
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          base64: asset.base64 ?? undefined,
          mimeType: asset.mimeType ?? undefined,
          fileName: asset.fileName ?? undefined,
          size: asset.fileSize ?? undefined,
        });
      }
    } catch (error) {
      console.error('❌ Error seleccionando comprobante:', error);
      Alert.alert('No se pudo abrir la galería', 'Intenta nuevamente o adjunta el comprobante manualmente.');
    }
  };

  const handleSubmit = async () => {
    const sanitized = amount.replace(/,/g, '.');
    const value = parseFloat(sanitized);

    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a cero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        amount: Number(value.toFixed(2)),
        note: note.trim(),
        paymentMethod,
        attachment,
      });
      onClose();
    } catch (error) {
      console.error('❌ Error registrando pago:', error);
      Alert.alert('Error', 'No se pudo registrar el pago. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Registrar pago</Text>
            <TouchableOpacity
              onPress={() => {
                if (!isSubmitting) {
                  onClose();
                }
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Vas a enviar un pago a {payerName}.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Método de pago</Text>
              <View style={styles.methodRow}>
                {paymentMethodOptions.map((option) => {
                  const isActive = paymentMethod === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.methodChip, isActive && styles.methodChipActive]}
                      onPress={() => setPaymentMethod(option.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={16}
                        color={isActive ? palette.primary : palette.textMuted}
                        style={styles.methodIcon}
                      />
                      <Text style={[styles.methodLabel, isActive && styles.methodLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monto a pagar</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={(text) => setAmount(text.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={placeholderColor}
              />
              <Text style={styles.helperText}>
                Sugerido: ${amountSuggested.toFixed(2)}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nota (opcional)</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Ej: Pago de mi parte del almuerzo"
                placeholderTextColor={placeholderColor}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Comprobante (opcional)</Text>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={pickAttachment}
                disabled={isSubmitting}
              >
                <Ionicons name="attach-outline" size={16} color={palette.primary} style={styles.attachmentIcon} />
                <Text style={styles.attachmentButtonText}>
                  {attachment ? 'Cambiar comprobante' : 'Adjuntar imagen'}
                </Text>
              </TouchableOpacity>

              {attachment ? (
                <View style={styles.attachmentPreview}>
                  {attachment.uri ? (
                    <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                  ) : null}
                  <View style={styles.attachmentInfo}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {attachment.fileName ?? 'comprobante.jpg'}
                    </Text>
                    <Text style={styles.attachmentMeta}>
                      {paymentMethod === 'cash' ? 'Confirmación de pago en efectivo' : 'Soporte de transferencia'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAttachment(null)}
                    style={styles.attachmentRemove}
                    accessibilityLabel="Eliminar comprobante"
                  >
                    <Ionicons name="close" size={16} color={palette.text} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.helperText}>
                  Adjunta una foto del comprobante o deja que el receptor confirme manualmente.
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={palette.surface} />
            ) : (
              <Text style={styles.submitButtonText}>Registrar pago</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: applyAlpha(palette.text, 0.45),
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: palette.radius.lg,
      borderTopRightRadius: palette.radius.lg,
      padding: palette.spacing.md,
      paddingBottom: palette.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: palette.font.h2,
      fontWeight: '700',
      color: palette.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: applyAlpha(palette.textMuted, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      marginTop: palette.spacing.md,
    },
    subtitle: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginBottom: palette.spacing.md,
    },
    inputGroup: {
      marginBottom: palette.spacing.md,
    },
    label: {
      fontSize: palette.font.small,
      fontWeight: '600',
      color: palette.text,
      marginBottom: palette.spacing.xs,
    },
    methodRow: {
      flexDirection: 'row',
      columnGap: palette.spacing.xs,
      flexWrap: 'wrap',
    },
    methodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: palette.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      backgroundColor: palette.surfaceAlt,
    },
    methodChipActive: {
      backgroundColor: applyAlpha(palette.primary, 0.15),
      borderColor: applyAlpha(palette.primary, 0.4),
    },
    methodIcon: {
      marginRight: palette.spacing.xs,
    },
    methodLabel: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      fontWeight: '600',
    },
    methodLabelActive: {
      color: palette.primary,
    },
    input: {
      borderRadius: palette.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceAlt,
      paddingHorizontal: palette.spacing.sm + 2,
      paddingVertical: palette.spacing.sm,
      fontSize: 16,
      color: palette.text,
    },
    noteInput: {
      minHeight: 90,
      textAlignVertical: 'top',
    },
    helperText: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginTop: palette.spacing.xs,
    },
    attachmentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.sm,
      borderRadius: palette.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.primary, 0.3),
      backgroundColor: applyAlpha(palette.primary, 0.12),
      marginBottom: palette.spacing.xs,
    },
    attachmentIcon: {
      marginRight: palette.spacing.xs,
    },
    attachmentButtonText: {
      color: palette.primary,
      fontWeight: '600',
    },
    attachmentPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: palette.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.text, 0.08),
      backgroundColor: palette.surfaceAlt,
      padding: palette.spacing.xs,
      columnGap: palette.spacing.sm,
    },
    attachmentImage: {
      width: 48,
      height: 48,
      borderRadius: palette.radius.sm,
      backgroundColor: applyAlpha(palette.text, 0.08),
    },
    attachmentInfo: {
      flex: 1,
      rowGap: 2,
    },
    attachmentName: {
      fontSize: palette.font.small,
      fontWeight: '600',
      color: palette.text,
    },
    attachmentMeta: {
      fontSize: 12,
      color: palette.textMuted,
    },
    attachmentRemove: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: applyAlpha(palette.text, 0.08),
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButton: {
      marginTop: palette.spacing.xs,
      backgroundColor: palette.primary,
      borderRadius: palette.radius.md,
      paddingVertical: palette.spacing.sm,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: palette.surface,
      fontSize: palette.font.body,
      fontWeight: '600',
    },
  });
}

export default RecordPaymentModal;
