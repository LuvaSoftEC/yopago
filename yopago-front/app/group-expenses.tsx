import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ExpenseResponse, useAuthenticatedApiService } from '@/services/authenticatedApiService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const applyAlpha = (hexColor: string, alpha: number) => {
  const sanitized = hexColor?.replace('#', '') ?? '';
  if (sanitized.length !== 6) {
    return hexColor;
  }

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return hexColor;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Componente interno para mostrar los gastos
function GroupExpensesContent() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const authenticatedApiService = useAuthenticatedApiService();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [expenses, setExpenses] = useState<ExpenseResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [group, setGroup] = useState<any>(null);

  // Estados para crear gasto
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'Comida',
    divisionType: 'EQUAL' as 'EQUAL' | 'CUSTOM',
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadGroupData = useCallback(async () => {
    const numericGroupId = Number(groupId);
    if (!numericGroupId || Number.isNaN(numericGroupId)) {
      console.warn('groupId inválido, no se puede cargar el grupo');
      return;
    }

    try {
      console.log('🔍 Cargando datos del grupo:', numericGroupId);
      const groupDetails = await authenticatedApiService.getGroupDetails(numericGroupId);
      setGroup(groupDetails);
      console.log('✅ Datos del grupo cargados:', groupDetails);
    } catch (error) {
      console.error('❌ Error cargando datos del grupo:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos del grupo');
    }
  }, [authenticatedApiService, groupId]);

  const loadExpenses = useCallback(async () => {
    if (!groupId) {
      return;
    }

    try {
      setIsLoading(true);
      console.log('💰 Cargando gastos del grupo:', groupId);
      
      const groupExpenses = await authenticatedApiService.getGroupExpenses(groupId);
      setExpenses(groupExpenses);
      console.log('✅ Gastos cargados:', groupExpenses);
      
    } catch (error) {
      console.error('❌ Error cargando gastos:', error);
      Alert.alert('Error', 'No se pudieron cargar los gastos del grupo');
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedApiService, groupId]);

  useEffect(() => {
    if (groupId) {
      void loadGroupData();
      void loadExpenses();
    }
  }, [groupId, loadGroupData, loadExpenses]);

  const onRefresh = async () => {
    setRefreshing(true);
  await Promise.all([loadGroupData(), loadExpenses()]);
    setRefreshing(false);
  };

  const handleCreateExpense = async () => {
    if (!newExpense.description.trim() || !newExpense.amount.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    const amount = parseFloat(newExpense.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'El monto debe ser un número válido mayor a 0');
      return;
    }

    try {
      setIsCreating(true);
      console.log('💰 Creando nuevo gasto...');

      // Encontrar el ID del usuario actual en la lista de miembros del grupo
      const currentUserMember = group?.members?.find((member: any) => 
        member.email === user?.email || member.name === user?.username
      );

      if (!currentUserMember) {
        Alert.alert('Error', 'No se pudo identificar tu usuario en el grupo');
        return;
      }

      const expenseRequest = {
        description: newExpense.description.trim(),
        amount: amount,
        category: newExpense.category,
        paidBy: currentUserMember.id,
  groupId: Number(groupId),
        divisionType: newExpense.divisionType,
      } as any;

      console.log('📤 Enviando solicitud de gasto:', expenseRequest);

      const createdExpense = await authenticatedApiService.createExpense(expenseRequest);
      console.log('✅ Gasto creado exitosamente:', createdExpense);

      // Actualizar la lista de gastos
      await loadExpenses();

      // Cerrar modal y limpiar formulario
      setShowCreateModal(false);
      setNewExpense({
        description: '',
        amount: '',
        category: 'Comida',
        divisionType: 'EQUAL',
      });

      Alert.alert('Éxito', 'Gasto creado exitosamente');

    } catch (error) {
      console.error('❌ Error creando gasto:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al crear el gasto');
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMemberName = (memberId: number) => {
    const member = group?.members?.find((m: any) => m.id === memberId);
    return member?.name || `Miembro ${memberId}`;
  };

  const totalExpenses = useMemo(() => {
    if (typeof group?.summary?.totalExpenses === 'number') {
      return group.summary.totalExpenses;
    }

    if (typeof group?.summary?.totalAmount === 'number') {
      return group.summary.totalAmount;
    }

    if (typeof group?.totalExpenses === 'number') {
      return group.totalExpenses;
    }

    if (typeof group?.totalAmount === 'number') {
      return group.totalAmount;
    }

    return expenses.reduce((acc, expense) => acc + (typeof expense.amount === 'number' ? expense.amount : 0), 0);
  }, [expenses, group]);

  const goToMyGroups = useCallback(() => {
    router.push('/(tabs)/my-groups');
  }, [router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={{ marginTop: 16 }}>Cargando gastos...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <ThemedView
        style={[
          styles.headerSection,
          {
            paddingTop: insets.top + palette.spacing.sm,
            backgroundColor: palette.surface,
            borderBottomColor: applyAlpha(palette.text, 0.08),
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={goToMyGroups}
            activeOpacity={0.85}
            style={[
              styles.headerBackButton,
              {
                backgroundColor: palette.background,
                borderColor: applyAlpha(palette.text, 0.08),
              },
            ]}
          >
            <Ionicons name="chevron-back" size={18} color={palette.text} />
            <ThemedText style={[styles.headerBackText, { color: palette.text }]}>Mis grupos</ThemedText>
          </TouchableOpacity>

          <View style={styles.headerTitleWrapper}>
            <Ionicons name="people" size={22} color={palette.primary} style={styles.headerTitleIcon} />
            <ThemedText
              numberOfLines={1}
              style={[styles.headerTitle, { color: palette.text }]}
            >
              {group?.name ?? 'Grupo'}
            </ThemedText>
          </View>

          <View style={styles.headerSidePlaceholder} />
        </View>

        <View
          style={[
            styles.headerSummaryCard,
            {
              backgroundColor: palette.background,
              borderColor: applyAlpha(palette.text, 0.08),
              ...palette.shadow.card,
            },
          ]}
        >
          <ThemedText style={[styles.headerSummaryLabel, { color: palette.textMuted }]}>Total de gastos</ThemedText>
          <ThemedText style={[styles.headerSummaryValue, { color: palette.primary }]}>
            {formatCurrency(totalExpenses)}
          </ThemedText>
        </View>
      </ThemedView>

      {/* Botón para crear gasto */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>➕ Nuevo Gasto</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de gastos */}
      <ScrollView
        style={styles.expensesList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              No hay gastos registrados
            </ThemedText>
            <ThemedText style={styles.emptyDescription}>
              Agrega el primer gasto para comenzar a dividir los costos
            </ThemedText>
          </View>
        ) : (
          expenses.map((expense) => (
            <View key={expense.id} style={styles.expenseCard}>
              <View style={styles.expenseHeader}>
                <View style={styles.expenseInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.expenseDescription}>
                    {expense.description}
                  </ThemedText>
                  <ThemedText style={styles.expenseCategory}>
                    📂 {expense.category}
                  </ThemedText>
                </View>
                
                <View style={styles.expenseAmount}>
                  <ThemedText type="defaultSemiBold" style={styles.amountText}>
                    ${expense.amount.toFixed(2)}
                  </ThemedText>
                  <ThemedText style={styles.divisionType}>
                    {expense.divisionType === 'EQUAL' ? '🔄 División igual' : '📊 División personalizada'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.expenseFooter}>
                <ThemedText style={styles.paidBy}>
                  💳 Pagado por: {getMemberName(expense.paidBy)}
                </ThemedText>
                <ThemedText style={styles.expenseDate}>
                  🕒 {formatDate(expense.createdAt)}
                </ThemedText>
              </View>

              {expense.items && expense.items.length > 0 && (
                <View style={styles.itemsContainer}>
                  <ThemedText style={styles.itemsTitle}>📋 Items:</ThemedText>
                  {expense.items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <ThemedText style={styles.itemName}>{item.itemName}</ThemedText>
                      <ThemedText style={styles.itemAmount}>${item.amount.toFixed(2)}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal para crear gasto */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCreateModal(false)}
              style={styles.modalCancelButton}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Nuevo Gasto
            </ThemedText>
            
            <TouchableOpacity
              onPress={handleCreateExpense}
              disabled={isCreating}
              style={[styles.modalSaveButton, isCreating && styles.disabledButton]}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSaveText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Descripción *</ThemedText>
              <TextInput
                style={styles.formInput}
                value={newExpense.description}
                onChangeText={(text) => setNewExpense(prev => ({ ...prev, description: text }))}
                placeholder="Ej: Cena en restaurante"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Monto *</ThemedText>
              <TextInput
                style={styles.formInput}
                value={newExpense.amount}
                onChangeText={(text) => setNewExpense(prev => ({ ...prev, amount: text }))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Categoría</ThemedText>
              <View style={styles.categoryContainer}>
                {['Comida', 'Transporte', 'Entretenimiento', 'Compras', 'Otro'].map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      newExpense.category === category && styles.categoryButtonActive
                    ]}
                    onPress={() => setNewExpense(prev => ({ ...prev, category }))}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      newExpense.category === category && styles.categoryButtonTextActive
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tipo de División</ThemedText>
              <View style={styles.divisionContainer}>
                <TouchableOpacity
                  style={[
                    styles.divisionButton,
                    newExpense.divisionType === 'EQUAL' && styles.divisionButtonActive
                  ]}
                  onPress={() => setNewExpense(prev => ({ ...prev, divisionType: 'EQUAL' }))}
                >
                  <Text style={[
                    styles.divisionButtonText,
                    newExpense.divisionType === 'EQUAL' && styles.divisionButtonTextActive
                  ]}>
                    🔄 División Igual
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.divisionButton,
                    newExpense.divisionType === 'CUSTOM' && styles.divisionButtonActive
                  ]}
                  onPress={() => setNewExpense(prev => ({ ...prev, divisionType: 'CUSTOM' }))}
                >
                  <Text style={[
                    styles.divisionButtonText,
                    newExpense.divisionType === 'CUSTOM' && styles.divisionButtonTextActive
                  ]}>
                    📊 División Personalizada
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Componente principal protegido
export default function GroupExpensesScreen() {
  return (
    <ProtectedRoute>
      <GroupExpensesContent />
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerBackText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
  },
  headerTitleIcon: {
    marginRight: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerSidePlaceholder: {
    width: 44,
    height: 44,
  },
  headerSummaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerSummaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  headerSummaryValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  actionContainer: {
    padding: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  expensesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseInfo: {
    flex: 1,
    marginRight: 12,
  },
  expenseDescription: {
    fontSize: 16,
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 14,
    opacity: 0.7,
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    color: '#34C759',
    marginBottom: 2,
  },
  divisionType: {
    fontSize: 12,
    opacity: 0.7,
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paidBy: {
    fontSize: 14,
    color: '#007AFF',
  },
  expenseDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  itemsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: 14,
    flex: 1,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#34C759',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
  },
  modalSaveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    backgroundColor: '#ffffff',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333333',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  divisionContainer: {
    gap: 12,
  },
  divisionButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  divisionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  divisionButtonText: {
    fontSize: 16,
    color: '#333333',
  },
  divisionButtonTextActive: {
    color: '#ffffff',
  },
});