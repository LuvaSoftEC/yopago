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
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { guestService } from '@/services/guestService';
import { GuestCreateExpenseRequest, GuestMemberSummary } from '@/services/types';

type ExpenseSplitMode = 'group' | 'custom' | 'self';

interface GuestCreateExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  members: GuestMemberSummary[];
  currentMemberId: number | null;
}

const sanitizeAmount = (value: string) => {
  if (!value) {
    return 0;
  }
  const normalized = value.replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const GuestCreateExpenseModal: React.FC<GuestCreateExpenseModalProps> = ({
  visible,
  onClose,
  onCreated,
  members,
  currentMemberId,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [splitMode, setSplitMode] = useState<ExpenseSplitMode>('group');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(palette), [palette]);

  const allMemberIds = useMemo(
    () =>
      members
        .map((member) => member.id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
    [members],
  );

  const allowCustomSplit = members.length > 1;
  const canUseSelfMode = typeof currentMemberId === 'number' && Number.isFinite(currentMemberId);

  const resetState = useCallback(() => {
    setDescription('');
    setAmount('');
    setCategory('');
    setSplitMode('group');
    setSelectedMemberIds(allMemberIds);
    setError(null);
  }, [allMemberIds]);

  useEffect(() => {
    setSelectedMemberIds((prev) => {
      if (!prev.length) {
        return allMemberIds;
      }

      const filtered = prev.filter((id) => allMemberIds.includes(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [allMemberIds]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (splitMode === 'self') {
      if (canUseSelfMode && currentMemberId != null && allMemberIds.includes(currentMemberId)) {
        setSelectedMemberIds([currentMemberId]);
      } else {
        setSplitMode('group');
        setSelectedMemberIds(allMemberIds);
      }
      return;
    }

    if (splitMode === 'group') {
      setSelectedMemberIds(allMemberIds);
      return;
    }

    if (splitMode === 'custom' && selectedMemberIds.every((id) => !allMemberIds.includes(id))) {
      setSelectedMemberIds(allMemberIds);
    }
  }, [visible, splitMode, canUseSelfMode, currentMemberId, allMemberIds, selectedMemberIds]);

  useEffect(() => {
    if (!allowCustomSplit && splitMode === 'custom') {
      setSplitMode('group');
      setSelectedMemberIds(allMemberIds);
    }
  }, [allowCustomSplit, splitMode, allMemberIds]);

  const closeSafely = useCallback(() => {
    if (loading) {
      return;
    }
    resetState();
    onClose();
  }, [loading, onClose, resetState]);

  const handleSplitModeChange = useCallback(
    (mode: ExpenseSplitMode) => {
      if (mode === splitMode) {
        return;
      }

      if (mode === 'self') {
        if (!canUseSelfMode || currentMemberId == null) {
          Alert.alert('No disponible', 'No pudimos identificarte en el grupo para asignar el gasto solo a ti.');
          return;
        }
        setSelectedMemberIds([currentMemberId]);
      } else if (mode === 'group') {
        setSelectedMemberIds(allMemberIds);
      } else if (mode === 'custom' && selectedMemberIds.length === 0) {
        setSelectedMemberIds(allMemberIds);
      }

      setSplitMode(mode);
      setError(null);
    },
    [splitMode, canUseSelfMode, currentMemberId, allMemberIds, selectedMemberIds.length],
  );

  const toggleMemberSelection = useCallback(
    (memberId: number) => {
      setSelectedMemberIds((prev) => {
        const alreadySelected = prev.includes(memberId);
        if (alreadySelected) {
          if (prev.length === 1) {
            return prev;
          }
          return prev.filter((id) => id !== memberId);
        }

        const next = [...prev, memberId];
        return members
          .map((member) => member.id)
          .filter((id): id is number => typeof id === 'number' && next.includes(id));
      });
      setError(null);
    },
    [members],
  );

  const handleSubmit = async () => {
    const trimmedDescription = description.trim();
    const trimmedCategory = category.trim();
    const numericAmount = sanitizeAmount(amount);

    if (!trimmedDescription) {
      setError('Describe brevemente el gasto.');
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }

    let participantIds: number[] | undefined;

    if (splitMode === 'self') {
      if (!canUseSelfMode || currentMemberId == null) {
        setError('No pudimos confirmar tu identidad dentro del grupo.');
        return;
      }
      participantIds = [currentMemberId];
    } else if (splitMode === 'custom') {
      if (!selectedMemberIds.length) {
        setError('Selecciona al menos un miembro para dividir el gasto.');
        return;
      }
      participantIds = selectedMemberIds;
    }

    const payload: GuestCreateExpenseRequest = {
      description: trimmedDescription,
      amount: Number(numericAmount.toFixed(2)),
      category: trimmedCategory || undefined,
      ...(participantIds ? { participantMemberIds: participantIds } : {}),
      items:
        splitMode === 'self'
          ? [
              {
                description: trimmedDescription,
                amount: Number(numericAmount.toFixed(2)),
                quantity: 1,
                onlyForMe: true,
                participantMemberIds: participantIds,
              },
            ]
          : undefined,
    };

    try {
      setLoading(true);
      setError(null);
      const response = await guestService.createExpense(payload);
      Alert.alert('Gasto registrado', response.message || 'Se creó el gasto correctamente.');
      await Promise.resolve(onCreated());
      resetState();
      onClose();
    } catch (err: any) {
      const message = err?.message || 'No se pudo crear el gasto. Intenta nuevamente.';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

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
              <Text style={[styles.title, { color: palette.text }]}>Nuevo gasto</Text>
              <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                Este gasto quedará registrado en el grupo actual. Solo podrás acceder con el mismo nombre y correo.
              </Text>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Descripción</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ej: Compra del súper"
                  style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                />
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
                <Text style={[styles.label, { color: palette.textMuted }]}>Categoría (opcional)</Text>
                <TextInput
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Transporte, comida, etc."
                  style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.textMuted }]}>¿Cómo divides este gasto?</Text>
                <View style={styles.splitOptionsRow}>
                  {([
                    { value: 'group', label: 'Todo el grupo', enabled: true },
                    { value: 'custom', label: 'Elegir miembros', enabled: allowCustomSplit },
                    { value: 'self', label: 'Solo para mí', enabled: canUseSelfMode },
                  ] as const).map((option) => {
                    const isActive = splitMode === option.value;
                    const isDisabled = !option.enabled;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.splitOption,
                          {
                            borderColor: palette.divider,
                            backgroundColor: isActive ? palette.primary : palette.surface,
                          },
                          isDisabled && styles.splitOptionDisabled,
                        ]}
                        activeOpacity={0.85}
                        onPress={() => handleSplitModeChange(option.value)}
                        disabled={isDisabled}
                      >
                        <Text
                          style={[
                            styles.splitOptionLabel,
                            { color: isActive ? palette.surface : palette.text },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {splitMode === 'custom' ? (
                  <>
                    <Text style={[styles.helpText, { color: palette.textMuted }]}>
                      Toca para seleccionar a las personas que compartirán el gasto.
                    </Text>
                    <View style={styles.membersGrid}>
                      {members.map((member) => {
                        const memberId = member.id;
                        const selected = selectedMemberIds.includes(memberId);
                        const label = member.name || member.email || `Miembro #${memberId}`;
                        const isSelf = currentMemberId != null && memberId === currentMemberId;

                        return (
                          <TouchableOpacity
                            key={memberId}
                            style={[
                              styles.memberChip,
                              {
                                borderColor: palette.divider,
                                backgroundColor: selected ? palette.primary : palette.surface,
                              },
                            ]}
                            activeOpacity={0.85}
                            onPress={() => toggleMemberSelection(memberId)}
                          >
                            <Ionicons
                              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                              size={18}
                              color={selected ? palette.surface : palette.textMuted}
                              style={styles.memberChipIcon}
                            />
                            <Text
                              style={[
                                styles.memberChipLabel,
                                { color: selected ? palette.surface : palette.text },
                              ]}
                              numberOfLines={1}
                            >
                              {label}
                              {isSelf ? ' (tú)' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </View>

              {error ? <Text style={[styles.error, { color: palette.warning }]}>{error}</Text> : null}

              <View style={styles.actions}>
                <Button title="Cancelar" variant="ghost" onPress={closeSafely} disabled={loading} />
                <Button
                  title={loading ? 'Guardando...' : 'Registrar gasto'}
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
    splitOptionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 12,
    },
    splitOption: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      marginRight: 8,
      marginBottom: 8,
    },
    splitOptionDisabled: {
      opacity: 0.4,
    },
    splitOptionLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    helpText: {
      fontSize: 12,
      marginBottom: 6,
    },
    membersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    memberChip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
      marginBottom: 8,
    },
    memberChipIcon: {
      marginRight: 6,
    },
    memberChipLabel: {
      fontSize: 14,
      fontWeight: '600',
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

export default GuestCreateExpenseModal;
