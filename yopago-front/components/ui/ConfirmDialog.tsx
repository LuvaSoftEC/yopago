import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Colors } from '@/constants/theme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  errorMessage?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  danger = false,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {
        if (!loading) {
          onCancel();
        }
      }}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          {description ? (
            <Text style={[styles.description, { color: palette.textMuted }]}>{description}</Text>
          ) : null}
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { 
                  borderColor: palette.divider,
                  backgroundColor: palette.background
                }
              ]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelText, { color: palette.text }]}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                danger && styles.confirmButtonDanger,
                loading && styles.confirmButtonDisabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  error: {
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  confirmButton: {
    backgroundColor: '#2563eb',
  },
  confirmButtonDanger: {
    backgroundColor: '#dc2626',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
