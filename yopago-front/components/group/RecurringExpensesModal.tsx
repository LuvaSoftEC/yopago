import { Colors, type AppPalette } from '@/constants/theme';
import { PROPERTY_CATEGORIES } from '@/constants/propertyCategories';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRecurringExpenses, type RecurringTemplate } from '@/hooks/use-recurring-expenses';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { GroupMember } from '../../services/types';

interface RecurringExpensesModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
  groupMembers: GroupMember[];
}

export default function RecurringExpensesModal({
  visible,
  onClose,
  groupId,
  groupMembers,
}: RecurringExpensesModalProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);

  const { templates, addTemplate, removeTemplate } = useRecurringExpenses(groupId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [formNote, setFormNote] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTag, setFormTag] = useState(PROPERTY_CATEGORIES[0].id);
  const [formPayerId, setFormPayerId] = useState<number | null>(
    groupMembers[0]?.id ?? null,
  );
  const [formDay, setFormDay] = useState('1');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormNote('');
    setFormAmount('');
    setFormTag(PROPERTY_CATEGORIES[0].id);
    setFormPayerId(groupMembers[0]?.id ?? null);
    setFormDay('1');
    setShowAddForm(false);
  };

  const handleAdd = async () => {
    const note = formNote.trim();
    const amount = parseFloat(formAmount.replace(',', '.'));
    const day = parseInt(formDay, 10);

    if (!note) {
      Alert.alert(t('common.error'), t('groups.recurringErrRequired', { field: t('groups.recurringNote') }));
      return;
    }
    if (!isFinite(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('groups.recurringErrAmount'));
      return;
    }
    if (!formPayerId) {
      Alert.alert(t('common.error'), t('groups.recurringErrPayer'));
      return;
    }
    if (!isFinite(day) || day < 1 || day > 31) {
      Alert.alert(t('common.error'), t('groups.recurringErrDay'));
      return;
    }

    setSaving(true);
    try {
      await addTemplate({ note, amount, tag: formTag, payerId: formPayerId, dayOfMonth: day });
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (tmpl: RecurringTemplate) => {
    Alert.alert(
      t('groups.recurringDeleteTitle'),
      t('groups.recurringDeleteConfirm', { name: tmpl.note }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeTemplate(tmpl.id) },
      ],
    );
  };

  const categoryById = (id: string) => PROPERTY_CATEGORIES.find((c) => c.id === id);
  const memberById = (id: number) => groupMembers.find((m) => m.id === id);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('groups.recurringExpensesTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Template List */}
          {templates.length === 0 && !showAddForm ? (
            <Text style={styles.emptyText}>{t('groups.recurringExpensesEmpty')}</Text>
          ) : (
            templates.map((tmpl) => {
              const cat = categoryById(tmpl.tag);
              const payer = memberById(tmpl.payerId);
              return (
                <View key={tmpl.id} style={styles.card}>
                  <View style={styles.cardLeft}>
                    {cat && (
                      <View style={[styles.catDot, { backgroundColor: cat.color + '28', borderColor: cat.color }]}>
                        <Ionicons name={cat.icon} size={14} color={cat.color} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardNote}>{tmpl.note}</Text>
                      <Text style={styles.cardMeta}>
                        {cat?.label ?? tmpl.tag} · {t('groups.recurringDayLabel', { day: tmpl.dayOfMonth })} · {payer?.name ?? `#${tmpl.payerId}`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardAmount}>
                      {tmpl.amount.toLocaleString('es', { minimumFractionDigits: 0 })}
                    </Text>
                    <TouchableOpacity onPress={() => handleDelete(tmpl)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={palette.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Add Form */}
          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.addFormTitle}>{t('groups.recurringExpensesAdd')}</Text>

              <Text style={styles.fieldLabel}>{t('groups.recurringNote')}</Text>
              <TextInput
                style={styles.input}
                value={formNote}
                onChangeText={setFormNote}
                placeholder={t('groups.recurringNotePlaceholder')}
                placeholderTextColor={palette.textMuted}
                maxLength={60}
              />

              <Text style={styles.fieldLabel}>{t('groups.recurringAmount')}</Text>
              <TextInput
                style={styles.input}
                value={formAmount}
                onChangeText={setFormAmount}
                placeholder="0.00"
                placeholderTextColor={palette.textMuted}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>{t('groups.recurringCategory')}</Text>
              <View style={styles.chipRow}>
                {PROPERTY_CATEGORIES.map((cat) => {
                  const isSelected = formTag === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setFormTag(cat.id)}
                      style={[
                        styles.chip,
                        { borderColor: isSelected ? cat.color : palette.divider, backgroundColor: isSelected ? cat.color + '18' : palette.surfaceAlt },
                      ]}
                    >
                      <Ionicons name={cat.icon} size={13} color={isSelected ? cat.color : palette.textMuted} />
                      <Text style={[styles.chipLabel, { color: isSelected ? cat.color : palette.textMuted }]}>{cat.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>{t('groups.recurringPaidBy')}</Text>
              <View style={styles.chipRow}>
                {groupMembers.map((m) => {
                  const isSelected = formPayerId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setFormPayerId(m.id)}
                      style={[
                        styles.chip,
                        { borderColor: isSelected ? palette.primary : palette.divider, backgroundColor: isSelected ? palette.primary + '18' : palette.surfaceAlt },
                      ]}
                    >
                      <Text style={[styles.chipLabel, { color: isSelected ? palette.primary : palette.textMuted }]}>{m.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>{t('groups.recurringDay')}</Text>
              <TextInput
                style={[styles.input, { width: 80 }]}
                value={formDay}
                onChangeText={setFormDay}
                placeholder="1"
                placeholderTextColor={palette.textMuted}
                keyboardType="number-pad"
                maxLength={2}
              />

              <View style={styles.formButtons}>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={resetForm}>
                  <Text style={[styles.btnText, { color: palette.textMuted }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: palette.primary }]} onPress={handleAdd} disabled={saving}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>{saving ? t('common.loading') : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Add Button */}
        {!showAddForm && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: palette.primary }]}
              onPress={() => setShowAddForm(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>{t('groups.recurringExpensesAdd')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
    },
    scroll: {
      padding: 16,
      paddingBottom: 40,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
      marginTop: 40,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderRadius: palette.radius.md,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    catDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardNote: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    cardMeta: {
      fontSize: 12,
      color: palette.textMuted,
      marginTop: 2,
    },
    cardRight: {
      alignItems: 'flex-end',
      gap: 6,
    },
    cardAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: palette.primary,
    },
    addForm: {
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      gap: 8,
    },
    addFormTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 4,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.textMuted,
      marginTop: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.md,
      padding: 10,
      fontSize: 15,
      color: palette.text,
      backgroundColor: palette.surfaceAlt,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: palette.radius.pill,
      borderWidth: 1,
    },
    chipLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    formButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: palette.radius.md,
      alignItems: 'center',
    },
    btnPrimary: {},
    btnSecondary: {
      borderWidth: 1,
      borderColor: palette.divider,
    },
    btnText: {
      fontSize: 15,
      fontWeight: '600',
    },
    footer: {
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.divider,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: palette.radius.md,
    },
    addBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
