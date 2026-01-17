import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GuestCreateExpenseModal } from '@/components/guest/GuestCreateExpenseModal';
import { GuestRegisterPaymentModal } from '@/components/guest/GuestRegisterPaymentModal';
import { GuestUpgradeAccountModal } from '@/components/guest/GuestUpgradeAccountModal';
import { CaptureReceiptModal } from '@/components/group/CaptureReceiptModal';
import { type CaptureReceiptContentProps, type ReceiptProcessingPayload } from '@/components/group/CaptureReceiptContent';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useGuestSession } from '@/contexts/GuestSessionContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { guestService } from '@/services/guestService';
import { GuestGroupInfoResponse, GroupExpense, GuestPayment, GuestMemberSummary, GroupMember } from '@/services/types';

export default function GuestDashboard() {
  const { session, logoutGuest, refreshSession } = useGuestSession();
  const router = useRouter();
  const groupId = session?.groupId;
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [group, setGroup] = useState<GuestGroupInfoResponse['group'] | null>(null);
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [payments, setPayments] = useState<GuestPayment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [showRegisterPaymentModal, setShowRegisterPaymentModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showCaptureReceiptModal, setShowCaptureReceiptModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!groupId) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [groupInfo, expenseInfo, paymentInfo] = await Promise.all([
        guestService.getGroupInfo(),
        guestService.getGroupExpenses(),
        guestService.getPayments(),
      ]);

      if (!groupInfo?.success) {
        throw new Error(groupInfo?.group?.name ? 'No se pudo cargar el resumen del grupo' : 'Grupo no disponible');
      }

      if (!expenseInfo?.success) {
        throw new Error('No se pudieron cargar los gastos del grupo');
      }

      setGroup(groupInfo.group ?? null);
      setExpenses(expenseInfo.expenses ?? []);
      if (paymentInfo?.success) {
        setPayments(paymentInfo.payments ?? []);
      } else {
        setPayments([]);
      }
    } catch (err: any) {
      console.error('[GuestDashboard] load error', err);
      setError(err?.message || 'No se pudo cargar la información del grupo');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshSession(), loadData()]);
  }, [refreshSession, loadData]);

  const currentMemberId = useMemo(() => session?.memberId ?? null, [session?.memberId]);

  const groupMembers = useMemo<GuestMemberSummary[]>(() => {
    if (group && Array.isArray(group.members)) {
      return group.members;
    }
    return [];
  }, [group]);

  const normalizedGroupMembers = useMemo<GroupMember[]>(
    () =>
      groupMembers.map((member) => ({
        id: member.id,
        name: member.name || member.email || `Miembro #${member.id}`,
        email: member.email || '',
        isGuest: member.isGuest ?? !member.isRegistered,
      })),
    [groupMembers],
  );

  const resolvedGroupId = useMemo(() => {
    if (typeof group?.id === 'number') {
      return group.id;
    }
    if (typeof groupId === 'number') {
      return groupId;
    }
    return null;
  }, [group?.id, groupId]);

  const hasRecipients = useMemo(() => {
    return groupMembers.some((member) => member.id !== currentMemberId);
  }, [groupMembers, currentMemberId]);

  const handleConfirmPayment = useCallback(
    async (paymentId: number) => {
      try {
        setConfirmingPaymentId(paymentId);
        const response = await guestService.confirmPayment(paymentId);
        Alert.alert('Pago confirmado', response.message || 'El pago fue confirmado con éxito.');
        await handleRefresh();
      } catch (err: any) {
        console.error('[GuestDashboard] confirm payment error', err);
        const message = err?.message || 'No se pudo confirmar el pago.';
        Alert.alert('Error', message);
      } finally {
        setConfirmingPaymentId(null);
      }
    },
    [handleRefresh],
  );

  const handleReceiptReady = useCallback(
    (_payload: ReceiptProcessingPayload) => {
      setShowCaptureReceiptModal(false);
      Alert.alert('Recibo capturado', 'Registramos el gasto utilizando la información del recibo.');
      void handleRefresh();
    },
    [handleRefresh],
  );

  const handleGuestProcessReceipt = useCallback<NonNullable<CaptureReceiptContentProps['processReceipt']>>(
    (fileUri, targetGroupId, options = {}) => {
      const effectiveGroupId = typeof targetGroupId === 'number' ? targetGroupId : resolvedGroupId;
      if (typeof effectiveGroupId !== 'number') {
        return Promise.reject(new Error('No se pudo determinar el grupo para procesar el recibo.'));
      }
      return guestService.processReceipt(fileUri, effectiveGroupId, options);
    },
    [resolvedGroupId],
  );

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}> 
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: palette.spacing.xl }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        <View style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.divider }]}> 
          <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>Grupo</Text>
          <Text style={[styles.groupName, { color: palette.text }]}>{group?.name || session?.groupName || 'Grupo invitado'} </Text>
          {group?.description ? (
            <Text style={[styles.groupDescription, { color: palette.textMuted }]}>{group.description}</Text>
          ) : null}
          {group?.members?.length ? (
            <Text style={[styles.groupMeta, { color: palette.textMuted }]}>
              {group.members.length} participantes
            </Text>
          ) : null}
          {session?.shareCode || group?.shareCode ? (
            <View
              style={[styles.codeContainer, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            > 
              <Ionicons name="qr-code-outline" size={20} color={palette.primary} />
              <Text style={[styles.shareCode, { color: palette.primary }]}>Código: {group?.shareCode || session?.shareCode}</Text>
            </View>
          ) : null}
        </View>

        {session?.guestName && session?.email ? (
          <View style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.divider }]}> 
            <View style={styles.upgradeHeader}>
              <Ionicons name="person-add-outline" size={22} color={palette.primary} />
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Convierte tu acceso invitado</Text>
            </View>
            <Text style={[styles.upgradeHint, { color: palette.textMuted }]}>
              Conservamos tu nombre y correo. Completa una contraseña y opcionalmente ajusta tus datos para crear tu cuenta.
            </Text>
            <Button
              title="Completar registro"
              onPress={() => setShowUpgradeModal(true)}
              style={styles.actionButton}
            />
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.divider }]}> 
          <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>Acciones rápidas</Text>
          <View style={styles.actionsRow}>
            <Button
              title="Registrar gasto"
              onPress={() => {
                setShowFabMenu(false);
                setShowCreateExpenseModal(true);
              }}
              style={styles.actionButton}
            />
            <Button
              title="Registrar pago"
              variant="secondary"
              onPress={() => {
                setShowFabMenu(false);
                setShowRegisterPaymentModal(true);
              }}
              disabled={!hasRecipients}
              style={styles.actionButton}
            />
          </View>
          <Text style={[styles.actionsHint, { color: palette.textMuted }]}>
            Los invitados solo pueden usar el mismo nombre y correo registrados anteriormente.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.divider }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>Gastos recientes</Text>
          </View>
          {expenses.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>Aún no hay gastos registrados.</Text>
          ) : (
            expenses.slice(0, 5).map((expense) => {
              const amountValue = typeof expense.amount === 'number' ? expense.amount : 0;
              return (
                <View key={expense.id} style={[styles.expenseRow, { borderColor: palette.divider }]}> 
                  <View>
                    <Text style={[styles.expenseNote, { color: palette.text }]}>{expense.description || expense.note || 'Gasto'}</Text>
                    {expense.paidBy?.name ? (
                      <Text style={[styles.expenseMeta, { color: palette.textMuted }]}>Pagado por {expense.paidBy.name}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.expenseAmount, { color: palette.primary }]}>${amountValue.toFixed(2)}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.divider }]}> 
          <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>Tu sesión</Text>
          <Text style={[styles.sessionDetail, { color: palette.text }]}>{session?.guestName || 'Invitado'}</Text>
          {session?.email ? (
            <Text style={[styles.sessionMeta, { color: palette.textMuted }]}>{session.email}</Text>
          ) : null}
          <Button
            title="Salir del modo invitado"
            variant="secondary"
            onPress={async () => {
              await logoutGuest();
              router.replace('/' as never);
            }}
            style={{ marginTop: palette.spacing.md }}
          />
        </View>

        <View style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.divider }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>Pagos entre miembros</Text>
          </View>
          {payments.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>Aún no hay pagos registrados.</Text>
          ) : (
            payments.map((payment) => {
              const amountValue = typeof payment.amount === 'number' ? payment.amount : 0;
              const payerName = payment.fromMember?.name || `Miembro #${payment.fromMember?.id ?? '?'}`;
              const receiverName = payment.toMember?.name || `Miembro #${payment.toMember?.id ?? '?'}`;
              const isRecipient = currentMemberId != null && payment.toMember?.id === currentMemberId;
              const statusLabel = payment.confirmed
                ? 'Confirmado'
                : isRecipient
                  ? 'Pendiente por confirmar'
                  : 'Pendiente';
              const showConfirm = isRecipient && !payment.confirmed;
              const note = payment.note?.trim();
              const createdAt = payment.createdAt ? new Date(payment.createdAt) : null;
              const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : null;

              return (
                <View key={payment.id} style={[styles.paymentRow, { borderColor: palette.divider }]}> 
                  <View style={styles.paymentInfo}>
                    <Text style={[styles.paymentAmount, { color: palette.primary }]}>${amountValue.toFixed(2)}</Text>
                    <Text style={[styles.paymentMeta, { color: palette.text }]}>
                      {payerName} → {receiverName}
                    </Text>
                    <Text
                      style={[
                        styles.paymentStatus,
                        { color: payment.confirmed ? palette.success : palette.warning },
                      ]}
                    >
                      {statusLabel}
                    </Text>
                    {createdLabel ? (
                      <Text style={[styles.paymentSubMeta, { color: palette.textMuted }]}>{createdLabel}</Text>
                    ) : null}
                    {note ? (
                      <Text style={[styles.paymentNote, { color: palette.textMuted }]}>{note}</Text>
                    ) : null}
                  </View>
                  {showConfirm ? (
                    <Button
                      title={confirmingPaymentId === payment.id ? 'Confirmando...' : 'Confirmar'}
                      onPress={() => handleConfirmPayment(payment.id)}
                      loading={confirmingPaymentId === payment.id}
                      style={styles.paymentAction}
                    />
                  ) : null}
                </View>
              );
            })
          )}
        </View>

  {error ? <Text style={[styles.errorText, { color: palette.warning }]}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>

      {showFabMenu && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.fabBackdrop}
          onPress={() => setShowFabMenu(false)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú flotante"
        />
      )}

      <View style={styles.fabContainer} pointerEvents="box-none">
        {showFabMenu && (
          <View style={[styles.fabMenu, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
            <TouchableOpacity
              style={styles.fabMenuItem}
              activeOpacity={0.9}
              onPress={() => {
                setShowFabMenu(false);
                if (typeof resolvedGroupId === 'number') {
                  setShowCaptureReceiptModal(true);
                } else {
                  Alert.alert('Grupo no disponible', 'No pudimos identificar el grupo para capturar el recibo.');
                }
              }}
            >
              <Ionicons name="receipt-outline" size={20} color={palette.primary} />
              <Text style={[styles.fabMenuLabel, { color: palette.text }]}>Capturar recibo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fabMenuItem}
              activeOpacity={0.9}
              onPress={() => {
                setShowFabMenu(false);
                setShowCreateExpenseModal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={palette.primary} />
              <Text style={[styles.fabMenuLabel, { color: palette.text }]}>Registrar gasto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fabMenuItem, !hasRecipients && styles.fabMenuItemDisabled]}
              activeOpacity={0.9}
              onPress={() => {
                if (!hasRecipients) {
                  Alert.alert('Sin destinatarios', 'Necesitas al menos otro miembro para registrar un pago.');
                  return;
                }
                setShowFabMenu(false);
                setShowRegisterPaymentModal(true);
              }}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={palette.primary} />
              <Text style={[styles.fabMenuLabel, { color: palette.text }]}>Registrar pago</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.fabButton, { backgroundColor: palette.primary }]}
          onPress={() => setShowFabMenu((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Acciones rápidas"
        >
          <Ionicons name={showFabMenu ? 'close' : 'add'} size={28} color={palette.surface} />
        </TouchableOpacity>
      </View>

      <GuestCreateExpenseModal
        visible={showCreateExpenseModal}
        onClose={() => setShowCreateExpenseModal(false)}
        onCreated={handleRefresh}
        members={groupMembers}
        currentMemberId={currentMemberId}
      />

      <GuestRegisterPaymentModal
        visible={showRegisterPaymentModal}
        onClose={() => setShowRegisterPaymentModal(false)}
        onRegistered={handleRefresh}
        members={groupMembers}
        currentMemberId={currentMemberId}
      />

      <CaptureReceiptModal
        visible={showCaptureReceiptModal}
        groupId={typeof resolvedGroupId === 'number' ? resolvedGroupId : undefined}
        groupMembers={normalizedGroupMembers}
        defaultPayerId={currentMemberId ?? undefined}
        onClose={() => setShowCaptureReceiptModal(false)}
        onProcessed={() => {
          setShowCaptureReceiptModal(false);
          void handleRefresh();
        }}
        onReceiptReady={handleReceiptReady}
        processReceipt={handleGuestProcessReceipt}
      />

      <GuestUpgradeAccountModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        name={session?.guestName}
        email={session?.email}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  actionsRow: {
    marginTop: 16,
    flexDirection: 'column',
    gap: 12,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  upgradeHint: {
    fontSize: 14,
    marginBottom: 16,
  },
  actionButton: {
    alignSelf: 'stretch',
  },
  actionsHint: {
    marginTop: 12,
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '600',
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
  },
  groupDescription: {
    fontSize: 16,
  },
  groupMeta: {
    fontSize: 14,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareCode: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 16,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expenseNote: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseMeta: {
    fontSize: 14,
    marginTop: 4,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  sessionDetail: {
    fontSize: 20,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  paymentInfo: {
    flex: 1,
    gap: 4,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  paymentMeta: {
    fontSize: 14,
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  paymentSubMeta: {
    fontSize: 12,
  },
  paymentNote: {
    fontSize: 12,
    marginTop: 4,
  },
  paymentAction: {
    alignSelf: 'stretch',
  },
  fabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    alignItems: 'flex-end',
  },
  fabMenu: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    width: 220,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fabMenuItemDisabled: {
    opacity: 0.5,
  },
  fabMenuLabel: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
