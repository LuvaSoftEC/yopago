import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Image,
  Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { CreateExpenseRequest, ExpenseItemInput, ExpenseShare } from '../../services/authenticatedApiService';
import { GroupMember } from '../../services/types';

interface PrefilledExpenseItem {
  description: string;
  amount: number;
  quantity: number;
  selectedMembers: number[];
}

interface PrefilledExpenseData {
  note?: string;
  tag?: string;
  payerId?: number;
  amount?: number;
  items?: PrefilledExpenseItem[];
}

interface CreateExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateExpense: (expense: CreateExpenseRequest) => Promise<void>;
  groupMembers: GroupMember[];
  groupId: number;
  currentUserId: number;
  initialData?: PrefilledExpenseData;
  receiptPreviewUri?: string;
  receiptPreviewName?: string;
  receiptPreviewKind?: 'image' | 'pdf' | 'other';
}

interface ExpenseItemForm {
  id: string;
  description: string;
  amount: string;
  quantity: string;
  selectedMembers: number[];
}

type FieldName = 'note' | 'amount' | 'tag';
type FormErrors = Partial<Record<FieldName | 'items' | 'shares', string>>;

const MIN_DESCRIPTION = 4;
const MAX_DESCRIPTION = 120;
const MIN_CATEGORY = 3;
const MAX_AMOUNT = 1000000;

