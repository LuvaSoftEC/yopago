import { ThemedView } from '@/components/themed-view';
import { ThemedButton } from '@/components/ui/Button';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { type ReceiptProcessingPayload } from '../components/group/CaptureReceiptContent';
import { CaptureReceiptModal } from '../components/group/CaptureReceiptModal';
import { CreateExpenseModal } from '../components/group/CreateExpenseModal';
import ExpenseDetailModal from '../components/group/ExpenseDetailModal';
import GroupInviteModal from '../components/group/GroupInviteModal';
import { JoinGroupModal } from '../components/group/JoinGroupModal';
import RecordPaymentModal, { PaymentFormSubmission, PaymentMethod } from '../components/group/RecordPaymentModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useThemedAlert } from '../components/ui/ThemedAlert';
import { authenticatedApiService, CreateExpenseRequest, JoinGroupMemberResponse } from '../services/authenticatedApiService';
import { useRealTime } from '../contexts/RealTimeContext';
import {
  GroupDetailsResponse,
  GroupExpense,
  GroupExpenseShare,
  GroupMember,
  PaymentResponse,
} from '../services/types';

const normalizeForMatch = (value?: string | null) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

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

const buildIdentityCandidates = (userInfo: any) => {
  const emails = new Set<string>();
  const names = new Set<string>();

  const addEmail = (candidate?: string | null) => {
    const normalized = normalizeForMatch(candidate);
    if (normalized) {
      emails.add(normalized);
    }
  };

  const addName = (candidate?: string | null) => {
    const normalized = normalizeForMatch(candidate);
    if (normalized) {
      names.add(normalized);
    }
  };

  addEmail(userInfo?.email);
  if (Array.isArray(userInfo?.emails)) {
    userInfo.emails.forEach((emailCandidate: string) => addEmail(emailCandidate));
  }

  addName(userInfo?.name);
  addName(userInfo?.preferred_username);
  addName(userInfo?.nickname);
  addName(userInfo?.given_name);
  addName(userInfo?.family_name);
  if (userInfo?.given_name || userInfo?.family_name) {
    addName(`${userInfo?.given_name ?? ''} ${userInfo?.family_name ?? ''}`);
    addName(`${userInfo?.family_name ?? ''} ${userInfo?.given_name ?? ''}`);
  }

  return { emails, names };
};

const matchesCandidate = (
  value: string | undefined | null,
  candidates: Set<string>,
  { allowPartial = false }: { allowPartial?: boolean } = {}
) => {
  if (!candidates || candidates.size === 0) {
    return false;
  }

  const normalized = normalizeForMatch(value);
  if (!normalized) {
    return false;
  }

  if (candidates.has(normalized)) {
    return true;
  }

  if (!allowPartial) {
    return false;
  }

  for (const candidate of candidates) {
    if (!candidate || candidate.length < 2 || normalized.length < 2) {
      continue;
    }
    if (candidate.includes(normalized) || normalized.includes(candidate)) {
      return true;
    }
  }

  return false;
};

const findCurrentMemberId = (details: GroupDetailsResponse, userInfo: any): number => {
  const { emails, names } = buildIdentityCandidates(userInfo);

  const tryMatchMember = (member: { id?: number | null; name?: string | null; email?: string | null }) => {
    if (!member || typeof member.id !== 'number') {
      return null;
    }

    if (matchesCandidate(member.email, emails) || matchesCandidate(member.name, names, { allowPartial: true })) {
      return member.id;
    }

    return null;
  };

  for (const member of details.members ?? []) {
    const match = tryMatchMember(member);
    if (typeof match === 'number') {
      return match;
    }
  }

  for (const share of details.aggregatedShares ?? []) {
    if (typeof share.memberId === 'number') {
      if (matchesCandidate(share.memberName, names, { allowPartial: true })) {
        return share.memberId;
      }
    }
  }

  for (const expense of details.expenses ?? []) {
    const payerMatch = tryMatchMember(expense.payer ?? expense.paidBy ?? {});
    if (typeof payerMatch === 'number') {
      return payerMatch;
    }

    for (const share of expense.shares ?? []) {
      if (typeof share.memberId === 'number') {
        if (
          matchesCandidate(share.memberEmail, emails) ||
          matchesCandidate(share.memberName, names, { allowPartial: true })
        ) {
          return share.memberId;
        }
      }
    }
  }

  const payments = [
    ...(details.pendingPayments ?? []),
    ...(details.confirmedPayments ?? []),
  ] as PaymentResponse[];

  for (const payment of payments) {
    const fromMemberId =
      typeof payment.fromMember === 'object' ? payment.fromMember?.id : payment.fromMember;
    if (typeof fromMemberId === 'number') {
      if (
        matchesCandidate(
          typeof payment.fromMember === 'object' ? payment.fromMember?.email : undefined,
          emails
        ) ||
        matchesCandidate(
          typeof payment.fromMember === 'object' ? payment.fromMember?.name : undefined,
          names,
          { allowPartial: true }
        )
      ) {
        return fromMemberId;
      }
    }

    const toMemberId = typeof payment.toMember === 'object' ? payment.toMember?.id : payment.toMember;
    if (typeof toMemberId === 'number') {
      if (
        matchesCandidate(
          typeof payment.toMember === 'object' ? payment.toMember?.email : undefined,
          emails
        ) ||
        matchesCandidate(
          typeof payment.toMember === 'object' ? payment.toMember?.name : undefined,
          names,
          { allowPartial: true }
        )
      ) {
        return toMemberId;
      }
    }
  }

  return 0;
};

