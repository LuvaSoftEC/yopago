import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Colors } from '../../constants/theme';

  // Tipos mínimos para evitar errores
  type GroupExpenseShare = {
    id?: number;
    memberId?: number;
    memberName?: string;
    amount?: number;
    percentage?: number;
  };
  type GroupExpenseItem = {
    id: number;
    description?: string;
    amount: number;
    quantity?: number;
    shares?: GroupExpenseShare[];
  };
  type GroupExpense = {
    id: number;
    description?: string;
    note?: string;
    amount: number;
    date?: string;
    createdAt?: string;
    payer?: { id?: number; name?: string };
    paidBy?: { id?: number; name?: string };
    tag?: string;
    shares?: GroupExpenseShare[];
    items?: GroupExpenseItem[];
  };
  type PaymentResponse = { amount: number };
  type ExpenseDetailModalProps = {
    visible: boolean;
    onClose: () => void;
    expense: GroupExpense | null;
    formatCurrency: (value: number) => string;
    formatDate: (value?: string) => string;
    currentMemberId?: number;
    onRequestPayment?: (expense: GroupExpense, share: GroupExpenseShare) => void;
    paymentState?: {
      userShare?: GroupExpenseShare;
      showPayButton?: boolean;
      canPay?: boolean;
      hasShareToPay?: boolean;
      isPayer?: boolean;
      pendingPayment?: PaymentResponse | null;
      pendingDisplayNote?: string | null;
      confirmedPayment?: PaymentResponse | null;
      confirmedDisplayNote?: string | null;
      settled?: boolean;
      shareStatuses?: {
        memberId?: number | null;
        memberName?: string | null;
        amount: number;
        status: 'unpaid' | 'pending' | 'confirmed';
        displayNote?: string | null;
      }[];
    };
  };

  const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
    visible,
    onClose,
    expense,
    formatCurrency,
    formatDate,
    currentMemberId,
    onRequestPayment,
    paymentState,
  }) => {
    const { t } = useTranslation();
    const scheme = useColorScheme() ?? 'light';
    const palette = Colors[scheme];
    const styles = useMemo(() => createStyles(palette), [palette]);
    if (!expense) return null;

    const payerName = expense.payer?.name || expense.paidBy?.name || t('groups.unknownMember');
    const expenseDate = expense.date || expense.createdAt;
    const userShare = paymentState?.userShare ?? expense.shares?.find(share => share.memberId === currentMemberId);
    const expensePayerId = expense.payer?.id ?? expense.paidBy?.id;
    const pendingPayment = paymentState?.pendingPayment ?? null;
    const confirmedPayment = paymentState?.confirmedPayment ?? null;
    const pendingDisplayNote = paymentState?.pendingDisplayNote ?? null;
    const confirmedDisplayNote = paymentState?.confirmedDisplayNote ?? null;
    const settled = paymentState?.settled ?? false;
    const shareStatuses = paymentState?.shareStatuses ?? [];
    const isPayer = paymentState?.isPayer ?? false;
    const showPayButton = paymentState?.showPayButton ?? (
      !!userShare && typeof userShare.amount === 'number' && userShare.amount > 0 && expensePayerId !== currentMemberId
    );
    const canRegisterPayment =
      showPayButton && !!userShare && typeof userShare.amount === 'number' && userShare.amount > 0 && expensePayerId !== currentMemberId && typeof onRequestPayment === 'function';

    const renderItemShares = (item: GroupExpenseItem) => {
      if (!item.shares || item.shares.length === 0) {
        return (
          <Text style={styles.emptySharesText}>
            {t('groups.expenseDetailEquiTable')}
          </Text>
        );
      }
      return item.shares.map(share => (
        <View key={`${item.id}-${share.id ?? share.memberId}`} style={styles.shareRow}>
          <Text style={styles.shareName}>{share.memberName || t('groups.memberFallback')}</Text>
          <View style={styles.shareAmounts}>
            {typeof share.amount === 'number' && (
              <Text style={styles.shareAmount}>{formatCurrency(share.amount)}</Text>
            )}
            {typeof share.percentage === 'number' && (
              <Text style={styles.sharePercentage}>{share.percentage.toFixed(2)}%</Text>
            )}
          </View>
        </View>
      ));
    };

    const renderOverallShares = (shares?: GroupExpenseShare[]) => {
      if (!shares || shares.length === 0) {
        return (
          <Text style={styles.emptySharesText}>
            {t('groups.expenseDetailNoInfo')}
          </Text>
        );
      }
      return shares.map(share => (
        <View key={share.id ?? share.memberId} style={styles.shareRow}>
          <Text style={styles.shareName}>{share.memberName || t('groups.memberFallback')}</Text>
          <View style={styles.shareAmounts}>
            {typeof share.amount === 'number' && (
              <Text style={styles.shareAmount}>{formatCurrency(share.amount)}</Text>
            )}
            {typeof share.percentage === 'number' && (
              <Text style={styles.sharePercentage}>{share.percentage.toFixed(2)}%</Text>
            )}
          </View>
        </View>
      ));
    };

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{expense.description || expense.note || t('groups.expenseDetailTitle')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t('groups.expenseDetailTotalAmount')}</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(expense.amount)}</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('groups.expenseDetailPaidBy')}</Text>
                  <Text style={styles.summaryValue}>{payerName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('groups.expenseDetailDate')}</Text>
                  <Text style={styles.summaryValue}>{formatDate(expenseDate)}</Text>
                </View>
                {expense.tag && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('groups.expenseDetailCategory')}</Text>
                    <Text style={styles.summaryValue}>{expense.tag}</Text>
                  </View>
                )}
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('groups.expenseDetailShares')}</Text>
                {renderOverallShares(expense.shares)}
                {isPayer && shareStatuses.length > 0 && (
                  <View style={styles.shareStatusesContainer}>
                    <Text style={styles.shareStatusesHeader}>{t('groups.expenseDetailPayStatus')}</Text>
                    {shareStatuses.map((status) => {
                      const memberLabel = status.memberName || (typeof status.memberId === 'number' ? t('groups.memberDeepLink', { id: status.memberId }) : t('groups.memberFallback'));
                      const amountLabel = formatCurrency(status.amount);
                      let iconName: 'alert-circle' | 'time' | 'checkmark-circle' = 'alert-circle';
                      let accentColor = '#dc2626';
                      let detailText = t('groups.expenseDetailUnpaid', { amount: amountLabel });
                      if (status.status === 'pending') {
                        iconName = 'time';
                        accentColor = '#d97706';
                        detailText = t('groups.expenseDetailPending', { amount: amountLabel });
                      } else if (status.status === 'confirmed') {
                        iconName = 'checkmark-circle';
                        accentColor = '#15803d';
                        detailText = t('groups.expenseDetailConfirmedAmt', { amount: amountLabel });
                      }
                      return (
                        <View key={`${status.memberId ?? memberLabel}-${status.status}`} style={styles.shareStatusRow}>
                          <Ionicons name={iconName} size={18} color={accentColor} style={styles.shareStatusIcon} />
                          <View style={styles.shareStatusContent}>
                            <Text style={styles.shareStatusMember}>{memberLabel}</Text>
                            <Text style={[styles.shareStatusDetail, { color: accentColor }]}>{detailText}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {canRegisterPayment && (
                  <TouchableOpacity style={styles.paymentButton} onPress={() => onRequestPayment?.(expense, userShare!)}>
                    <Ionicons name="wallet" size={18} color="#fff" style={styles.paymentButtonIcon} />
                    <Text style={styles.paymentButtonText}>
                      {t('groups.payAction', { amount: formatCurrency(userShare!.amount ?? 0) })}
                    </Text>
                  </TouchableOpacity>
                )}
                {!canRegisterPayment && pendingPayment && (
                  <View style={[styles.paymentStatusBanner, styles.paymentStatusPending]}>
                    <Ionicons name="time" size={18} color="#d97706" />
                    <View style={styles.paymentStatusContent}>
                      <Text style={styles.paymentStatusTitle}>{t('groups.expenseDetailPendingBadge')}</Text>
                      <Text style={styles.paymentStatusSubtitle}>
                        {pendingDisplayNote ?? t('groups.expenseDetailPendingMsg', { amount: formatCurrency(pendingPayment.amount) })}
                      </Text>
                    </View>
                  </View>
                )}
                {!canRegisterPayment && !pendingPayment && confirmedPayment && (
                  <View style={[styles.paymentStatusBanner, styles.paymentStatusConfirmed]}>
                    <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                    <View style={styles.paymentStatusContent}>
                      <Text style={styles.paymentStatusTitle}>{t('groups.expenseDetailConfirmedBadge')}</Text>
                      <Text style={styles.paymentStatusSubtitle}>
                        {confirmedDisplayNote ?? t('groups.expenseDetailConfirmedMsg', { amount: formatCurrency(confirmedPayment.amount) })}
                      </Text>
                    </View>
                  </View>
                )}
                {!isPayer && !canRegisterPayment && !pendingPayment && !confirmedPayment && settled && (
                  <View style={[styles.paymentStatusBanner, styles.paymentStatusSettled]}>
                    <Ionicons name="checkmark" size={18} color="#1d4ed8" />
                    <View style={styles.paymentStatusContent}>
                      <Text style={styles.paymentStatusTitle}>{t('groups.expenseDetailSettled')}</Text>
                      <Text style={styles.paymentStatusSubtitle}>
                        {t('groups.expenseDetailSettledMsg')}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('groups.expenseDetailItems')}</Text>
                {expense.items && expense.items.length > 0 ? (
                  expense.items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{item.description || t('groups.expenseDetailItemNoDesc')}</Text>
                        <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                      </View>
                      {item.quantity ? (
                        <Text style={styles.itemMeta}>{t('groups.expenseDetailItemQty', { qty: item.quantity })}</Text>
                      ) : null}
                      <View style={styles.itemSharesContainer}>
                        {renderItemShares(item)}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptySharesText}>
                    {t('groups.expenseDetailNoItems')}
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const createStyles = (palette: any) => StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      backgroundColor: palette.surface,
    },
    modalTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
      marginRight: 12,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f4f6',
    },
    modalContent: {
      padding: 20,
    },
    summaryCard: {
      backgroundColor: palette.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    summaryLabel: {
      fontSize: 13,
      color: palette.textMuted,
      marginBottom: 4,
    },
    summaryAmount: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.primary,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    summaryValue: {
      fontSize: 14,
      color: palette.text,
      fontWeight: '600',
    },
    section: {
      backgroundColor: palette.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 12,
    },
    shareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#f3f4f6',
    },
    shareName: {
      fontSize: 14,
      color: palette.text,
      flex: 1,
      marginRight: 12,
    },
    shareAmounts: {
      alignItems: 'flex-end',
    },
    shareAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.primary,
    },
    sharePercentage: {
      fontSize: 12,
      color: palette.textMuted,
    },
    emptySharesText: {
      fontSize: 13,
      color: palette.textMuted,
      fontStyle: 'italic',
    },
    itemCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      backgroundColor: palette.surface,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: palette.text,
      flex: 1,
      marginRight: 16,
    },
    itemAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: palette.primary,
    },
    itemMeta: {
      fontSize: 12,
      color: palette.textMuted,
      marginBottom: 8,
    },
    itemSharesContainer: {
      marginTop: 8,
    },
    paymentButton: {
      marginTop: 16,
      backgroundColor: '#2563eb',
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    paymentButtonIcon: {
      marginRight: 8,
    },
    paymentButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    paymentStatusBanner: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    paymentStatusContent: {
      flex: 1,
    },
    paymentStatusTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#111827',
      marginBottom: 4,
    },
    paymentStatusSubtitle: {
      fontSize: 13,
      color: '#1f2937',
    },
    paymentStatusPending: {
      backgroundColor: '#fef3c7',
    },
    paymentStatusConfirmed: {
      backgroundColor: '#dcfce7',
    },
    paymentStatusSettled: {
      backgroundColor: '#dbeafe',
    },
    shareStatusesContainer: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#e5e7eb',
      rowGap: 12,
    },
    shareStatusesHeader: {
      fontSize: 14,
      fontWeight: '700',
      color: '#1f2937',
    },
    shareStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    shareStatusIcon: {
      marginRight: 12,
    },
    shareStatusContent: {
      flex: 1,
      rowGap: 2,
    },
    shareStatusMember: {
      fontSize: 14,
      fontWeight: '600',
      color: '#111827',
    },
    shareStatusDetail: {
      fontSize: 13,
      color: '#111827',
    },
  });

  export default ExpenseDetailModal;