const applyAlpha = (hexColor: string, alpha: number) => {
  const sanitized = hexColor.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function CreateExpenseModal({
  visible,
  onClose,
  onCreateExpense,
  groupMembers,
  groupId,
  currentUserId,
  initialData,
  receiptPreviewUri,
  receiptPreviewName,
  receiptPreviewKind,
}: CreateExpenseModalProps) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [tag, setTag] = useState('');
  const [payerId, setPayerId] = useState<number>(currentUserId);
  const [isCustomDivision, setIsCustomDivision] = useState(false);
  const [memberPercentages, setMemberPercentages] = useState<{ [key: number]: string }>({});
  const [useItems, setUseItems] = useState(false);
  const [items, setItems] = useState<ExpenseItemForm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitializedFromDraft, setHasInitializedFromDraft] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldName, boolean>>>({});

  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const styles = React.useMemo(() => createStyles(palette), [palette]);
  const placeholderColor = applyAlpha(palette.textMuted, 0.55);
  const helperTextColor = applyAlpha(palette.textMuted, 0.8);
  const switchTrackOff = applyAlpha(palette.textMuted, 0.35);
  const switchTrackOn = applyAlpha(palette.primary, 0.35);
  const inlineErrorColor = palette.accent;

  const handleOpenReceiptAttachment = React.useCallback(() => {
    if (!receiptPreviewUri) {
      return;
    }

    Linking.openURL(receiptPreviewUri).catch(() => {
      Alert.alert('Error', 'No se pudo abrir el archivo adjunto.');
    });
  }, [receiptPreviewUri]);

  const allMemberIds = React.useMemo(() => groupMembers.map(member => member.id), [groupMembers]);

  const createEmptyItem = React.useCallback((): ExpenseItemForm => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    amount: '',
    quantity: '1',
    selectedMembers: [],
  }), []);

  const itemsTotalValue = React.useMemo(() => {
    return items.reduce((sum, item) => {
      const parsedAmount = parseFloat(item.amount);
      return sum + (Number.isFinite(parsedAmount) ? parsedAmount : 0);
    }, 0);
  }, [items]);

  const hasPendingAssignments = React.useMemo(
    () => useItems && items.some((item) => item.selectedMembers.length === 0),
    [items, useItems],
  );

  React.useEffect(() => {
    if (!visible) {
      setHasInitializedFromDraft(false);
      setNote('');
      setAmount('');
      setTag('');
      setPayerId(currentUserId);
      setIsCustomDivision(false);
      setMemberPercentages({});
      setUseItems(false);
      setItems([]);
      setFieldErrors({});
      setTouchedFields({});
      return;
    }

    if (!initialData || hasInitializedFromDraft) {
      return;
    }

    setHasInitializedFromDraft(true);

    setNote(initialData.note?.trim() ?? '');
    setTag(initialData.tag?.trim() ?? '');
    setPayerId(initialData.payerId ?? currentUserId);

    if (typeof initialData.amount === 'number' && Number.isFinite(initialData.amount)) {
      setAmount(initialData.amount.toFixed(2));
    } else {
      setAmount('');
    }

    const prefilledItems = Array.isArray(initialData.items)
      ? initialData.items.filter((candidate): candidate is PrefilledExpenseItem => !!candidate)
      : [];
    if (prefilledItems.length > 0) {
      setUseItems(true);
      const mappedItems: ExpenseItemForm[] = prefilledItems.map((item, index) => {
        const safeAmount = Number.isFinite(item.amount) ? Number(item.amount) : 0;
        const safeQuantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
        const cleanedMembers = Array.isArray(item.selectedMembers)
          ? item.selectedMembers.filter((memberId) => allMemberIds.includes(memberId))
          : [];

        return {
          id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          description: item.description?.trim() || `Item ${index + 1}`,
          amount: safeAmount > 0 ? safeAmount.toFixed(2) : '',
          quantity: String(safeQuantity),
          selectedMembers: cleanedMembers,
        };
      });

      setItems(mappedItems);
      setIsCustomDivision(false);
      setMemberPercentages({});
    } else {
      setUseItems(false);
      setItems([]);
    }
  }, [allMemberIds, currentUserId, hasInitializedFromDraft, initialData, visible]);

  React.useEffect(() => {
    if (isCustomDivision) {
      // Inicializar porcentajes en 0 para todos los miembros
      const initialPercentages: { [key: number]: string } = {};
      groupMembers.forEach(member => {
        initialPercentages[member.id] = '0';
      });
      setMemberPercentages(initialPercentages);
    }
  }, [isCustomDivision, groupMembers]);

  React.useEffect(() => {
    setItems(prev => prev.map(item => {
      const filteredMembers = item.selectedMembers.filter(memberId => allMemberIds.includes(memberId));
      return {
        ...item,
        selectedMembers: filteredMembers,
      };
    }));
  }, [allMemberIds]);

  React.useEffect(() => {
    if (useItems) {
      const formattedTotal = itemsTotalValue > 0 ? itemsTotalValue.toFixed(2) : '';
      if (formattedTotal !== amount) {
        setAmount(formattedTotal);
      }
    }
  }, [useItems, itemsTotalValue, amount]);

  const validateField = React.useCallback((field: FieldName, value?: string) => {
    const payload = value ?? (field === 'note' ? note : field === 'amount' ? amount : tag);
    const trimmed = payload.trim();

    switch (field) {
      case 'note':
        if (!trimmed) return 'Añade una descripción corta del gasto.';
        if (trimmed.length < MIN_DESCRIPTION) return 'Usa al menos 4 caracteres para que sea claro.';
        if (trimmed.length > MAX_DESCRIPTION) return 'Mantén la descripción debajo de 120 caracteres.';
        return null;
      case 'tag':
        if (!trimmed) return 'Define una categoría para clasificar el gasto.';
        if (trimmed.length < MIN_CATEGORY) return 'La categoría debe tener mínimo 3 caracteres.';
        return null;
      case 'amount':
        if (useItems) return null;
        if (!trimmed) return 'Ingresa el monto total del gasto.';
        const normalized = trimmed.replace(',', '.');
        const parsed = parseFloat(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) return 'El monto debe ser mayor a 0.';
        if (parsed > MAX_AMOUNT) return 'Ese monto es demasiado grande. Intenta dividirlo.';
        const decimals = normalized.split('.')[1];
        if (decimals && decimals.length > 2) return 'Usa máximo dos decimales.';
        return null;
      default:
        return null;
    }
  }, [amount, note, tag, useItems]);

  const runFieldValidation = React.useCallback((field: FieldName, value?: string) => {
    const error = validateField(field, value);
    setFieldErrors(prev => {
      const updated = { ...prev };
      if (error) {
        updated[field] = error;
      } else {
        delete updated[field];
      }
      return updated;
    });
    return error;
  }, [validateField]);

  const validateForm = React.useCallback(() => {
    const errors: FormErrors = {};

    (['note', 'tag'] as FieldName[]).forEach(field => {
      const error = validateField(field);
      if (error) {
        errors[field] = error;
      }
    });

    if (!useItems) {
      const amountError = validateField('amount');
      if (amountError) {
        errors.amount = amountError;
      }
    } else if (itemsTotalValue <= 0) {
      errors.items = 'Agrega al menos un item con monto mayor a 0.';
    }

    if (!useItems && isCustomDivision) {
      const totalPercent = Object.values(memberPercentages).reduce((sum, percentage) => {
        const parsed = parseFloat(percentage);
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0);
      const hasPositiveShare = Object.values(memberPercentages).some(percentage => {
        const parsed = parseFloat(percentage);
        return Number.isFinite(parsed) && parsed > 0;
      });

      if (!hasPositiveShare) {
        errors.shares = 'Asigna porcentaje a al menos un miembro.';
      } else if (Math.abs(totalPercent - 100) > 0.1) {
        errors.shares = `Los porcentajes suman ${totalPercent.toFixed(2)}%. Ajusta para llegar a 100%.`;
      }
    }

    return errors;
  }, [isCustomDivision, itemsTotalValue, memberPercentages, useItems, validateField]);

  const handleNoteChange = (value: string) => {
    setNote(value);
    if (touchedFields.note) {
      runFieldValidation('note', value);
    }
  };

  const handleAmountChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.,]/g, '');
    setAmount(sanitized);
    if (touchedFields.amount) {
      runFieldValidation('amount', sanitized);
    }
  };

  const handleTagChange = (value: string) => {
    setTag(value);
    if (touchedFields.tag) {
      runFieldValidation('tag', value);
    }
  };

  const touchField = (field: FieldName) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    runFieldValidation(field);
  };

  const clearError = React.useCallback((field: keyof FormErrors) => {
    setFieldErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  React.useEffect(() => {
    if (useItems) {
      setIsCustomDivision(false);
      setMemberPercentages({});
      setItems(prev => (prev.length === 0 ? [createEmptyItem()] : prev));
      clearError('amount');
      setTouchedFields(prev => ({ ...prev, amount: false }));
    } else {
      setItems([]);
      clearError('items');
    }
  }, [useItems, createEmptyItem, clearError]);

  React.useEffect(() => {
    if (!isCustomDivision || useItems) {
      clearError('shares');
    }
  }, [isCustomDivision, useItems, clearError]);

  const showFieldError = React.useCallback((field: FieldName) => Boolean(touchedFields[field] && fieldErrors[field]), [fieldErrors, touchedFields]);
  const getFieldError = React.useCallback((field: FieldName) => (touchedFields[field] ? fieldErrors[field] : undefined), [fieldErrors, touchedFields]);

  const validationPills = React.useMemo(() => {
    const descriptionOk = !validateField('note');
    const amountValue = useItems ? itemsTotalValue : parseFloat(amount.replace(',', '.'));
    const amountOk = useItems ? itemsTotalValue > 0 : Number.isFinite(amountValue) && amountValue > 0;
    const tagOk = !validateField('tag');
    const sharesOk = useItems || !isCustomDivision || (!validateForm().shares && Object.keys(memberPercentages).length > 0);

    return [
      { id: 'note', label: 'Descripción clara', valid: descriptionOk },
      { id: 'amount', label: useItems ? 'Total desde items' : 'Monto positivo', valid: amountOk },
      { id: 'tag', label: 'Categoría definida', valid: tagOk },
      { id: 'shares', label: 'División equilibrada', valid: sharesOk },
    ];
  }, [amount, isCustomDivision, itemsTotalValue, memberPercentages, useItems, validateField, validateForm]);

  const handleAddItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleUpdateItemField = (itemId: string, field: 'description' | 'amount' | 'quantity', value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) {
        return item;
      }
      return {
        ...item,
        [field]: field === 'quantity' ? value.replace(/[^0-9]/g, '') : value,
      };
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => (prev.length <= 1 ? prev : prev.filter(item => item.id !== itemId)));
  };

  const handleToggleItemMember = (itemId: string, memberId: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) {
        return item;
      }

      const isSelected = item.selectedMembers.includes(memberId);
      if (isSelected) {
        if (item.selectedMembers.length === 1) {
          return item; // evitar dejar sin miembros
        }
        return {
          ...item,
          selectedMembers: item.selectedMembers.filter(id => id !== memberId),
        };
      }

      return {
        ...item,
        selectedMembers: [...item.selectedMembers, memberId],
      };
    }));
  };

  const handleSubmit = async () => {
    const validation = validateForm();
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      setTouchedFields(prev => ({
        ...prev,
        note: true,
        tag: true,
        ...(useItems ? {} : { amount: true }),
      }));
      return;
    }

    setFieldErrors({});

    const parsedAmount = parseFloat((amount || '0').replace(',', '.'));

    let shares: ExpenseShare[] | undefined = undefined;
    let itemsPayload: ExpenseItemInput[] | undefined = undefined;

    if (!useItems && isCustomDivision) {
      const shareEntries = Object.entries(memberPercentages).map(([memberId, percentage]) => {
        const value = parseFloat(percentage);
        const safePercent = Number.isFinite(value) ? value : 0;
        return {
          memberId: parseInt(memberId, 10),
          percent: safePercent,
          scaled: Math.round(safePercent * 100),
        };
      });

      const nonZeroEntries = shareEntries.filter(entry => entry.percent > 0);
      if (nonZeroEntries.length === 0) {
        setFieldErrors(prev => ({ ...prev, shares: 'Asigna porcentaje a al menos un miembro.' }));
        return;
      }

      const totalScaled = nonZeroEntries.reduce((sum, entry) => sum + entry.scaled, 0);
      const diff = 10000 - totalScaled;

      if (Math.abs(diff) > 1) {
        const totalPercent = (totalScaled / 100).toFixed(2);
        setFieldErrors(prev => ({ ...prev, shares: `Los porcentajes deben sumar 100%. Actualmente suman ${totalPercent}%` }));
        return;
      }

      if (diff !== 0) {
        const preferredIndex = nonZeroEntries.findIndex(entry => entry.memberId === payerId);
        const fallbackIndex = diff > 0
          ? (preferredIndex >= 0 ? preferredIndex : 0)
          : (preferredIndex >= 0 && nonZeroEntries[preferredIndex].scaled + diff > 0
              ? preferredIndex
              : nonZeroEntries.findIndex(entry => entry.scaled + diff > 0));
        const safeIndex = fallbackIndex >= 0 ? fallbackIndex : 0;
        nonZeroEntries[safeIndex].scaled += diff;
        nonZeroEntries[safeIndex].percent = nonZeroEntries[safeIndex].scaled / 100;
      }

      shares = nonZeroEntries.map(entry => ({
        memberId: entry.memberId,
        percentage: Number((entry.scaled / 100).toFixed(2)),
      }));
      clearError('shares');
    }

    let normalizedAmount = useItems ? Number(itemsTotalValue.toFixed(2)) : parsedAmount;

    if (useItems) {
      if (items.length === 0) {
        setFieldErrors(prev => ({ ...prev, items: 'Agrega al menos un item para registrar el gasto.' }));
        return;
      }

      const normalizedItems: ExpenseItemInput[] = [];
      let computedTotal = 0;
      let itemIssue: string | null = null;

      for (const item of items) {
        const description = item.description.trim();
        const amountValue = parseFloat(item.amount);
        const quantityValue = parseInt(item.quantity, 10);

        if (!description) {
          itemIssue = 'Cada item necesita una descripción.';
          break;
        }

        if (!Number.isFinite(amountValue) || amountValue <= 0) {
          itemIssue = `El item "${description || 'sin nombre'}" debe tener un monto válido.`;
          break;
        }

        if (!item.selectedMembers || item.selectedMembers.length === 0) {
          itemIssue = `Selecciona al menos un miembro para el item "${description || 'sin nombre'}".`;
          break;
        }

        const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
        computedTotal += amountValue;

        normalizedItems.push({
          description,
          amount: Number(amountValue.toFixed(2)),
          quantity,
          itemShares: item.selectedMembers.map(memberId => ({
            memberId,
            shareType: 'SHARED',
          })),
        });
      }

      if (itemIssue) {
        setFieldErrors(prev => ({ ...prev, items: itemIssue }));
        return;
      }

      normalizedAmount = Number(computedTotal.toFixed(2));

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        setFieldErrors(prev => ({ ...prev, items: 'El total de los items debe ser mayor a 0.' }));
        return;
      }

      clearError('items');

      itemsPayload = normalizedItems;
      shares = undefined; // las shares se calculan en el backend a partir de los items
    }

    try {
      setIsLoading(true);
      
      const expenseRequest: CreateExpenseRequest = {
        note: note.trim(),
        amount: normalizedAmount,
        tag: tag.trim(),
        payerId,
        groupId,
        ...(shares && { shares }),
        ...(itemsPayload && { items: itemsPayload }),
      };

      await onCreateExpense(expenseRequest);
      
      // Limpiar formulario
      setNote('');
      setTag('');
      setPayerId(currentUserId);
      setIsCustomDivision(false);
      setMemberPercentages({});
      setUseItems(false);
      setItems([]);
      setAmount('');
  setFieldErrors({});
  setTouchedFields({});
      
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo crear el gasto. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePercentage = (memberId: number, percentage: string) => {
    // Solo permitir números y punto decimal
    const cleanPercentage = percentage.replace(/[^0-9.]/g, '');
    setMemberPercentages(prev => ({
      ...prev,
      [memberId]: cleanPercentage,
    }));
  };

  const getTotalPercentage = () => {
    const totalScaled = Object.values(memberPercentages)
      .reduce((sum, p) => {
        const value = parseFloat(p);
        return sum + Math.round((Number.isFinite(value) ? value : 0) * 100);
      }, 0);

    if (Math.abs(totalScaled - 10000) <= 1) {
      return '100.00';
    }

    return (totalScaled / 100).toFixed(2);
  };

  const distributeEqually = () => {
    if (groupMembers.length === 0) {
      return;
    }

    const baseShare = Math.floor(10000 / groupMembers.length);
    let remainder = 10000 - baseShare * groupMembers.length;

    const newPercentages: { [key: number]: string } = {};
    groupMembers.forEach(member => {
      newPercentages[member.id] = (baseShare / 100).toFixed(2);
    });

    if (remainder > 0) {
      const payerMember = groupMembers.find(member => member.id === payerId) ?? groupMembers[0];
      const currentValue = parseFloat(newPercentages[payerMember.id] ?? '0') * 100;
      const updatedValue = currentValue + remainder;
      newPercentages[payerMember.id] = (updatedValue / 100).toFixed(2);
      remainder = 0;
    }

    setMemberPercentages(newPercentages);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={palette.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Nuevo Gasto</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? 'Creando...' : 'Crear'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Información básica */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información del Gasto</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.validationPills}
            >
              {validationPills.map(pill => (
                <View
                  key={pill.id}
                  style={[styles.validationPill, pill.valid ? styles.validationPillOk : styles.validationPillPending]}
                >
                  <Ionicons
                    name={pill.valid ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={pill.valid ? palette.primary : helperTextColor}
                    style={styles.validationPillIcon}
                  />
                  <Text
                    style={[styles.validationPillText, { color: pill.valid ? palette.primary : helperTextColor }]}
                  >
                    {pill.label}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {receiptPreviewUri && (receiptPreviewKind === undefined || receiptPreviewKind === 'image') ? (
              <View style={styles.previewContainer}>
                <Text style={styles.label}>Vista previa de la factura</Text>
                <Image
                  source={{ uri: receiptPreviewUri }}
                  style={styles.receiptPreview}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {receiptPreviewKind && receiptPreviewKind !== 'image' ? (
              <View style={styles.previewContainer}>
                <Text style={styles.label}>Archivo adjunto</Text>
                <TouchableOpacity
                  style={styles.attachmentPreview}
                  activeOpacity={receiptPreviewUri ? 0.8 : 1}
                  onPress={handleOpenReceiptAttachment}
                  disabled={!receiptPreviewUri}
                >
                  <View style={styles.attachmentIconWrapper}>
                    <Ionicons
                      name={receiptPreviewKind === 'pdf' ? 'document-text-outline' : 'document-attach-outline'}
                      size={24}
                      color={palette.primary}
                    />
                  </View>
                  <View style={styles.attachmentInfo}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {receiptPreviewName || 'Archivo adjunto'}
                    </Text>
                    <Text style={styles.attachmentHint} numberOfLines={1}>
                      {receiptPreviewUri ? 'Toca para abrir' : 'Adjunto disponible'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descripción *</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={handleNoteChange}
                placeholder="¿En qué se gastó?"
                placeholderTextColor={placeholderColor}
                onBlur={() => touchField('note')}
              />
              <Text style={[styles.helperText, { color: helperTextColor }]}>Sé específico para que todos lo recuerden.</Text>
              {showFieldError('note') && (
                <Text style={[styles.inlineError, { color: inlineErrorColor }]}>{getFieldError('note')}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monto *</Text>
              <TextInput
                style={[styles.input, useItems && styles.inputDisabled]}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor={placeholderColor}
                keyboardType="numeric"
                editable={!useItems}
                onBlur={() => touchField('amount')}
              />
              <Text style={[styles.helperText, { color: helperTextColor }]}>
                {useItems
                  ? 'El total se ajusta automáticamente con los items.'
                  : 'Puedes ingresar decimales (máximo dos).'}
              </Text>
              {!useItems && showFieldError('amount') && (
                <Text style={[styles.inlineError, { color: inlineErrorColor }]}>{getFieldError('amount')}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Categoría *</Text>
              <TextInput
                style={styles.input}
                value={tag}
                onChangeText={handleTagChange}
                placeholder="Ej: Comida, Transporte, etc."
                placeholderTextColor={placeholderColor}
                onBlur={() => touchField('tag')}
              />
              <Text style={[styles.helperText, { color: helperTextColor }]}>Agrupa gastos similares para analizarlos después.</Text>
              {showFieldError('tag') && (
                <Text style={[styles.inlineError, { color: inlineErrorColor }]}>{getFieldError('tag')}</Text>
              )}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.label}>Detalle por items</Text>
              <Switch
                value={useItems}
                onValueChange={setUseItems}
                trackColor={{ false: switchTrackOff, true: switchTrackOn }}
                thumbColor={useItems ? palette.primary : palette.surface}
              />
            </View>

            {useItems && (
              <Text style={styles.helperText}>
                El total se calculará automáticamente sumando los items.
              </Text>
            )}
            {fieldErrors.items && (
              <Text style={[styles.inlineError, { color: inlineErrorColor }]}>{fieldErrors.items}</Text>
            )}
          </View>

          {useItems && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalles del gasto</Text>

              {hasPendingAssignments && (
                <Text style={styles.pendingAssignmentsNotice}>
                  Asigna quién participa en cada item tocando los nombres.
                </Text>
              )}

              {items.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>Item</Text>
                    {items.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(item.id)}
                        style={styles.itemRemoveButton}
                      >
                        <Ionicons name="trash" size={18} color={palette.accent} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.itemRow}>
                    <View style={[styles.itemField, styles.itemFieldLarge]}>
                      <Text style={styles.itemLabel}>Descripción</Text>
                      <TextInput
                        style={styles.itemInput}
                        value={item.description}
                        onChangeText={(text) => handleUpdateItemField(item.id, 'description', text)}
                        placeholder="Ej: Pizza grande"
                        placeholderTextColor={placeholderColor}
                      />
                    </View>
                  </View>

                  <View style={styles.itemRow}>
                    <View style={styles.itemField}>
                      <Text style={styles.itemLabel}>Monto</Text>
                      <TextInput
                        style={styles.itemInput}
                        value={item.amount}
                        onChangeText={(text) => handleUpdateItemField(item.id, 'amount', text.replace(/[^0-9.]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={placeholderColor}
                      />
                    </View>

                    <View style={styles.itemFieldSmall}>
                      <Text style={styles.itemLabel}>Cantidad</Text>
                      <TextInput
                        style={styles.itemInput}
                        value={item.quantity}
                        onChangeText={(text) => handleUpdateItemField(item.id, 'quantity', text)}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={placeholderColor}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={[styles.itemLabel, styles.itemMembersLabel]}>Participan</Text>
                    <View style={styles.itemMembersContainer}>
                      {groupMembers.map(member => {
                        const isSelected = item.selectedMembers.includes(member.id);
                        return (
                          <TouchableOpacity
                            key={member.id}
                            style={[styles.itemMemberChip, isSelected && styles.itemMemberChipSelected]}
                            onPress={() => handleToggleItemMember(item.id, member.id)}
                          >
                            <Text style={[styles.itemMemberChipText, isSelected && styles.itemMemberChipTextSelected]}>
                              {member.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {item.selectedMembers.length === 0 && (
                      <Text style={styles.itemMembersHint}>
                        Selecciona al menos un participante para este item.
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addItemButton} onPress={handleAddItem}>
                <Ionicons
                  name="add-circle"
                  size={22}
                  color={palette.primary}
                  style={styles.addItemIcon}
                />
                <Text style={styles.addItemText}>Agregar item</Text>
              </TouchableOpacity>

              <View style={styles.itemsTotalContainer}>
                <Text style={styles.itemsTotalLabel}>Total items:</Text>
                <Text style={styles.itemsTotalValue}>${itemsTotalValue.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Quien pagó */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>¿Quién pagó?</Text>
            {groupMembers.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.memberOption,
                  payerId === member.id && styles.memberOptionSelected
                ]}
                onPress={() => setPayerId(member.id)}
              >
                <View style={styles.memberInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.memberName}>{member.name}</Text>
                </View>
                {payerId === member.id && (
                  <Ionicons name="checkmark-circle" size={24} color={palette.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* División del gasto */}
          <View style={styles.section}>
            <View style={styles.divisionHeader}>
              <Text style={styles.sectionTitle}>División del gasto</Text>
              <Switch
                value={isCustomDivision}
                onValueChange={setIsCustomDivision}
                trackColor={{ false: switchTrackOff, true: switchTrackOn }}
                thumbColor={isCustomDivision ? palette.primary : palette.surface}
                disabled={useItems}
              />
            </View>
            {fieldErrors.shares && (
              <Text style={[styles.inlineError, { color: inlineErrorColor }]}>{fieldErrors.shares}</Text>
            )}

            {useItems ? (
              <Text style={styles.divisionDescription}>
                Cuando usas items detallados las participaciones se calculan automáticamente según los items seleccionados.
              </Text>
            ) : !isCustomDivision ? (
              <Text style={styles.divisionDescription}>
                El gasto se dividirá en partes iguales entre todos los miembros
              </Text>
            ) : (
              <>
                <View style={styles.customDivisionHeader}>
                  <Text style={styles.divisionDescription}>
                    Asigna porcentajes personalizados (deben sumar 100%)
                  </Text>
                  <TouchableOpacity
                    onPress={distributeEqually}
                    style={styles.equalButton}
                  >
                    <Text style={styles.equalButtonText}>Distribuir igual</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.totalPercentage}>
                  Total: {getTotalPercentage()}%
                </Text>

                {groupMembers.map(member => (
                  <View key={member.id} style={styles.percentageRow}>
                    <View style={styles.memberInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </View>
                    <View style={styles.percentageInput}>
                      <TextInput
                        style={styles.percentageTextInput}
                        value={memberPercentages[member.id] || '0'}
                        onChangeText={(text) => updatePercentage(member.id, text)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={placeholderColor}
                      />
                      <Text style={styles.percentageSymbol}>%</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.md,
      paddingTop: 60,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      backgroundColor: palette.surface,
    },
      attachmentPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: palette.spacing.sm,
        paddingHorizontal: palette.spacing.sm,
        paddingVertical: palette.spacing.xs,
        borderRadius: palette.radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.divider,
        backgroundColor: palette.surfaceAlt,
      },
      attachmentIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: palette.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${palette.primary}18`,
      },
      attachmentInfo: {
        flex: 1,
        gap: 2,
      },
      attachmentName: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.text,
      },
      attachmentHint: {
        fontSize: 12,
        color: palette.textMuted,
      },
    title: {
      fontSize: palette.font.h2,
      fontWeight: '600',
      color: palette.text,
    },
    saveButton: {
      backgroundColor: palette.primary,
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.sm,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: palette.surface,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: palette.spacing.md,
    },
    section: {
      marginBottom: palette.spacing.lg,
    },
    sectionTitle: {
      fontSize: palette.font.body,
      fontWeight: '600',
      color: palette.text,
      marginBottom: palette.spacing.md,
    },
    validationPills: {
      paddingVertical: palette.spacing.xs,
      marginBottom: palette.spacing.sm,
    },
    validationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: palette.spacing.sm,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    validationPillOk: {
      backgroundColor: applyAlpha(palette.primary, 0.15),
      borderColor: palette.primary,
    },
    validationPillPending: {
      backgroundColor: applyAlpha(palette.textMuted, 0.18),
      borderColor: applyAlpha(palette.textMuted, 0.28),
    },
    validationPillIcon: {
      marginRight: 6,
    },
    validationPillText: {
      fontSize: palette.font.small,
      fontWeight: '600',
    },
    inputGroup: {
      marginBottom: palette.spacing.md,
    },
    previewContainer: {
      marginBottom: palette.spacing.md,
    },
    receiptPreview: {
      width: '100%',
      height: 180,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceAlt,
    },
    label: {
      fontSize: palette.font.small,
      fontWeight: '500',
      color: palette.text,
      marginBottom: palette.spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.sm,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.sm,
      fontSize: 16,
      backgroundColor: palette.surface,
      color: palette.text,
    },
    inputDisabled: {
      backgroundColor: palette.surfaceAlt,
      color: palette.textMuted,
    },
    toggleRow: {
      marginTop: palette.spacing.xs,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    helperText: {
      marginTop: palette.spacing.xs,
      fontSize: palette.font.small,
      color: palette.textMuted,
    },
    inlineError: {
      marginTop: 4,
      fontSize: palette.font.small,
      fontWeight: '600',
    },
    itemCard: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.md,
      padding: palette.spacing.sm,
      marginBottom: palette.spacing.md,
      backgroundColor: palette.surface,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: palette.spacing.xs,
    },
    itemTitle: {
      fontSize: palette.font.body,
      fontWeight: '600',
      color: palette.text,
    },
    itemRemoveButton: {
      padding: 4,
    },
    itemRow: {
      flexDirection: 'row',
      marginBottom: palette.spacing.sm,
      alignItems: 'flex-end',
    },
    itemField: {
      flex: 1,
    },
    itemFieldLarge: {
      flex: 1,
      marginRight: palette.spacing.sm,
    },
    itemFieldSmall: {
      width: 90,
    },
    itemLabel: {
      fontSize: palette.font.small,
      fontWeight: '500',
      color: palette.text,
      marginBottom: palette.spacing.xs,
    },
    itemInput: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.sm,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.sm,
      backgroundColor: palette.surface,
      fontSize: 15,
      color: palette.text,
    },
    itemMembersLabel: {
      marginBottom: palette.spacing.xs,
      fontSize: palette.font.small,
      fontWeight: '500',
      color: palette.text,
    },
    itemMembersContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    itemMembersHint: {
      marginTop: palette.spacing.xs,
      fontSize: palette.font.small,
      color: palette.warning,
    },
    pendingAssignmentsNotice: {
      marginBottom: palette.spacing.sm,
      fontSize: palette.font.small,
      color: palette.warning,
      fontWeight: '600',
    },
    itemMemberChip: {
      borderWidth: 1,
      borderColor: applyAlpha(palette.textMuted, 0.3),
      borderRadius: palette.radius.pill,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      backgroundColor: palette.surface,
      marginRight: palette.spacing.xs,
      marginBottom: palette.spacing.xs,
    },
    itemMemberChipSelected: {
      borderColor: palette.primary,
      backgroundColor: applyAlpha(palette.primary, 0.18),
    },
    itemMemberChipText: {
      fontSize: palette.font.small,
      color: palette.textMuted,
    },
    itemMemberChipTextSelected: {
      color: palette.primary,
      fontWeight: '600',
    },
    addItemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      backgroundColor: applyAlpha(palette.primary, 0.12),
      marginBottom: palette.spacing.sm,
    },
    addItemIcon: {
      marginRight: palette.spacing.xs,
    },
    addItemText: {
      color: palette.primary,
      fontWeight: '600',
    },
    itemsTotalContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: palette.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.divider,
    },
    itemsTotalLabel: {
      fontSize: palette.font.body,
      fontWeight: '500',
      color: palette.textMuted,
    },
    itemsTotalValue: {
      fontSize: palette.font.body,
      fontWeight: '700',
      color: palette.primary,
    },
    memberOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.sm,
      borderRadius: palette.radius.sm,
      marginBottom: palette.spacing.xs,
      backgroundColor: palette.surfaceAlt,
    },
    memberOptionSelected: {
      backgroundColor: applyAlpha(palette.primary, 0.18),
      borderWidth: 1,
      borderColor: palette.primary,
    },
    memberInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: palette.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: palette.spacing.sm,
    },
    avatarText: {
      color: palette.surface,
      fontWeight: '600',
      fontSize: 14,
    },
    memberName: {
      fontSize: palette.font.body,
      color: palette.text,
    },
    divisionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: palette.spacing.md,
    },
    divisionDescription: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginBottom: palette.spacing.md,
    },
    customDivisionHeader: {
      marginBottom: palette.spacing.md,
    },
    equalButton: {
      alignSelf: 'flex-start',
      backgroundColor: palette.surfaceAlt,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.sm,
      marginTop: palette.spacing.xs,
    },
    equalButtonText: {
      fontSize: palette.font.small,
      color: palette.primary,
      fontWeight: '500',
    },
    totalPercentage: {
      fontSize: palette.font.small,
      fontWeight: '600',
      color: palette.primary,
      textAlign: 'center',
      marginBottom: palette.spacing.md,
      padding: palette.spacing.xs,
      backgroundColor: applyAlpha(palette.primary, 0.12),
      borderRadius: palette.radius.sm,
    },
    percentageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: palette.spacing.xs,
      marginBottom: palette.spacing.xs,
    },
    percentageInput: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.sm,
      paddingHorizontal: palette.spacing.xs,
      backgroundColor: palette.surfaceAlt,
    },
    percentageTextInput: {
      width: 50,
      paddingVertical: palette.spacing.xs,
      fontSize: palette.font.small,
      textAlign: 'center',
      color: palette.text,
    },
    percentageSymbol: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginLeft: palette.spacing.xs,
    },
  });
}