export default function GroupDetailsScreen() {
  const params = useLocalSearchParams<{
    groupId: string;
    action?: string | string[];
    fromMember?: string | string[];
    toMember?: string | string[];
    amount?: string | string[];
    method?: string | string[];
    memo?: string | string[];
  }>();

  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  
  const [groupDetails, setGroupDetails] = useState<GroupDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<GroupSection>('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [showCaptureReceiptModal, setShowCaptureReceiptModal] = useState(false);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptProcessingPayload | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number>(0);
  const [memberToRemove, setMemberToRemove] = useState<{ id: number; name: string } | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [memberMenuMemberId, setMemberMenuMemberId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [paymentContext, setPaymentContext] = useState<{ expense: GroupExpense; share: GroupExpenseShare } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDescriptionPopover, setShowDescriptionPopover] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [didAutoOpenPayment, setDidAutoOpenPayment] = useState(false);
  const [deepLinkPaymentPrefill, setDeepLinkPaymentPrefill] = useState<
    | {
        toMemberId: number;
        toMemberName: string;
        amount?: number;
        paymentMethod?: PaymentMethod;
        memo?: string;
      }
    | null
  >(null);

  const { subscribeToGroupEvents, subscribeToUserEvents } = useRealTime();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  
  const { showAlert, AlertComponent } = useThemedAlert();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const getParamValue = useCallback((value: string | string[] | undefined) => {
    return Array.isArray(value) ? value[0] : value;
  }, []);

  const parseIntegerParam = useCallback(
    (value: string | string[] | undefined): number | null => {
      const raw = getParamValue(value);
      if (typeof raw !== 'string') {
        return null;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    },
    [getParamValue]
  );

  const parseFloatParam = useCallback(
    (value: string | string[] | undefined): number | null => {
      const raw = getParamValue(value);
      if (typeof raw !== 'string') {
        return null;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    },
    [getParamValue]
  );

  const parsePaymentMethodParam = useCallback(
    (value: string | string[] | undefined): PaymentMethod | undefined => {
      const raw = getParamValue(value)?.toLowerCase();
      if (!raw) {
        return undefined;
      }
      if (raw === 'cash' || raw === 'efectivo') {
        return 'cash';
      }
      if (raw === 'other' || raw === 'otro') {
        return 'other';
      }
      if (raw === 'transfer' || raw === 'transferencia') {
        return 'transfer';
      }
      return undefined;
    },
    [getParamValue]
  );

  const goBackToGroups = useCallback(() => {
    setShowFabMenu(false);
    router.push('/(tabs)/my-groups');
  }, []);

  const loadGroupDetails = useCallback(async () => {
    try {
      if (!groupId) {
        showAlert('Error', 'ID de grupo no válido');
        router.back();
        return;
      }

      console.log('🔍 Cargando detalles del grupo:', groupId);

      const details = await authenticatedApiService.getGroupDetails(parseInt(groupId));
      setGroupDetails(details);

      let resolvedMemberId: number | null = null;

      try {
        const currentMember = await authenticatedApiService.getCurrentMember();
        if (currentMember && Number.isFinite(currentMember.memberId)) {
          resolvedMemberId = currentMember.memberId;
        }
      } catch (memberError) {
        console.warn('⚠️ No se pudo obtener el miembro autenticado, se intentará con userInfo:', memberError);
      }

      if (resolvedMemberId === null) {
        try {
          const userInfo = await authenticatedApiService.getCurrentUserInfo();
          resolvedMemberId = findCurrentMemberId(details, userInfo) ?? null;
        } catch (userInfoError) {
          console.warn('⚠️ No se pudo inferir el miembro actual desde userInfo:', userInfoError);
        }
      }

      const normalizedMemberId =
        typeof resolvedMemberId === 'number' && Number.isFinite(resolvedMemberId) && resolvedMemberId > 0
          ? resolvedMemberId
          : 0;

      setCurrentUserId(normalizedMemberId);
    } catch (error) {
      console.error('❌ Error cargando detalles del grupo:', error);
      showAlert(
        'Error',
        'No se pudo cargar la información del grupo',
        [
          {
            text: 'Reintentar',
            onPress: () => loadGroupDetails(),
          },
          {
            text: 'Volver',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  }, [groupId, showAlert]);

  const scheduleDataRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      return;
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void loadGroupDetails();
    }, 800);
  }, [loadGroupDetails]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroupDetails();
    setRefreshing(false);
  }, [loadGroupDetails]);

  useEffect(() => {
    const numericGroupId = Number(groupId);
    if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
      return undefined;
    }

    const unsubscribe = subscribeToGroupEvents(numericGroupId, (event) => {
      if (!event || typeof event.type !== 'string') {
        return;
      }

      if (event.type.startsWith('group.')) {
        scheduleDataRefresh();
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [groupId, scheduleDataRefresh, subscribeToGroupEvents]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    setShowDescriptionPopover(false);
  }, [groupDetails?.id]);

  useEffect(() => {
    if (memberMenuMemberId === null) {
      return;
    }

    const stillExists = groupDetails?.members?.some((member: any) => member.id === memberMenuMemberId);
    if (!stillExists) {
      setMemberMenuMemberId(null);
    }
  }, [memberMenuMemberId, groupDetails?.members]);

  useEffect(() => {
    if (!groupDetails || !currentUserId || didAutoOpenPayment) {
      return;
    }

    const actionParam = getParamValue(params.action)?.toLowerCase();
    if (actionParam !== 'recordpayment') {
      return;
    }

    const fromParam = parseIntegerParam(params.fromMember);
    if (fromParam === null || fromParam !== currentUserId) {
      return;
    }

    const toParam = parseIntegerParam(params.toMember);
    if (toParam === null) {
      return;
    }

    const amountParam = parseFloatParam(params.amount);
    const methodParam = parsePaymentMethodParam(params.method);
    const memoParam = getParamValue(params.memo);

    const recipient = groupDetails.members.find((member: any) => member.id === toParam);
    const recipientName = recipient?.name || recipient?.email || `Miembro #${toParam}`;

    setPaymentContext(null);
    setDeepLinkPaymentPrefill({
      toMemberId: toParam,
      toMemberName: recipientName,
      amount: amountParam ?? undefined,
      paymentMethod: methodParam,
      memo: typeof memoParam === 'string' && memoParam.trim().length > 0 ? memoParam.trim() : undefined,
    });
    setShowPaymentModal(true);
    setDidAutoOpenPayment(true);
  }, [
    groupDetails,
    currentUserId,
    params.action,
    params.fromMember,
    params.toMember,
    params.amount,
    params.method,
    params.memo,
    didAutoOpenPayment,
    getParamValue,
    parseIntegerParam,
    parseFloatParam,
    parsePaymentMethodParam,
  ]);

  useEffect(() => {
    if (!showDescriptionPopover) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setShowDescriptionPopover(false), 6000);
    return () => clearTimeout(timeoutId);
  }, [showDescriptionPopover]);

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return 'Fecha desconocida';
    }

    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      return 'Fecha desconocida';
    }

    return parsed.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    });
  }, []);

  const formatCurrency = useCallback(
    (amount: number) => {
      return currencyFormatter.format(amount);
    },
    [currencyFormatter],
  );

  useEffect(() => {
    if (!currentUserId || currentUserId <= 0) {
      return undefined;
    }

    const unsubscribe = subscribeToUserEvents(currentUserId, (event) => {
      if (!event || typeof event.type !== 'string') {
        return;
      }

      if (event.type === 'user.payment.created') {
        const direction = typeof event.direction === 'string' ? event.direction : undefined;
        const amountValue = typeof event.amount === 'number' ? event.amount : undefined;

        let message = 'Se registró un nuevo pago.';
        if (direction === 'received') {
          message = amountValue
            ? `Has recibido un nuevo pago de ${formatCurrency(amountValue)}`
            : 'Has recibido un nuevo pago.';
        } else if (direction === 'sent') {
          message = amountValue
            ? `Tu pago de ${formatCurrency(amountValue)} se registró correctamente.`
            : 'Tu pago fue registrado correctamente.';
        }
        setFeedback({ type: 'success', message });
      } else if (event.type === 'user.payment.confirmed') {
        setFeedback({ type: 'success', message: 'Un pago fue confirmado.' });
      } else if (event.type === 'user.payment.deleted') {
        setFeedback({ type: 'error', message: 'Un pago pendiente fue eliminado.' });
      }

      scheduleDataRefresh();
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUserId, formatCurrency, scheduleDataRefresh, subscribeToUserEvents]);

  const resolveMemberId = (member: PaymentResponse['fromMember'] | PaymentResponse['toMember']) => {
    if (member && typeof member === 'object') {
      return member.id ?? null;
    }
    if (typeof member === 'number') {
      return member;
    }
    return null;
  };

  const resolveMemberName = (
    member: PaymentResponse['fromMember'] | PaymentResponse['toMember'],
    fallbackLabel: string
  ) => {
    if (member && typeof member === 'object') {
      const name = member.name || fallbackLabel;
      return name;
    }
    if (typeof member === 'number') {
      return `Miembro #${member}`;
    }
    return fallbackLabel;
  };

  const amountsSimilar = (a?: number | null, b?: number | null) => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      return false;
    }
    return Math.abs(a - b) < 0.01;
  };

  type PaymentNoteMetadata = {
    type?: string;
    expenseId?: number;
    expenseDescription?: string;
    shareAmount?: number;
    memo?: string;
    paymentMethod?: PaymentMethod | string;
    attachmentFileName?: string;
    targetMemberId?: number;
    fromReminder?: boolean;
  };

  type GroupSection = 'overview' | 'members' | 'expenses' | 'balances' | 'payments';

  const PAYMENT_NOTE_TYPE = 'expense_share_payment';
  const MANUAL_PAYMENT_NOTE_TYPE = 'manual_payment';

  const parsePaymentNoteMetadata = (raw?: string | null): PaymentNoteMetadata | null => {
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return parsed as PaymentNoteMetadata;
      }
    } catch (error) {
      console.warn('⚠️ No se pudo parsear metadata del pago:', error);
    }

    return null;
  };

  const paymentMatchesExpense = (
    payment: PaymentResponse,
    expense: GroupExpense,
    expectedShareAmount?: number | null,
    metadataOverride?: PaymentNoteMetadata | null
  ) => {
    const metadata = metadataOverride ?? parsePaymentNoteMetadata(payment.note);

    if (metadata?.type === PAYMENT_NOTE_TYPE && typeof metadata.expenseId === 'number') {
      return metadata.expenseId === expense.id;
    }

    if (typeof expectedShareAmount === 'number') {
      if (typeof metadata?.shareAmount === 'number' && amountsSimilar(metadata.shareAmount, expectedShareAmount)) {
        return true;
      }
    }

    return false;
  };

  const describePaymentMethod = (method?: string | null) => {
    if (!method) {
      return null;
    }
    const normalized = method.toString().toLowerCase();
    if (['transfer', 'transferencia', 'bank_transfer', 'transferencia_bancaria'].includes(normalized)) {
      return 'transferencia';
    }
    if (['cash', 'efectivo', 'cash_payment', 'pago_efectivo', 'pago-efectivo', 'pago efectivo'].includes(normalized)) {
      return 'efectivo';
    }
    if (['other', 'otro', 'otros'].includes(normalized)) {
      return 'otro';
    }
    return normalized;
  };

  const getPaymentDisplayNote = (payment: PaymentResponse) => {
    const metadata = parsePaymentNoteMetadata(payment.note);
    const memo = metadata?.memo?.trim();

    if (memo) {
      return memo;
    }

    if (metadata?.type === PAYMENT_NOTE_TYPE && metadata.expenseDescription) {
      const methodLabel = describePaymentMethod(metadata.paymentMethod);
      return methodLabel
        ? `Pago de ${metadata.expenseDescription} (${methodLabel})`
        : `Pago de ${metadata.expenseDescription}`;
    }

    if (metadata?.type === MANUAL_PAYMENT_NOTE_TYPE) {
      const methodLabel = describePaymentMethod(metadata.paymentMethod);
      if (methodLabel) {
        return `Pago registrado (${methodLabel})`;
      }
      return 'Pago registrado manualmente';
    }

    const fallbackMethod = describePaymentMethod(metadata?.paymentMethod);
    if (fallbackMethod) {
      return `Pago registrado (${fallbackMethod})`;
    }

    return payment.note ?? null;
  };

  const handleCreateExpense = async (expense: CreateExpenseRequest) => {
    try {
      if (receiptDraft?.expense?.id) {
        try {
          await authenticatedApiService.deleteExpense(receiptDraft.expense.id.toString());
        } catch (deleteError) {
          console.error('Error removing OCR draft expense:', deleteError);
        }
      }

      await authenticatedApiService.createExpense(expense);
      setReceiptDraft(null);
      showAlert('Éxito', 'Gasto creado correctamente');
      await loadGroupDetails();
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error; // Reenviar el error para que el modal lo maneje
    }
  };

  const handleReceiptReady = useCallback(
    (payload: ReceiptProcessingPayload) => {
      setReceiptDraft(payload);
      setShowCaptureReceiptModal(false);
      setShowCreateExpenseModal(true);
    },
    [],
  );

  const handleCloseCreateExpenseModal = useCallback(() => {
    setShowCreateExpenseModal(false);

    if (receiptDraft?.expense?.id) {
      void (async () => {
        try {
          await authenticatedApiService.deleteExpense(receiptDraft.expense.id.toString());
        } catch (error) {
          console.error('Error deleting OCR draft expense:', error);
        } finally {
          setReceiptDraft(null);
          await loadGroupDetails();
        }
      })();
      return;
    }

    setReceiptDraft(null);
  }, [loadGroupDetails, receiptDraft]);

  const handleMemberAdded = async (memberResponse: JoinGroupMemberResponse) => {
    try {
      console.log('Miembro agregado:', memberResponse);
      // Recargar los detalles del grupo para mostrar el nuevo miembro
      await loadGroupDetails();
    } catch (error) {
      console.error('Error reloading group details after member added:', error);
    }
  };

  const handleRemoveMember = (memberId: number, memberName: string) => {
    console.log('🗑️ Intentando eliminar miembro:', memberId, memberName);
    setMemberMenuMemberId(null);
    setMemberToRemove({ id: memberId, name: memberName });
  };

  const handleConfirmRemoveMember = useCallback(async () => {
    if (!groupDetails || !memberToRemove) {
      console.log('❌ No hay detalles del grupo o miembro seleccionado');
      return;
    }

    setRemovingMember(true);
    try {
      const response = await authenticatedApiService.removeMemberFromGroup(
        groupDetails.id,
        memberToRemove.id
      );

      setFeedback({ type: 'success', message: response.message });
      setMemberToRemove(null);
      await loadGroupDetails();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el miembro',
      });
    } finally {
      setRemovingMember(false);
    }
  }, [groupDetails, memberToRemove, loadGroupDetails]);

  const handleConfirmPayment = useCallback(
    async (payment: PaymentResponse) => {
      if (!currentUserId) {
        showAlert('Error', 'No se pudo identificar al usuario actual para confirmar el pago.');
        return;
      }

      setConfirmingPaymentId(payment.id);
      try {
        await authenticatedApiService.confirmPayment(payment.id.toString(), currentUserId);
        setFeedback({ type: 'success', message: 'Pago confirmado correctamente' });
        await loadGroupDetails();
      } catch (error) {
        console.error('Error confirming payment:', error);
        setFeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'No se pudo confirmar el pago',
        });
      } finally {
        setConfirmingPaymentId(null);
      }
    },
    [currentUserId, loadGroupDetails, showAlert]
  );

  const expenseInitialData = useMemo(() => {
    if (!receiptDraft || !groupDetails) {
      return undefined;
    }

    const expense = receiptDraft.expense ?? {};
    const rawItems = Array.isArray(expense.items) ? expense.items : [];

    type PrefilledItem = {
      description: string;
      amount: number;
      quantity: number;
      selectedMembers: number[];
    };

    const normalizedItems: PrefilledItem[] = rawItems
      .map((item: any, index: number): PrefilledItem | null => {
        const safeAmount = typeof item.amount === 'number' ? Number(item.amount.toFixed(2)) : NaN;
        if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
          return null;
        }

        const rawDescription = typeof item.description === 'string' ? item.description.trim() : '';
        const description = rawDescription.length > 0 ? rawDescription : `Item ${index + 1}`;
        const rawQuantity = typeof item.quantity === 'number' && Number.isFinite(item.quantity)
          ? Math.round(Math.max(1, item.quantity))
          : 1;

        return {
          description,
          amount: safeAmount,
          quantity: rawQuantity,
          selectedMembers: [],
        };
      })
      .filter((item: any): item is PrefilledItem => item !== null);

    const totalFromItems = normalizedItems.reduce((sum, item) => sum + item.amount, 0);

    const inferredAmount = Number.isFinite(expense.amount)
      ? Number(expense.amount.toFixed(2))
      : totalFromItems > 0
        ? Number(totalFromItems.toFixed(2))
        : undefined;

    const pickFirstString = (
      ...candidates: (string | null | undefined)[]
    ): string | undefined => candidates.find((candidate) => candidate?.trim())?.trim();

    const inferredDescription = pickFirstString(receiptDraft.note, expense.note, 'Recibo procesado');
    const inferredTag = pickFirstString(expense.tag, 'Recibo AI');

    const inferredPayerId = expense.payer?.id ?? receiptDraft.payerId ?? groupDetails.members[0]?.id;

    return {
      note: inferredDescription ?? '',
      tag: inferredTag ?? 'Recibo AI',
      payerId: inferredPayerId ?? receiptDraft.payerId,
      amount: inferredAmount,
      items: normalizedItems.length > 0 ? normalizedItems : undefined,
    };
  }, [groupDetails, receiptDraft]);

  const receiptPreviewUri = receiptDraft?.imageUri;
  const receiptPreviewKind = receiptDraft?.fileKind ?? (receiptPreviewUri ? 'image' : undefined);
  const receiptPreviewName = receiptDraft?.fileName;

  const modalSuggestedAmount = paymentContext?.share.amount ?? deepLinkPaymentPrefill?.amount ?? 0;
  const modalRecipientName = paymentContext
    ? paymentContext.expense.payer?.name || paymentContext.expense.paidBy?.name || 'Miembro'
    : deepLinkPaymentPrefill?.toMemberName ?? 'Miembro';
  const modalRecipientId = paymentContext
    ? paymentContext.expense.payer?.id ?? paymentContext.expense.paidBy?.id ?? null
    : deepLinkPaymentPrefill?.toMemberId ?? null;
  const modalInitialMethod = deepLinkPaymentPrefill?.paymentMethod;
  const modalInitialMemo = deepLinkPaymentPrefill?.memo;

  const pendingPayments = (groupDetails?.pendingPayments ?? []) as PaymentResponse[];
  const confirmedPayments = (groupDetails?.confirmedPayments ?? []) as PaymentResponse[];

  const sectionTabs = useMemo(() => {
    if (!groupDetails) {
      return [];
    }

    const totalExpenses = groupDetails.totalExpenses ?? groupDetails.expenses?.length ?? 0;
    const totalMembers = groupDetails.totalMembers ?? groupDetails.members?.length ?? 0;
    const expensesCount = groupDetails.expenses?.length ?? 0;
    const balancesCount = groupDetails.aggregatedShares?.length ?? 0;
    const paymentsCount = pendingPayments.length + confirmedPayments.length;

    return [
      {
        id: 'overview' as GroupSection,
        label: 'Resumen',
        count: totalExpenses,
      },
      {
        id: 'members' as GroupSection,
        label: 'Miembros',
        count: totalMembers,
      },
      {
        id: 'expenses' as GroupSection,
        label: 'Gastos',
        count: expensesCount,
      },
      {
        id: 'balances' as GroupSection,
        label: 'Balances',
        count: balancesCount,
        disabled: balancesCount === 0,
      },
      {
        id: 'payments' as GroupSection,
        label: 'Pagos',
        count: paymentsCount,
        disabled: paymentsCount === 0,
      },
    ];
  }, [confirmedPayments.length, groupDetails, pendingPayments.length]);

  const quickStats = useMemo(() => {
    const totalMembers = groupDetails?.totalMembers ?? groupDetails?.members?.length ?? 0;
    return [
      {
        label: 'Miembros activos',
        value: totalMembers.toString(),
      },
      {
        label: 'Promedio por miembro',
        value: formatCurrency(groupDetails?.averagePerMember ?? 0),
      },
      {
        label: 'Pagos pendientes',
        value: pendingPayments.length.toString(),
      },
    ];
  }, [formatCurrency, groupDetails, pendingPayments.length]);

  const spotlightExpenses = useMemo(() => {
    if (!groupDetails?.expenses) {
      return [];
    }
    return groupDetails.expenses.slice(0, 3);
  }, [groupDetails]);

  const balanceSnapshot = useMemo(() => {
    if (!groupDetails?.aggregatedShares) {
      return [];
    }
    return groupDetails.aggregatedShares.slice(0, 3);
  }, [groupDetails]);

  if (loading) {
    return (
      <ProtectedRoute>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Cargando detalles del grupo...</Text>
        </View>
      </ProtectedRoute>
    );
  }

  if (!groupDetails) {
    return (
      <ProtectedRoute>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se pudo cargar la información del grupo</Text>
          <ThemedButton title="Reintentar" onPress={loadGroupDetails} style={styles.retryButton} />
        </View>
      </ProtectedRoute>
    );
  }

  const confirmablePayments = pendingPayments.filter(
    (payment) => resolveMemberId(payment.toMember) === currentUserId
  );
  const outgoingPendingPayments = pendingPayments.filter(
    (payment) => resolveMemberId(payment.fromMember) === currentUserId
  );
  const otherPendingPayments = pendingPayments.filter(
    (payment) =>
      resolveMemberId(payment.toMember) !== currentUserId &&
      resolveMemberId(payment.fromMember) !== currentUserId
  );

  type ExpenseSharePaymentStatus = {
    memberId?: number | null;
    memberName?: string | null;
    amount: number;
    status: 'unpaid' | 'pending' | 'confirmed';
    payment?: PaymentResponse | null;
    displayNote?: string | null;
  };

  type ExpensePaymentState = {
    userShare?: GroupExpenseShare;
    payerId?: number | null;
    hasShareToPay: boolean;
    isPayer: boolean;
    canPay: boolean;
    showPayButton: boolean;
    pendingPayment?: PaymentResponse | null;
    pendingDisplayNote?: string | null;
    confirmedPayment?: PaymentResponse | null;
    confirmedDisplayNote?: string | null;
    settled: boolean;
    shareStatuses: ExpenseSharePaymentStatus[];
  };

  const getExpensePaymentState = (expense: GroupExpense): ExpensePaymentState => {
    const userShare = expense.shares?.find((share) => share.memberId === currentUserId);
    const shareAmount = typeof userShare?.amount === 'number' ? userShare.amount : null;
    const payerId = expense.payer?.id || expense.paidBy?.id || null;
    const hasShareToPay = typeof shareAmount === 'number' && shareAmount > 0.009;
    const isPayer = payerId !== null && payerId === currentUserId;
    const canPay = !!payerId && hasShareToPay && !isPayer;

    const pendingPaymentsToPayer = pendingPayments.filter(
      (payment) =>
        resolveMemberId(payment.fromMember) === currentUserId &&
        resolveMemberId(payment.toMember) === payerId
    );
    const confirmedPaymentsToPayer = confirmedPayments.filter(
      (payment) =>
        resolveMemberId(payment.fromMember) === currentUserId &&
        resolveMemberId(payment.toMember) === payerId
    );

    const pendingPayment = pendingPaymentsToPayer.find((payment) => {
      const metadata = parsePaymentNoteMetadata(payment.note);
      if (paymentMatchesExpense(payment, expense, shareAmount, metadata)) {
        return true;
      }
      return (
        !metadata &&
        typeof shareAmount === 'number' &&
        pendingPaymentsToPayer.length === 1 &&
        amountsSimilar(payment.amount, shareAmount)
      );
    }) ?? null;

    const confirmedPayment = confirmedPaymentsToPayer.find((payment) => {
      const metadata = parsePaymentNoteMetadata(payment.note);
      if (paymentMatchesExpense(payment, expense, shareAmount, metadata)) {
        return true;
      }
      return (
        !metadata &&
        typeof shareAmount === 'number' &&
        confirmedPaymentsToPayer.length === 1 &&
        amountsSimilar(payment.amount, shareAmount)
      );
    }) ?? null;

    const showPayButton = canPay && !pendingPayment && !confirmedPayment;

    const availablePendingPayments = [...pendingPayments.filter(
      (payment) => resolveMemberId(payment.toMember) === payerId
    )];
    const availableConfirmedPayments = [...confirmedPayments.filter(
      (payment) => resolveMemberId(payment.toMember) === payerId
    )];

    const consumePayment = (list: PaymentResponse[], payment: PaymentResponse | null) => {
      if (!payment) {
        return;
      }
      const index = list.findIndex((candidate) => candidate.id === payment.id);
      if (index >= 0) {
        list.splice(index, 1);
      }
    };

    const shareStatuses: ExpenseSharePaymentStatus[] = [];

    const findMatchingSharePayment = (
      list: PaymentResponse[],
      memberId: number,
      amount: number
    ): PaymentResponse | null => {
      const candidateSubset = list.filter(
        (payment) => resolveMemberId(payment.fromMember) === memberId
      );

      for (const payment of candidateSubset) {
        const metadata = parsePaymentNoteMetadata(payment.note);
        if (paymentMatchesExpense(payment, expense, amount, metadata)) {
          return payment;
        }
      }

      if (candidateSubset.length === 1 && amountsSimilar(candidateSubset[0].amount, amount)) {
        return candidateSubset[0];
      }

      const fallback = candidateSubset.find((payment) => {
        const metadata = parsePaymentNoteMetadata(payment.note);
        return !metadata && amountsSimilar(payment.amount, amount);
      });

      return fallback ?? null;
    };

    if (payerId) {
      for (const share of expense.shares ?? []) {
        const shareMemberId = share.memberId ?? null;
        const amount = typeof share.amount === 'number' ? share.amount : null;

        if (
          !shareMemberId ||
          shareMemberId === payerId ||
          amount === null ||
          amount <= 0.009
        ) {
          continue;
        }

        const pendingMatch = findMatchingSharePayment(
          availablePendingPayments,
          shareMemberId,
          amount
        );

        if (pendingMatch) {
          consumePayment(availablePendingPayments, pendingMatch);
        }

        const confirmedMatch = !pendingMatch
          ? findMatchingSharePayment(
              availableConfirmedPayments,
              shareMemberId,
              amount
            )
          : null;

        if (confirmedMatch) {
          consumePayment(availableConfirmedPayments, confirmedMatch);
        }

        let status: ExpenseSharePaymentStatus['status'] = 'unpaid';
        let matchedPayment: PaymentResponse | null = null;

        if (pendingMatch) {
          status = 'pending';
          matchedPayment = pendingMatch;
        } else if (confirmedMatch) {
          status = 'confirmed';
          matchedPayment = confirmedMatch;
        }

        shareStatuses.push({
          memberId: shareMemberId,
          memberName: share.memberName ?? null,
          amount,
          status,
          payment: matchedPayment,
          displayNote: matchedPayment ? getPaymentDisplayNote(matchedPayment) : null,
        });
      }
    }

    const settled =
      !showPayButton &&
      (!canPay || !!confirmedPayment || (!hasShareToPay && !pendingPayment));

    return {
      userShare,
      payerId,
      hasShareToPay,
      isPayer,
      canPay,
      showPayButton,
      pendingPayment,
      confirmedPayment,
      pendingDisplayNote: pendingPayment ? getPaymentDisplayNote(pendingPayment) : null,
      confirmedDisplayNote: confirmedPayment ? getPaymentDisplayNote(confirmedPayment) : null,
      settled,
      shareStatuses,
    };
  };

  return (
    <ProtectedRoute>
      <View style={styles.screenContainer}>
        <Stack.Screen
          options={{
            title: '',
            headerShown: false,
          }}
        />
        {feedback && (
          <View
            style={[
              styles.feedbackBanner,
              feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError,
              ]}
            >
              {feedback.message}
            </Text>
            <TouchableOpacity style={styles.feedbackCloseButton} onPress={() => setFeedback(null)}>
              <Text style={styles.feedbackCloseButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        )}
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
            <View style={styles.headerTopBar}>
              <TouchableOpacity
                onPress={goBackToGroups}
                activeOpacity={0.85}
                style={[
                  styles.headerBackButton,
                  {
                    backgroundColor: palette.surface,
                    borderColor: applyAlpha(palette.text, 0.08),
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Volver a Mis Grupos"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="chevron-back" size={20} color={palette.text} />
              </TouchableOpacity>

              <Text
                numberOfLines={1}
                style={[styles.headerTitlePrimary, styles.headerTitleText, { color: palette.text }]}
              >
                {groupDetails.name}
              </Text>

              {groupDetails.description ? (
                <TouchableOpacity
                  onPress={() => setShowDescriptionPopover((prev: boolean) => !prev)}
                  activeOpacity={0.85}
                  style={[
                    styles.headerInfoButton,
                    {
                      backgroundColor: palette.surface,
                      borderColor: applyAlpha(palette.text, 0.08),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Ver descripción del grupo"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name={showDescriptionPopover ? 'help-circle' : 'help-circle-outline'}
                    size={18}
                    color={palette.primary}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.headerInfoButtonPlaceholder} />
              )}
            </View>

            {groupDetails.description && showDescriptionPopover ? (
              <>
                <TouchableWithoutFeedback onPress={() => setShowDescriptionPopover(false)}>
                  <View style={styles.headerDescriptionBackdrop} />
                </TouchableWithoutFeedback>
                <View
                  style={[
                    styles.headerDescriptionPopover,
                    {
                      backgroundColor: palette.surface,
                      borderColor: applyAlpha(palette.text, 0.08),
                      ...palette.shadow.card,
                    },
                  ]}
                >
                  <View style={styles.headerDescriptionHeader}>
                    <Text style={[styles.headerDescriptionTitle, { color: palette.text }]}>Descripción</Text>
                  </View>
                  <Text style={[styles.headerDescriptionText, { color: palette.text }]}>
                    {groupDetails.description}
                  </Text>
                </View>
              </>
            ) : null}

            <View style={styles.headerTotalBlock}>
              <Text style={[styles.headerTotalLabel, { color: palette.textMuted }]}>Total de gastos</Text>
              <Text style={styles.headerTotalValue}>{formatCurrency(groupDetails.totalAmount ?? 0)}</Text>
            </View>

            <View style={styles.headerMetaRow}>
              <View style={[styles.headerMetaBadge, { borderColor: applyAlpha(palette.text, 0.12) }]}> 
                <Text style={[styles.headerMetaBadgeLabel, { color: palette.textMuted }]}>Código</Text>
                <Text style={[styles.headerMetaBadgeValue, { color: palette.success }]}>{groupDetails.code}</Text>
              </View>
              <View style={[styles.headerMetaBadge, { borderColor: applyAlpha(palette.text, 0.12) }]}> 
                <Text style={[styles.headerMetaBadgeLabel, { color: palette.textMuted }]}>Creado</Text>
                <Text style={[styles.headerMetaBadgeValue, { color: palette.textMuted }]}>
                  {formatDate(groupDetails.createdAt)}
                </Text>
              </View>
            </View>
          </View>
        </ThemedView>
        <View style={[styles.sectionTabsWrapper, { borderBottomColor: applyAlpha(palette.text, 0.08) }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionTabsContent}
          >
            {sectionTabs.map((tab) => {
              const isActive = tab.id === activeSection;
              const isDisabled = Boolean(tab.disabled);
              return (
                <Pressable
                  key={tab.id}
                  style={[
                    styles.sectionTab,
                    isActive && styles.sectionTabActive,
                    isDisabled && styles.sectionTabDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive, disabled: isDisabled }}
                  onPress={() => {
                    if (!isDisabled) {
                      setActiveSection(tab.id);
                    }
                  }}
                  disabled={isDisabled}
                >
                  <Text
                    style={[
                      styles.sectionTabLabel,
                      isActive && styles.sectionTabLabelActive,
                      isDisabled && styles.sectionTabLabelDisabled,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <Text
                    style={[
                      styles.sectionTabCount,
                      isActive && styles.sectionTabCountActive,
                      isDisabled && styles.sectionTabCountDisabled,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        {activeSection === 'overview' && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.cardTitle}>Resumen Financiero</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Número de Gastos:</Text>
                <Text style={styles.summaryValue}>{groupDetails.totalExpenses}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Promedio por Miembro:</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(groupDetails.averagePerMember ?? 0)}
                </Text>
              </View>
            </View>

            <View style={styles.summaryHighlightsCard}>
              {quickStats.map((stat) => (
                <View key={stat.label} style={styles.summaryHighlight}>
                  <Text style={styles.summaryHighlightLabel}>{stat.label}</Text>
                  <Text style={styles.summaryHighlightValue}>{stat.value}</Text>
                </View>
              ))}
            </View>

            {spotlightExpenses.length > 0 && (
              <View style={styles.snapshotCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Últimos gastos</Text>
                  <TouchableOpacity onPress={() => setActiveSection('expenses')}>
                    <Text style={styles.snapshotLinkText}>Ver todos</Text>
                  </TouchableOpacity>
                </View>
                {spotlightExpenses.map((expense) => {
                  const description = expense.description || expense.note || 'Gasto';
                  const expenseDate = expense.date || expense.createdAt || groupDetails.createdAt;
                  return (
                    <View key={`snapshot-expense-${expense.id}`} style={styles.snapshotItem}>
                      <View>
                        <Text style={styles.snapshotItemTitle}>{description}</Text>
                        <Text style={styles.snapshotItemMeta}>
                          {formatDate(expenseDate)} • {expense.paidBy?.name || expense.payer?.name || 'Miembro'}
                        </Text>
                      </View>
                      <Text style={styles.snapshotItemAmount}>{formatCurrency(expense.amount)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {balanceSnapshot.length > 0 && (
              <View style={styles.snapshotCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Balances rápidos</Text>
                  <TouchableOpacity onPress={() => setActiveSection('balances')}>
                    <Text style={styles.snapshotLinkText}>Ir a balances</Text>
                  </TouchableOpacity>
                </View>
                {balanceSnapshot.map((share, index) => {
                  const balanceValue = share.balance ?? share.balanceBeforePayments ?? 0;
                  const isPositive = balanceValue >= 0;
                  return (
                    <View key={`snapshot-balance-${share.memberId ?? index}`} style={styles.snapshotItem}>
                      <View>
                        <Text style={styles.snapshotItemTitle}>{share.memberName || 'Miembro'}</Text>
                        <Text style={styles.snapshotItemMeta}>
                          {isPositive ? 'Saldo a favor' : 'Saldo por pagar'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.snapshotItemAmount,
                          isPositive ? styles.balancePositive : styles.balanceNegative,
                        ]}
                      >
                        {formatCurrency(Math.abs(balanceValue))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {activeSection === 'members' && (
        <View style={styles.membersCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              Miembros ({groupDetails.totalMembers})
            </Text>
            <ThemedButton
              title="+ Agregar"
              onPress={() => setShowJoinGroupModal(true)}
              variant="secondary"
              style={styles.addButton}
              textStyle={styles.addButtonText}
              accessibilityLabel="Agregar miembro"
            />
          </View>
          
          {groupDetails.members.map((member) => {
            const isCreator = groupDetails.createdBy.id === member.id;
            const isMenuOpen = memberMenuMemberId === member.id;
            const displayContact = member.email && member.email.endsWith('@guest.yopago.local')
              ? member.email.split('@')[0]
              : member.email;

            return (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {displayContact ? (
                    <Text style={styles.memberEmail}>{displayContact}</Text>
                  ) : null}
                  {member.joinedAt && (
                    <Text style={styles.memberJoinDate}>
                      Se unió el {formatDate(member.joinedAt)}
                    </Text>
                  )}
                </View>

                <View style={styles.memberActions}>
                  {isCreator ? (
                    <View style={styles.creatorBadge}>
                      <Text style={styles.creatorBadgeText}>Creador</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() =>
                        setMemberMenuMemberId((current) =>
                          current === member.id ? null : member.id
                        )
                      }
                      style={({ pressed }) => [
                        styles.memberMenuButton,
                        pressed && styles.memberMenuButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Opciones para ${member.name}`}
                      hitSlop={12}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={22}
                        color={palette.textMuted}
                        style={styles.memberMenuIcon}
                      />
                    </Pressable>
                  )}
                </View>

                {isMenuOpen && !isCreator && (
                  <View style={styles.memberMenuOverlay} pointerEvents="box-none">
                    <Pressable
                      style={styles.memberMenuBackdrop}
                      onPress={() => setMemberMenuMemberId(null)}
                    />
                    <View style={styles.memberMenuContainer}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.memberMenuItem,
                          pressed && styles.memberMenuItemPressed,
                        ]}
                        onPress={() => {
                          setMemberMenuMemberId(null);
                          handleRemoveMember(member.id, member.name);
                        }}
                      >
                        <Ionicons name="person-remove" size={18} color={palette.accent} />
                        <Text style={styles.memberMenuItemText}>Eliminar miembro</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        )}

        {activeSection === 'expenses' && (
        <View style={styles.expensesCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Gastos</Text>
            <ThemedButton
              title="+ Agregar"
              onPress={() => {
                setReceiptDraft(null);
                setShowCreateExpenseModal(true);
              }}
              variant="secondary"
              style={styles.addButton}
              textStyle={styles.addButtonText}
              accessibilityLabel="Agregar gasto"
            />
          </View>

          {groupDetails.expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No hay gastos registrados en este grupo
              </Text>
              <Text style={styles.emptyStateSubtext}>
                ¡Agrega el primer gasto para comenzar!
              </Text>
            </View>
          ) : (
            groupDetails.expenses.map((expense) => {
              const description = expense.description || expense.note || expense.tag || 'Gasto sin descripción';
              const expenseDate = expense.date || expense.createdAt || groupDetails.createdAt;
              const payerName = expense.paidBy?.name || expense.payer?.name || 'Miembro desconocido';
              const hasItems = Array.isArray(expense.items) && expense.items.length > 0;
              const paymentState = getExpensePaymentState(expense);
              const {
                userShare,
                showPayButton,
                pendingPayment: pendingPaymentToPayer,
                confirmedPayment: confirmedPaymentToPayer,
                settled,
                shareStatuses,
                isPayer,
              } = paymentState;

              return (
                <TouchableOpacity
                  key={expense.id}
                  style={styles.expenseItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedExpense(expense);
                    setShowExpenseDetail(true);
                  }}
                >
                  <View style={styles.expenseRow}>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseDescription}>{description}</Text>
                      <Text style={styles.expenseAmount}>
                        {formatCurrency(expense.amount)}
                      </Text>
                      <Text style={styles.expenseDate}>
                        {formatDate(expenseDate)} • Pagado por {payerName}
                      </Text>
                      {hasItems && (
                        <Text style={styles.expenseMeta}>
                          {expense.items?.length ?? 0} item(s) detallados
                        </Text>
                      )}
                      {showPayButton && (
                        <TouchableOpacity
                          style={styles.inlinePayButton}
                          onPress={(event: GestureResponderEvent) => {
                            event.stopPropagation();
                            if (userShare) {
                              setPaymentContext({ expense, share: userShare });
                            }
                            setShowPaymentModal(true);
                          }}
                        >
                          <Ionicons name="wallet" size={16} color={palette.surface} style={{ marginRight: 6 }} />
                          <Text style={styles.inlinePayText}>
                            Pagar {formatCurrency(userShare!.amount ?? 0)}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {!showPayButton && pendingPaymentToPayer && (
                        <View style={[styles.paymentInlineNotice, styles.paymentInlinePending]}>
                          <Ionicons name="time" size={14} color={palette.warning} />
                          <Text style={styles.paymentInlineText}>
                            Pago de {formatCurrency(pendingPaymentToPayer.amount)} en revisión
                          </Text>
                        </View>
                      )}
                      {!showPayButton && !pendingPaymentToPayer && confirmedPaymentToPayer && (
                        <View style={[styles.paymentInlineNotice, styles.paymentInlineConfirmed]}>
                          <Ionicons name="checkmark-circle" size={14} color={palette.success} />
                          <Text style={styles.paymentInlineText}>Pago registrado</Text>
                        </View>
                      )}
                      {!isPayer && !showPayButton && !pendingPaymentToPayer && !confirmedPaymentToPayer && settled && (
                        <View style={[styles.paymentInlineNotice, styles.paymentInlineSettled]}>
                          <Ionicons name="checkmark" size={14} color={palette.primary} />
                          <Text style={styles.paymentInlineText}>Saldo saldado</Text>
                        </View>
                      )}
                      {isPayer && shareStatuses.length > 0 && (
                        <View style={styles.expenseShareStatusList}>
                          {shareStatuses.map((status) => {
                            const memberLabel = status.memberName ||
                              (typeof status.memberId === 'number' ? `Miembro #${status.memberId}` : 'Miembro');
                            const amountLabel = formatCurrency(status.amount);
                            let badgeStyle = styles.expenseShareStatusBadgeUnpaid;
                            let iconName: ComponentProps<typeof Ionicons>['name'] = 'alert-circle';
                            let accentColor = palette.accent;
                            let detailText = `Falta pagar ${amountLabel}`;

                            if (status.status === 'pending') {
                              badgeStyle = styles.expenseShareStatusBadgePending;
                              iconName = 'time';
                              accentColor = palette.warning;
                              detailText = `Pago en revisión por ${amountLabel}`;
                            } else if (status.status === 'confirmed') {
                              badgeStyle = styles.expenseShareStatusBadgeConfirmed;
                              iconName = 'checkmark-circle';
                              accentColor = palette.success;
                              detailText = `Pago confirmado de ${amountLabel}`;
                            }

                            return (
                              <View
                                key={`${expense.id}-${status.memberId ?? memberLabel}-${status.status}`}
                                style={[styles.expenseShareStatusBadge, badgeStyle]}
                              >
                                <Ionicons name={iconName} size={14} color={accentColor} style={{ marginRight: 6 }} />
                                <View style={styles.expenseShareStatusContent}>
                                  <Text style={styles.expenseShareStatusMember}>{memberLabel}</Text>
                                  <Text style={[styles.expenseShareStatusDetail, { color: accentColor }]}>{detailText}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        )}

        {activeSection === 'balances' && groupDetails.aggregatedShares.length > 0 && (
          <View style={styles.balancesCard}>
            <Text style={styles.cardTitle}>Balances</Text>
            
            {groupDetails.aggregatedShares.map((share, index) => {
              const totalPaid = share.totalPaid ?? share.totalAmount ?? 0;
              const totalOwed = share.totalOwed ?? 0;
              const balanceBeforePayments = share.balanceBeforePayments ?? (totalPaid - totalOwed);
              const balanceAfterPayments = share.balance ?? balanceBeforePayments;
              const balanceAdjustment = share.balanceAdjustment ?? (balanceAfterPayments - balanceBeforePayments);
              const balanceLabel = balanceAfterPayments >= 0 ? 'Saldo a favor: ' : 'Saldo por pagar: ';

              return (
                <View key={share.memberId ?? index} style={styles.balanceItem}>
                  <Text style={styles.balanceName}>{share.memberName || 'Miembro'}</Text>
                  <View style={styles.balanceAmounts}>
                    <Text style={styles.balancePaid}>
                      Pagó: {formatCurrency(totalPaid)}
                    </Text>
                    <Text style={styles.balanceOwed}>
                      Consumos: {formatCurrency(totalOwed)}
                    </Text>
                    <Text style={[
                      styles.balanceResult,
                      balanceAfterPayments >= 0 ? styles.balancePositive : styles.balanceNegative
                    ]}>
                      {balanceLabel}
                      {formatCurrency(Math.abs(balanceAfterPayments))}
                    </Text>
                    {Math.abs(balanceAdjustment) > 0.009 && (
                      <Text style={styles.balanceAdjustment}>
                        Ajuste por pagos confirmados:{' '}
                        {balanceAdjustment > 0 ? '+' : '-'}
                        {formatCurrency(Math.abs(balanceAdjustment))}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {activeSection === 'balances' && groupDetails.aggregatedShares.length === 0 && (
          <View style={styles.snapshotCard}>
            <Text style={styles.emptyStateText}>Aún no hay balances para mostrar.</Text>
          </View>
        )}

        {activeSection === 'payments' && (pendingPayments.length > 0 || confirmedPayments.length > 0) && (
          <View style={styles.paymentsCard}>
            <Text style={styles.cardTitle}>Pagos entre miembros</Text>

            {confirmablePayments.length > 0 && (
              <View style={styles.paymentSection}>
                <Text style={styles.paymentSectionTitle}>Pendientes para confirmar</Text>
                {confirmablePayments.map((payment) => {
                  const payerName = resolveMemberName(payment.fromMember, 'Miembro');
                  const createdAt = formatDate(payment.createdAt);
                  const paymentNote = getPaymentDisplayNote(payment);
                  return (
                    <View key={`confirmable-${payment.id}`} style={styles.paymentItem}>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                        <Text style={styles.paymentMeta}>
                          {payerName} • {createdAt}
                        </Text>
                        {paymentNote ? (
                          <Text style={styles.paymentNote}>{paymentNote}</Text>
                        ) : null}
                      </View>
                      <ThemedButton
                        title="Confirmar"
                        onPress={() => handleConfirmPayment(payment)}
                        loading={confirmingPaymentId === payment.id}
                        style={styles.confirmButton}
                        textStyle={styles.confirmButtonText}
                      />
                    </View>
                  );
                })}
              </View>
            )}

            {outgoingPendingPayments.length > 0 && (
              <View style={styles.paymentSection}>
                <Text style={styles.paymentSectionTitle}>Pagos registrados por ti</Text>
                {outgoingPendingPayments.map((payment) => {
                  const receiverName = resolveMemberName(payment.toMember, 'Miembro');
                  const createdAt = formatDate(payment.createdAt);
                  const paymentNote = getPaymentDisplayNote(payment);
                  return (
                    <View key={`outgoing-${payment.id}`} style={styles.paymentItem}>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                        <Text style={styles.paymentMeta}>
                          Para {receiverName} • {createdAt}
                        </Text>
                        {paymentNote ? (
                          <Text style={styles.paymentNote}>{paymentNote}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.paymentStatusTag, styles.paymentStatusPending]}>
                        <Text style={styles.paymentStatusText}>Pendiente</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {otherPendingPayments.length > 0 && (
              <View style={styles.paymentSection}>
                <Text style={styles.paymentSectionTitle}>Pagos pendientes de otros miembros</Text>
                {otherPendingPayments.map((payment) => {
                  const payerName = resolveMemberName(payment.fromMember, 'Miembro');
                  const receiverName = resolveMemberName(payment.toMember, 'Miembro');
                  const createdAt = formatDate(payment.createdAt);
                  const paymentNote = getPaymentDisplayNote(payment);
                  return (
                    <View key={`other-${payment.id}`} style={styles.paymentItem}>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                        <Text style={styles.paymentMeta}>
                          {payerName} → {receiverName} • {createdAt}
                        </Text>
                        {paymentNote ? (
                          <Text style={styles.paymentNote}>{paymentNote}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.paymentStatusTag, styles.paymentStatusPending]}>
                        <Text style={styles.paymentStatusText}>Pendiente</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {pendingPayments.length === 0 && confirmedPayments.length === 0 && (
              <Text style={styles.paymentEmptyText}>Aún no hay pagos registrados en este grupo.</Text>
            )}

            {confirmedPayments.length > 0 && (
              <View style={styles.paymentSection}>
                <Text style={styles.paymentSectionTitle}>Pagos confirmados recientes</Text>
                {confirmedPayments.slice(0, 5).map((payment) => {
                  const payerName = resolveMemberName(payment.fromMember, 'Miembro');
                  const receiverName = resolveMemberName(payment.toMember, 'Miembro');
                  const createdAt = formatDate(payment.createdAt);
                  const paymentNote = getPaymentDisplayNote(payment);
                  return (
                    <View key={`confirmed-${payment.id}`} style={styles.paymentItem}>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                        <Text style={styles.paymentMeta}>
                          {payerName} → {receiverName} • {createdAt}
                        </Text>
                        {paymentNote ? (
                          <Text style={styles.paymentNote}>{paymentNote}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.paymentStatusTag, styles.paymentStatusConfirmed]}>
                        <Ionicons name="checkmark-circle" size={16} color={palette.success} />
                        <Text style={styles.paymentStatusText}>Confirmado</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activeSection === 'payments' && pendingPayments.length === 0 && confirmedPayments.length === 0 && (
          <View style={styles.snapshotCard}>
            <Text style={styles.emptyStateText}>Aún no hay pagos registrados en este grupo.</Text>
          </View>
        )}

        </ScrollView>

        {showFabMenu && (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.fabBackdrop}
            onPress={() => setShowFabMenu(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú flotante"
          />
        )}

        <View style={styles.actionButtons} pointerEvents="box-none">
          {showFabMenu && (
            <View style={styles.fabMenu}>
              <TouchableOpacity
                style={styles.fabMenuItem}
                activeOpacity={0.85}
                onPress={() => {
                  setShowFabMenu(false);
                  if (groupId) {
                    setShowCaptureReceiptModal(true);
                  } else {
                    showAlert('Error', 'No se pudo detectar el grupo para capturar el recibo.');
                  }
                }}
              >
                <Ionicons name="receipt-outline" size={20} color={palette.primary} />
                <Text style={styles.fabMenuLabel}>Capturar recibo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fabMenuItem}
                activeOpacity={0.85}
                onPress={() => {
                  setShowFabMenu(false);
                  setShowInviteModal(true);
                }}
              >
                <Ionicons name="person-add-outline" size={20} color={palette.primary} />
                <Text style={styles.fabMenuLabel}>Invitar miembros</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.fabButton, showFabMenu && styles.fabButtonActive]}
            onPress={() => setShowFabMenu((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Acciones rápidas"
          >
            <Ionicons
              name={showFabMenu ? 'close' : 'add'}
              size={28}
              color={palette.surface}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de Invitación */}
      {groupDetails && (
        <GroupInviteModal
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          groupData={groupDetails}
        />
      )}

      {/* Modal de Crear Gasto */}
      {groupDetails && currentUserId > 0 && (
        <CreateExpenseModal
          visible={showCreateExpenseModal}
          onClose={handleCloseCreateExpenseModal}
          onCreateExpense={handleCreateExpense}
          groupMembers={groupDetails.members as GroupMember[]}
          groupId={groupDetails.id}
          currentUserId={currentUserId}
          initialData={expenseInitialData}
          receiptPreviewUri={receiptPreviewUri}
          receiptPreviewName={receiptPreviewName}
          receiptPreviewKind={receiptPreviewKind}
        />
      )}

      {/* Modal de Agregar Miembro */}
      {groupDetails && (
        <JoinGroupModal
          visible={showJoinGroupModal}
          onClose={() => setShowJoinGroupModal(false)}
          onMemberAdded={handleMemberAdded}
          groupId={groupDetails.id}
        />
      )}

      {groupDetails && (
        <CaptureReceiptModal
          visible={showCaptureReceiptModal}
          groupId={groupDetails.id}
          groupMembers={groupDetails.members}
          defaultPayerId={currentUserId}
          onClose={() => setShowCaptureReceiptModal(false)}
          onProcessed={() => {
            setShowCaptureReceiptModal(false);
            void loadGroupDetails();
          }}
          onReceiptReady={handleReceiptReady}
        />
      )}

      <ExpenseDetailModal
        visible={showExpenseDetail}
        onClose={() => {
          setShowExpenseDetail(false);
          setSelectedExpense(null);
        }}
        expense={selectedExpense}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        currentMemberId={currentUserId}
        paymentState={selectedExpense ? getExpensePaymentState(selectedExpense) : undefined}
        onRequestPayment={(expense, share) => {
          // Ensure paidBy and payer have the required email property
          const fixMember = (member: any): GroupMember | undefined =>
            member && typeof member === 'object'
              ? {
                  id: member.id,
                  name: member.name,
                  email: member.email ?? '',
                  joinedAt: member.joinedAt,
                  isAdmin: member.isAdmin,
                  isGuest: member.isGuest,
                }
              : undefined;

          const fixedExpense = {
            ...expense,
            paidBy: fixMember(expense.paidBy),
            payer: fixMember(expense.payer),
          };

          setPaymentContext({ expense: fixedExpense, share });
          setShowExpenseDetail(false);
          setSelectedExpense(null);
          setShowPaymentModal(true);
        }}
      />

      <ConfirmDialog
        visible={!!memberToRemove}
        title="Eliminar miembro"
        description={
          memberToRemove
            ? `¿Estás seguro de que quieres eliminar a ${memberToRemove.name} del grupo?`
            : undefined
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        loading={removingMember}
        onCancel={() => {
          if (!removingMember) {
            setMemberToRemove(null);
          }
        }}
        onConfirm={handleConfirmRemoveMember}
      />

      <RecordPaymentModal
        visible={showPaymentModal}
        amountSuggested={modalSuggestedAmount}
        payerName={modalRecipientName}
        initialPaymentMethod={modalInitialMethod}
        initialNote={modalInitialMemo}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentContext(null);
          setDeepLinkPaymentPrefill(null);
        }}
        onSubmit={async ({ amount, note, paymentMethod, attachment }: PaymentFormSubmission) => {
          if (!groupDetails) {
            throw new Error('Contexto de grupo no disponible');
          }

          if (!currentUserId) {
            throw new Error('Usuario actual no identificado');
          }

          const payerId = modalRecipientId;
          if (!payerId) {
            throw new Error('No se encontró el destinatario del pago');
          }

          const memoValue = note.trim();
          let structuredNote: PaymentNoteMetadata;

          if (paymentContext) {
            const expenseLabel =
              paymentContext.expense.description ||
              paymentContext.expense.note ||
              paymentContext.expense.tag ||
              `gasto #${paymentContext.expense.id}`;

            structuredNote = {
              type: PAYMENT_NOTE_TYPE,
              expenseId: paymentContext.expense.id,
              expenseDescription: expenseLabel,
              shareAmount: paymentContext.share.amount,
              memo: memoValue ? memoValue : undefined,
              paymentMethod,
              attachmentFileName: attachment?.fileName,
            };
          } else {
            structuredNote = {
              type: MANUAL_PAYMENT_NOTE_TYPE,
              memo: memoValue ? memoValue : undefined,
              shareAmount: deepLinkPaymentPrefill?.amount,
              paymentMethod,
              attachmentFileName: attachment?.fileName,
              targetMemberId: modalRecipientId ?? undefined,
              fromReminder: !!deepLinkPaymentPrefill,
            };
          }

          const apiPaymentMethod =
            paymentMethod === 'cash'
              ? 'CASH'
              : paymentMethod === 'other'
                ? 'OTHER'
                : 'TRANSFER';

          await authenticatedApiService.createPayment({
            amount,
            note: JSON.stringify(structuredNote),
            groupId: groupDetails.id,
            fromMemberId: currentUserId,
            toMemberId: payerId,
            paymentMethod: apiPaymentMethod,
            attachmentBase64: attachment?.base64,
            attachmentFileName: attachment?.fileName,
            attachmentMimeType: attachment?.mimeType,
          });

          setFeedback({
            type: 'success',
            message: 'Pago registrado correctamente',
          });

          setDeepLinkPaymentPrefill(null);
          await loadGroupDetails();
        }}
      />
      {AlertComponent}
    </ProtectedRoute>
  );
}

const createStyles = (palette: AppPalette) => {
  const cardBase = {
    backgroundColor: palette.surface,
  marginHorizontal: 14,
  marginBottom: palette.spacing.md,
  padding: palette.spacing.md,
    borderRadius: palette.radius.md,
    ...palette.shadow.card,
  };

  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: palette.background,
    },
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    contentContainer: {
      padding: palette.spacing.sm, // antes era lg, ahora más pequeño
      rowGap: palette.spacing.lg,
      paddingBottom: palette.spacing.xl * 3,
    },
    sectionTabsWrapper: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: palette.spacing.xs,
      backgroundColor: palette.surface,
    },
    sectionTabsContent: {
      paddingHorizontal: palette.spacing.md,
      columnGap: palette.spacing.sm,
    },
    sectionTab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      borderWidth: 1,
      borderColor: applyAlpha(palette.text, 0.12),
      backgroundColor: palette.surface,
    },
    sectionTabActive: {
      backgroundColor: applyAlpha(palette.primary, 0.15),
      borderColor: applyAlpha(palette.primary, 0.35),
    },
    sectionTabDisabled: {
      opacity: 0.45,
    },
    sectionTabLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
      marginRight: palette.spacing.xs,
    },
    sectionTabLabelActive: {
      color: palette.primary,
    },
    sectionTabLabelDisabled: {
      color: palette.textMuted,
    },
    sectionTabCount: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.textMuted,
    },
    sectionTabCountActive: {
      color: palette.primary,
    },
    sectionTabCountDisabled: {
      color: palette.textMuted,
    },
    // ...definiciones eliminadas por duplicidad
    // ...definiciones eliminadas por duplicidad
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.background,
    },
    loadingText: {
      marginTop: palette.spacing.sm,
      fontSize: 16,
      color: palette.textMuted,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.background,
      padding: palette.spacing.lg,
    },
    errorText: {
      fontSize: 16,
      color: palette.accent,
      textAlign: 'center',
      marginBottom: palette.spacing.md,
      fontWeight: '600',
    },
    retryButton: {
      minWidth: 160,
    },
    feedbackBanner: {
      marginHorizontal: palette.spacing.md,
      marginTop: palette.spacing.md,
      marginBottom: palette.spacing.sm,
      borderRadius: palette.radius.md,
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: palette.spacing.sm,
      backgroundColor: palette.surfaceAlt,
    },
    feedbackSuccess: {
      backgroundColor: applyAlpha(palette.success, 0.18),
    },
    feedbackError: {
      backgroundColor: applyAlpha(palette.accent, 0.18),
    },
    feedbackText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: palette.text,
    },
    feedbackTextSuccess: {
      color: palette.success,
    },
    feedbackTextError: {
      color: palette.accent,
    },
    feedbackCloseButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: applyAlpha(palette.text, 0.1),
    },
    feedbackCloseButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.text,
      lineHeight: 16,
    },
    headerSection: {
      paddingHorizontal: palette.spacing.lg,
      paddingBottom: palette.spacing.sm,
      rowGap: palette.spacing.xs,
    },
    headerBackButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      position: 'relative',
    },
    headerSummaryCard: {
      borderWidth: 1,
      borderRadius: palette.radius.lg,
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.md,
      rowGap: palette.spacing.xs,
      alignItems: 'stretch',
      position: 'relative',
      marginTop: palette.spacing.xs,
      marginHorizontal: 0,
    },
    headerTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: palette.spacing.md,
      width: '100%',
    },
    headerTitleText: {
      flex: 1,
      textAlign: 'center',
    },
    headerTitlePrimary: {
      fontSize: palette.typography.headline.fontSize,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    headerTotalBlock: {
      marginTop: palette.spacing.xs,
      alignItems: 'center',
      rowGap: Math.max(2, palette.spacing.xs * 0.4),
    },
    headerTotalLabel: {
      fontSize: Math.round(palette.font.small * 0.9),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '600',
      textAlign: 'center',
    },
    headerTotalValue: {
      fontSize: palette.typography.title.fontSize,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: palette.success,
      textAlign: 'center',
      marginTop: 0,
      marginBottom: 0,
    },
    headerMetaRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'center',
      columnGap: palette.spacing.sm,
      rowGap: palette.spacing.xs,
      flexWrap: 'wrap',
      width: '100%',
      marginTop: palette.spacing.xs,
    },
    headerMetaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: palette.spacing.xs * 0.4,
      backgroundColor: applyAlpha(palette.text, 0.06),
      borderRadius: palette.radius.sm,
      borderWidth: 1,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: Math.max(2, palette.spacing.xs * 0.5),
      flex: 1,
      minWidth: '48%',
    },
    headerMetaBadgeLabel: {
      fontSize: Math.max(11, Math.round(palette.font.small * 0.7)),
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
    },
    headerMetaBadgeValue: {
      fontSize: Math.max(12, Math.round(palette.font.small * 0.85)),
      fontWeight: '700',
      textAlign: 'right',
      flexShrink: 1,
    },
    headerInfoButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    headerInfoButtonPlaceholder: {
      width: 36,
      height: 36,
    },
    headerDescriptionPopover: {
      position: 'absolute',
      top: palette.spacing.xl,
      right: palette.spacing.lg,
      maxWidth: 260,
      padding: palette.spacing.md,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      rowGap: palette.spacing.xs,
    },
    headerDescriptionBackdrop: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: palette.radius.lg,
    },
    headerDescriptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: palette.spacing.sm,
    },
    headerDescriptionTitle: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    headerDescriptionText: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'left',
      color: palette.text,
    },
    summaryCard: {
      ...cardBase,
      paddingVertical: palette.spacing.lg, // más espacio vertical
      paddingHorizontal: palette.spacing.lg, // más espacio horizontal
      borderRadius: palette.radius.md, // igual que los otros cards
      marginHorizontal: 0,
    },
    summaryHighlightsCard: {
      ...cardBase,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 0,
      paddingVertical: palette.spacing.sm,
      columnGap: palette.spacing.md,
      rowGap: palette.spacing.sm,
      flexWrap: 'wrap',
    },
    summaryHighlight: {
      flex: 1,
      minWidth: '30%',
    },
    summaryHighlightLabel: {
      fontSize: 13,
      color: palette.textMuted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    summaryHighlightValue: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
    },
    snapshotCard: {
      ...cardBase,
      marginHorizontal: 0,
      paddingVertical: palette.spacing.md,
    },
    snapshotItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: palette.spacing.xs,
    },
    snapshotItemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: palette.text,
    },
    snapshotItemMeta: {
      fontSize: 13,
      color: palette.textMuted,
    },
    snapshotItemAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: palette.text,
    },
    snapshotLinkText: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.primary,
    },
    cardTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: palette.text,
  marginBottom: palette.spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: palette.spacing.sm,
    },
    summaryLabel: {
      fontSize: 14,
      color: palette.textMuted,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    membersCard: {
      ...cardBase,
      padding: palette.spacing.md,
      borderRadius: palette.radius.md,
      marginHorizontal: 0, // igual que expensesCard
    },
    memberItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: palette.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      position: 'relative',
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 2,
    },
    memberEmail: {
      fontSize: 14,
      color: palette.textMuted,
      marginBottom: 2,
    },
    memberJoinDate: {
      fontSize: 12,
      color: palette.textMuted,
    },
    creatorBadge: {
      backgroundColor: applyAlpha(palette.primary, 0.18),
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
    },
    creatorBadgeText: {
      color: palette.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    expensesCard: {
      ...cardBase,
      padding: palette.spacing.md,
      borderRadius: palette.radius.md,
      marginHorizontal: 0, // antes 8, ahora hasta el borde
    },
    memberMenuButton: {
      paddingHorizontal: palette.spacing.xs,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.md,
    },
    memberMenuButtonPressed: {
      opacity: 0.6,
    },
    memberMenuIcon: {
      transform: [{ translateY: -2 }],
    },
    memberMenuOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      zIndex: 5,
    },
    memberMenuBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    memberMenuContainer: {
      marginTop: palette.spacing.xs,
      marginRight: palette.spacing.xs,
      backgroundColor: palette.surfaceAlt,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: applyAlpha(palette.text, 0.1),
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.sm,
      minWidth: 160,
      ...palette.shadow.card,
    },
    memberMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: palette.spacing.xs,
      paddingVertical: palette.spacing.xs    },
    memberMenuItemPressed: {
      opacity: 0.6,
    },
    memberMenuItemText: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: palette.spacing.md,
    },
    addButton: {
      minHeight: 0,
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.md,
      borderRadius: palette.radius.pill,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: palette.spacing.lg,
    },
    emptyStateText: {
      fontSize: 16,
      color: palette.textMuted,
      textAlign: 'center',
      marginBottom: palette.spacing.xs,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
    },
    expenseItem: {
                     paddingVertical: palette.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      paddingRight: 4,
      borderRadius: palette.radius.sm,
      marginBottom: 2,
    },
    expenseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    expenseDescription: {
      fontSize: palette.font.body,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 0,
    },
    expenseAmount: {
      fontSize: palette.font.body,
      fontWeight: '700',
      color: palette.primary,
      marginBottom: 0,
    },
    expenseDate: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginBottom: 0,
    },
    expenseMeta: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginBottom: 0,
    },
    expenseInfo: {
      flex: 1,
      marginRight: palette.spacing.sm,
      gap: 2,
    },
    inlinePayButton: {
      marginTop: palette.spacing.sm,
      alignSelf: 'flex-start',
      backgroundColor: palette.primary700,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.sm,
      borderRadius: palette.radius.pill,
    },
    inlinePayText: {
      color: palette.surface,
      fontSize: 13,
      fontWeight: '600',
    },
    paymentInlineNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.sm,
      borderRadius: palette.radius.pill,
      columnGap: palette.spacing.xs,
    },
    paymentInlineText: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.text,
    },
    paymentInlinePending: {
      backgroundColor: applyAlpha(palette.warning, 0.22),
    },
    paymentInlineConfirmed: {
      backgroundColor: applyAlpha(palette.success, 0.22),
    },
    paymentInlineSettled: {
      backgroundColor: applyAlpha(palette.primary300, 0.28),
    },
    expenseShareStatusList: {
      marginTop: palette.spacing.sm,
      rowGap: palette.spacing.xs,
    },
    expenseShareStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: palette.radius.md,
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.sm,
      columnGap: palette.spacing.xs,
    },
    expenseShareStatusContent: {
      flex: 1,
    },
    expenseShareStatusMember: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 2,
    },
    expenseShareStatusDetail: {
      fontSize: 11,
      color: palette.textMuted,
    },
    expenseShareStatusBadgeUnpaid: {
      backgroundColor: applyAlpha(palette.accent, 0.18),
    },
    expenseShareStatusBadgePending: {
      backgroundColor: applyAlpha(palette.warning, 0.22),
    },
    expenseShareStatusBadgeConfirmed: {
      backgroundColor: applyAlpha(palette.success, 0.22),
    },
    balancesCard: {
      ...cardBase,
      padding: palette.spacing.md,
      borderRadius: palette.radius.md,
      marginHorizontal: 0,
    },
    balanceItem: {
      paddingVertical: palette.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    balanceName: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: palette.spacing.xs,
    },
    balanceAmounts: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    balancePaid: {
      fontSize: 12,
      color: palette.success,
    },
    balanceOwed: {
      fontSize: 12,
      color: palette.accent,
    },
    balanceResult: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    balancePositive: {
      color: palette.success,
    },
    balanceNegative: {
      color: palette.accent,
    },
    balanceAdjustment: {
      width: '100%',
      marginTop: palette.spacing.xs,
      fontSize: 12,
      color: palette.primary,
      fontStyle: 'italic',
    },
    paymentsCard: {
      ...cardBase,
      padding: palette.spacing.md,
      borderRadius: palette.radius.md,
      marginHorizontal: 0,
      rowGap: palette.spacing.md,
    },
    paymentSection: {
      rowGap: palette.spacing.sm,
    },
    paymentSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.text,
    },
    paymentItem: {
      backgroundColor: palette.surfaceAlt,
      borderRadius: palette.radius.md,
      padding: palette.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: palette.spacing.sm,
    },
    paymentInfo: {
      flex: 1,
      rowGap: palette.spacing.xs,
    },
    paymentAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.text,
    },
    paymentMeta: {
      fontSize: 12,
      color: palette.textMuted,
    },
    paymentNote: {
      fontSize: 12,
      color: palette.primary,
      fontStyle: 'italic',
    },
    paymentEmptyText: {
      fontSize: 13,
      color: palette.textMuted,
    },
    confirmButton: {
      minHeight: 40,
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.md,
      borderRadius: palette.radius.pill,
    },
    confirmButtonText: {
      fontSize: 14,
      fontWeight: '700',
    },
    paymentStatusTag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.sm,
      borderRadius: palette.radius.pill,
      columnGap: palette.spacing.xs,
    },
    paymentStatusPending: {
      backgroundColor: applyAlpha(palette.warning, 0.22),
    },
    paymentStatusConfirmed: {
      backgroundColor: applyAlpha(palette.success, 0.24),
    },
    paymentStatusText: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.text,
    },
    fabBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: applyAlpha(palette.text, 0.25),
    },
    actionButtons: {
      position: 'absolute',
      right: palette.spacing.lg,
      bottom: palette.spacing.xl,
      alignItems: 'flex-end',
    },
    fabButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...palette.shadow.card,
    },
    fabButtonActive: {
      backgroundColor: palette.primary700,
    },
    fabMenu: {
      marginBottom: palette.spacing.sm,
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingVertical: palette.spacing.sm,
      width: 220,
      ...palette.shadow.card,
    },
    fabMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.sm,
    },
    fabMenuLabel: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '600',
      marginLeft: palette.spacing.sm,
    },
    memberActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 44,
    },
    removeMemberButton: {
      backgroundColor: palette.surfaceAlt,
      borderRadius: 18,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      shadowColor: applyAlpha(palette.text, 0.25),
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 2,
    },
    removeMemberButtonText: {
      color: palette.textMuted,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 20,
    },
  });
};