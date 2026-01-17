import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
  Pressable,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLinking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, type AppPalette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHeaderHeightDebug } from "@/hooks/use-header-height-debug";
import { useAuthenticatedApiService } from "@/services/authenticatedApiService";
import type { AggregatedShare, GroupDetailsResponse } from "@/services/types";
import { useRealTime } from "@/contexts/RealTimeContext";

type DateRangeOption = "all" | "7d" | "30d" | "custom";

type FilterState = {
  dateRange: DateRangeOption;
  groupId: number | "all";
  startDate: string | null;
  endDate: string | null;
};

type RawDebt = {
  amount: number;
  fromMemberId: number;
  toMemberId: number;
  occurredAt: string | null;
};

type RawGroupData = {
  groupId: number;
  groupName: string;
  memberNames: Record<number | string, string>;
  debts: RawDebt[];
};

type SettlementEntry = {
  id: string;
  groupId: number;
  groupName: string;
  fromMemberId: number;
  toMemberId: number;
  amount: number;
  fromName: string;
  toName: string;
  occurredAt?: string | null;
};

type GroupBreakdown = {
  groupId: number;
  groupName: string;
  youOwe: number;
  owedToYou: number;
  settlements: SettlementEntry[];
};

type PersonBreakdown = {
  memberId: number;
  name: string;
  youOwe: number;
  owedToYou: number;
  settlements: SettlementEntry[];
};

const DATE_RANGE_OPTIONS: { key: DateRangeOption; label: string }[] = [
  { key: "all", label: "Todo el tiempo" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "custom", label: "Personalizado" },
];

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_FILTERS: FilterState = {
  dateRange: "all",
  groupId: "all",
  startDate: null,
  endDate: null,
};

const CURRENCY_LOCALE = "es-CO";
const CURRENCY_CODE = "COP";
const DISPLAY_THRESHOLD = 0.009;

type RefreshOptions = {
  silent?: boolean;
};

export default function BalanceScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const handleHeaderLayout = useHeaderHeightDebug("wallet");
  const api = useAuthenticatedApiService();
  const { subscribeToGroupEvents, subscribeToUserEvents } = useRealTime();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | undefined>();
  const [groupBreakdown, setGroupBreakdown] = useState<GroupBreakdown[]>([]);
  const [personBreakdown, setPersonBreakdown] = useState<PersonBreakdown[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rawGroups, setRawGroups] = useState<RawGroupData[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterDraft, setFilterDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [customDraft, setCustomDraft] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const isFetchingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionsRef = useRef<{
    user?: () => void;
    groups: Map<number, () => void>;
  }>({ groups: new Map() });

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(CURRENCY_LOCALE, { style: "currency", currency: CURRENCY_CODE }),
    []
  );

  const formatCurrency = useCallback(
    (value: number) => currencyFormatter.format(roundToTwo(value)),
    [currencyFormatter]
  );

  const computeTotals = useCallback((groups: GroupBreakdown[]) => {
    const totals = groups.reduce(
      (acc, group) => {
        acc.youOwe += group.youOwe;
        acc.owedToYou += group.owedToYou;
        return acc;
      },
      { youOwe: 0, owedToYou: 0 }
    );

    return {
      youOwe: totals.youOwe,
      owedToYou: totals.owedToYou,
      net: totals.owedToYou - totals.youOwe,
    };
  }, []);

  const totals = useMemo(() => computeTotals(groupBreakdown), [groupBreakdown, computeTotals]);

  const netFlowText = useMemo(() => {
    return `Tú debes ${formatCurrency(totals.youOwe)} — Te deben ${formatCurrency(totals.owedToYou)}`;
  }, [formatCurrency, totals.owedToYou, totals.youOwe]);
  const netIsPositive = totals.net >= 0;

  const hasActiveFilters = filters.groupId !== "all" || filters.dateRange !== "all";
  const filterSummary = useMemo(() => buildFilterSummary(filters, rawGroups), [filters, rawGroups]);

  const loadBalance = useCallback(async ({ silent }: RefreshOptions = {}) => {
    setError(null);
    if (!silent) {
      setIsLoading(true);
    }
    isFetchingRef.current = true;

    try {
      const currentMember = await api.getCurrentMember();
      setCurrentMemberId(currentMember.memberId);
      setMemberName(currentMember.name);

      const userGroups = await api.getUserGroups();
      const normalizedGroups = userGroups
        .map((group) => {
          const idCandidate = group.groupId ?? group.id ?? group.group?.id ?? group?.groupId;
          const groupId = typeof idCandidate === "number" ? idCandidate : Number(idCandidate);
          if (!Number.isFinite(groupId)) {
            return null;
          }
          const groupName =
            typeof group.name === "string" && group.name.trim().length > 0
              ? group.name
              : typeof group.group?.name === "string"
                ? group.group.name
                : `Grupo ${groupId}`;
          return { groupId, groupName };
        })
        .filter((group): group is { groupId: number; groupName: string } => group !== null);

      const groupDetails = await Promise.allSettled(
        normalizedGroups.map((group) => api.getGroupDetails(group.groupId))
      );

      const nextRawGroups: RawGroupData[] = [];

      groupDetails.forEach((result, index) => {
        const groupMeta = normalizedGroups[index];
        if (!groupMeta) {
          return;
        }

        if (result.status !== "fulfilled") {
          console.warn("No se pudieron obtener los detalles del grupo", groupMeta.groupId, result.reason);
          return;
        }

        const detail = result.value;
        const memberNamesMap = buildMemberNameMap(detail.aggregatedShares, detail.members);
        const memberNamesRecord = Object.fromEntries(memberNamesMap.entries()) as Record<number | string, string>;

        const balances = extractBalances(detail);
        const settlementsForGroup = computeSettlementMatrix(balances);

        const debtsFromExpenses = buildExpenseDebts(detail);
        const paymentAdjustments = buildConfirmedPaymentDebts(detail);

        let normalizedDebts = [...debtsFromExpenses, ...paymentAdjustments];
        if (!normalizedDebts.length && settlementsForGroup.length) {
          const fallbackDebts: RawDebt[] = [];
          settlementsForGroup.forEach((payment) => {
            const amount = roundToTwo(payment.amount);
            if (amount <= DISPLAY_THRESHOLD) {
              return;
            }
            fallbackDebts.push({
              amount,
              fromMemberId: payment.from,
              toMemberId: payment.to,
              occurredAt: detail.createdAt ?? null,
            });
          });
          normalizedDebts = fallbackDebts;
        }

        nextRawGroups.push({
          groupId: groupMeta.groupId,
          groupName: groupMeta.groupName,
          memberNames: memberNamesRecord,
          debts: normalizedDebts,
        });
      });

      setRawGroups(nextRawGroups);
    } catch (err) {
      console.error('Error loading balance information:', err);
      const message = err instanceof Error ? err.message : 'No se pudo cargar tu balance';
      setError(message);
      setRawGroups([]);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        void loadBalance({ silent: true });
      }
    }
  }, [api]);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const scheduleBackgroundRefresh = useCallback(() => {
    if (isFetchingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    if (refreshTimerRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void loadBalance({ silent: true });
    }, 250);
  }, [loadBalance]);

  const handleRealtimeEvent = useCallback(() => {
    scheduleBackgroundRefresh();
  }, [scheduleBackgroundRefresh]);

  useEffect(() => {
    const registry = subscriptionsRef.current;

    if (!currentMemberId) {
      if (registry.user) {
        registry.user();
        registry.user = undefined;
      }
      return undefined;
    }

    if (registry.user) {
      registry.user();
    }

    registry.user = subscribeToUserEvents(currentMemberId, handleRealtimeEvent);

    return () => {
      if (registry.user) {
        registry.user();
        registry.user = undefined;
      }
    };
  }, [currentMemberId, subscribeToUserEvents, handleRealtimeEvent]);

  useEffect(() => {
    const registry = subscriptionsRef.current;
    const nextGroupIds = new Set(rawGroups.map((group) => group.groupId));

    registry.groups.forEach((unsubscribe, groupId) => {
      if (!nextGroupIds.has(groupId)) {
        unsubscribe();
        registry.groups.delete(groupId);
      }
    });

    nextGroupIds.forEach((groupId) => {
      if (registry.groups.has(groupId)) {
        return;
      }
      registry.groups.set(groupId, subscribeToGroupEvents(groupId, handleRealtimeEvent));
    });
  }, [rawGroups, subscribeToGroupEvents, handleRealtimeEvent]);

  useEffect(() => {
    const registry = subscriptionsRef.current;
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      if (registry.user) {
        registry.user();
        registry.user = undefined;
      }
      registry.groups.forEach((unsubscribe) => {
        unsubscribe();
      });
      registry.groups.clear();
      pendingRefreshRef.current = false;
      isFetchingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (filters.groupId === "all") {
      return;
    }
    const exists = rawGroups.some((group) => group.groupId === filters.groupId);
    if (!exists) {
      setFilters(DEFAULT_FILTERS);
      setFilterDraft(DEFAULT_FILTERS);
      setCustomDraft({ start: "", end: "" });
    }
  }, [filters.groupId, rawGroups]);

  useEffect(() => {
    const { groupBreakdown: nextGroups, personBreakdown: nextPeople } = buildFilteredBreakdowns(
      rawGroups,
      filters,
      currentMemberId
    );
    setGroupBreakdown(nextGroups);
    setPersonBreakdown(nextPeople);
  }, [rawGroups, filters, currentMemberId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBalance({ silent: true });
    setRefreshing(false);
  }, [loadBalance]);

  const handleOpenFilters = useCallback(() => {
    setFilterDraft(filters);
    setCustomDraft({
      start: toInputDate(filters.startDate),
      end: toInputDate(filters.endDate),
    });
    setFilterModalVisible(true);
  }, [filters]);

  const handleCloseFilters = useCallback(() => {
    setFilterModalVisible(false);
  }, []);

  const handleSelectDateRange = useCallback((option: DateRangeOption) => {
    setFilterDraft((prev) => ({ ...prev, dateRange: option }));
  }, []);

  const handleSelectGroup = useCallback((groupId: number | "all") => {
    setFilterDraft((prev) => ({ ...prev, groupId }));
  }, []);

  const handleCustomStartChange = useCallback((value: string) => {
    setCustomDraft((prev) => ({ ...prev, start: value }));
    setFilterDraft((prev) => ({ ...prev, dateRange: "custom" }));
  }, []);

  const handleCustomEndChange = useCallback((value: string) => {
    setCustomDraft((prev) => ({ ...prev, end: value }));
    setFilterDraft((prev) => ({ ...prev, dateRange: "custom" }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setFilterDraft(DEFAULT_FILTERS);
    setCustomDraft({ start: "", end: "" });
    setFilterModalVisible(false);
  }, []);

  const handleApplyFilters = useCallback(() => {
    if (filterDraft.dateRange === "custom") {
      const start = parseDateInput(customDraft.start);
      const end = parseDateInput(customDraft.end);

      if (!start || !end) {
        Alert.alert("Rango inválido", "Ingresa fechas válidas con formato AAAA-MM-DD.");
        return;
      }

      if (start.getTime() > end.getTime()) {
        Alert.alert("Rango inválido", "La fecha de inicio no puede ser posterior a la fecha de fin.");
        return;
      }

      setFilters({
        ...filterDraft,
        startDate: startOfDay(start).toISOString(),
        endDate: endOfDay(end).toISOString(),
      });
    } else {
      setFilters({
        ...filterDraft,
        startDate: null,
        endDate: null,
      });
    }

    setFilterModalVisible(false);
  }, [customDraft.end, customDraft.start, filterDraft]);

  const handleNotificationsPress = useCallback(() => {
    Alert.alert("Notificaciones", "Pronto podrás ver tus notificaciones aquí.");
  }, []);

  const handleMarkAsPaid = useCallback(
    async (entry: SettlementEntry) => {
      if (!currentMemberId || entry.fromMemberId !== currentMemberId) {
        return;
      }

      try {
        setActionLoadingId(entry.id);
        await api.createPayment({
          amount: entry.amount,
          fromMemberId: entry.fromMemberId,
          toMemberId: entry.toMemberId,
          groupId: entry.groupId,
          note: `Liquidación ${entry.groupName}`,
        });

  Alert.alert('Pago registrado', `Se registró un pago de ${formatCurrency(entry.amount)} a ${entry.toName}.`);
  await loadBalance({ silent: true });
      } catch (err) {
        console.error('Error registering payment:', err);
        Alert.alert('No se pudo registrar el pago', err instanceof Error ? err.message : 'Intenta nuevamente más tarde.');
      } finally {
        setActionLoadingId(null);
      }
    },
    [api, currentMemberId, formatCurrency, loadBalance]
  );

  const handleReminder = useCallback(async (entry: SettlementEntry) => {
    const amountLabel = formatCurrency(entry.amount);
    const memo = `Pago pendiente grupo ${entry.groupName}`;

    const deepLink = ExpoLinking.createURL("/group-details", {
      queryParams: {
        groupId: entry.groupId.toString(),
        action: "recordPayment",
        fromMember: entry.fromMemberId.toString(),
        toMember: entry.toMemberId.toString(),
        amount: entry.amount.toFixed(2),
        method: "transfer",
        memo,
      },
    });

    const appBaseUrl = process.env.EXPO_PUBLIC_APP_BASE_URL;
    const normalizedAppBaseUrl = typeof appBaseUrl === "string" && appBaseUrl.trim().length > 0
      ? appBaseUrl.replace(/\/$/, "")
      : null;

    const queryParams = new URLSearchParams({
      groupId: entry.groupId.toString(),
      action: "recordPayment",
      fromMember: entry.fromMemberId.toString(),
      toMember: entry.toMemberId.toString(),
      amount: entry.amount.toFixed(2),
      method: "transfer",
      memo,
    }).toString();

    const webLink = normalizedAppBaseUrl
      ? `${normalizedAppBaseUrl}/group-details?${queryParams}`
      : null;

    const reminderLines = [
      `Hola ${entry.fromName}, recuerda que tienes pendiente ${amountLabel} del grupo "${entry.groupName}" en YoPago.`,
      "",
      "Registra el pago, adjunta comprobante o marca que pagaste en efectivo.",
    ];

    if (deepLink) {
      reminderLines.push("", `Registra tu pago desde la app: ${deepLink}`);
    }

    if (webLink) {
      reminderLines.push(`O desde el navegador: ${webLink}`);
    }

    const reminderMessage = `${reminderLines.join("\n")}\n\nGracias por ponerte al día 🙌`;
    const whatsappDeepLink = `whatsapp://send?text=${encodeURIComponent(reminderMessage)}`;
    const whatsappWebLink = `https://wa.me/?text=${encodeURIComponent(reminderMessage)}`;

    try {
      const canOpenWhatsapp = await Linking.canOpenURL(whatsappDeepLink);
      if (canOpenWhatsapp) {
        await Linking.openURL(whatsappDeepLink);
        return;
      }

      await Linking.openURL(whatsappWebLink);
    } catch (whatsAppError) {
      console.error('No se pudo abrir WhatsApp para el recordatorio:', whatsAppError);
      try {
        await Share.share({
          message: reminderMessage,
          title: `Recordatorio para ${entry.fromName}`,
          url: webLink ?? deepLink,
        });
      } catch (shareError) {
        console.error('No se pudo compartir el recordatorio:', shareError);
        Alert.alert(
          'No se pudo abrir WhatsApp',
          'Intenta nuevamente más tarde o envía el recordatorio manualmente.'
        );
      }
    }
  }, [formatCurrency]);

  if (isLoading && !refreshing) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.primary} />
        <ThemedText style={{ marginTop: palette.spacing.md, color: palette.textMuted }}>
          Cargando tu balance...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, backgroundColor: palette.background }}>
      <Modal
        transparent
        visible={filterModalVisible}
        animationType="fade"
        onRequestClose={handleCloseFilters}
      >
        <View style={styles.filterModalOverlay}>
          <Pressable style={styles.filterModalBackdrop} onPress={handleCloseFilters} />
          <View style={[styles.filterModalContent, { backgroundColor: palette.surface }]}>
            <View style={styles.filterModalHeader}>
              <ThemedText variant="headline" weight="semiBold" style={styles.filterModalTitle}>
                Filtros
              </ThemedText>
              <Pressable
                accessibilityLabel="Cerrar filtros"
                accessibilityRole="button"
                onPress={handleCloseFilters}
                hitSlop={12}
                style={styles.filterModalCloseButton}
              >
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
            </View>

            <View style={styles.filterSection}>
              <ThemedText variant="bodyBold" style={styles.filterSectionTitle}>Rango de fechas</ThemedText>
              <View style={styles.filterOptionsRow}>
                {DATE_RANGE_OPTIONS.map((option) => {
                  const isActive = filterDraft.dateRange === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      style={[styles.filterOption, isActive && styles.filterOptionActive]}
                      onPress={() => handleSelectDateRange(option.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <ThemedText
                        variant="label"
                        weight="semiBold"
                        style={[styles.filterOptionText, isActive && styles.filterOptionTextActive]}
                      >
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {filterDraft.dateRange === "custom" ? (
                <View style={styles.filterCustomRow}>
                  <View style={styles.filterInputWrapper}>
                    <ThemedText variant="label" style={styles.filterInputLabel}>Desde</ThemedText>
                    <TextInput
                      style={styles.filterInput}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={applyAlpha(palette.textMuted, 0.6)}
                      value={customDraft.start}
                      onChangeText={handleCustomStartChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                    />
                  </View>
                  <View style={styles.filterInputWrapper}>
                    <ThemedText variant="label" style={styles.filterInputLabel}>Hasta</ThemedText>
                    <TextInput
                      style={styles.filterInput}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={applyAlpha(palette.textMuted, 0.6)}
                      value={customDraft.end}
                      onChangeText={handleCustomEndChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                    />
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.filterSection}>
              <ThemedText variant="bodyBold" style={styles.filterSectionTitle}>Grupo</ThemedText>
              <View style={styles.filterGroupList}>
                <Pressable
                  style={[
                    styles.filterListItem,
                    filterDraft.groupId === "all" && styles.filterListItemActive,
                  ]}
                  onPress={() => handleSelectGroup("all")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filterDraft.groupId === "all" }}
                >
                  <ThemedText
                    variant="body"
                    weight={filterDraft.groupId === "all" ? "semiBold" : undefined}
                    style={[
                      styles.filterListItemText,
                      filterDraft.groupId === "all" && styles.filterListItemTextActive,
                    ]}
                  >
                    Todos los grupos
                  </ThemedText>
                  {filterDraft.groupId === "all" ? (
                    <Ionicons name="checkmark" size={18} color={palette.primary} />
                  ) : null}
                </Pressable>

                <View style={styles.filterGroupScroll}>
                  <ScrollView contentContainerStyle={styles.filterGroupScrollContent}>
                    {rawGroups.map((group) => {
                      const isActive = filterDraft.groupId === group.groupId;
                      return (
                        <Pressable
                          key={group.groupId}
                          style={[styles.filterListItem, isActive && styles.filterListItemActive]}
                          onPress={() => handleSelectGroup(group.groupId)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                        >
                          <ThemedText
                            variant="body"
                            weight={isActive ? "semiBold" : undefined}
                            style={[
                              styles.filterListItemText,
                              isActive && styles.filterListItemTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {group.groupName}
                          </ThemedText>
                          {isActive ? (
                            <Ionicons name="checkmark" size={18} color={palette.primary} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>

            <View style={styles.filterActionsRow}>
              <Pressable
                style={styles.filterResetButton}
                onPress={handleResetFilters}
                accessibilityRole="button"
              >
                <ThemedText variant="label" weight="semiBold" style={styles.filterResetButtonText}>
                  Restablecer
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.filterApplyButton}
                onPress={handleApplyFilters}
                accessibilityRole="button"
              >
                <ThemedText variant="label" weight="semiBold" style={styles.filterApplyButtonText}>
                  Aplicar
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View
        style={[styles.headerSection, { paddingTop: insets.top + palette.spacing.sm }]}
        onLayout={handleHeaderLayout}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerSidePlaceholder} />
          <View style={styles.headerTitleWrapper}>
            <IconSymbol name="chart.pie.fill" size={20} color={palette.primary} />
            <ThemedText variant="headline" weight="bold" style={styles.headerTitle}>
              Balance
            </ThemedText>
          </View>
          <Pressable
            style={styles.headerActionButton}
            onPress={handleNotificationsPress}
            accessibilityRole="button"
            accessibilityLabel="Ver notificaciones"
            hitSlop={12}
          >
            <Ionicons name="notifications-outline" size={20} color={palette.text} />
          </Pressable>
        </View>
        <View style={styles.headerBottomRow}>
          <View style={styles.filterSummaryGroup}>
            <IconSymbol name="line.3.horizontal.decrease.circle" size={16} color={palette.textMuted} />
            <ThemedText variant="label" style={styles.filterSummaryText} numberOfLines={1}>
              {filterSummary}
            </ThemedText>
          </View>
          <Pressable
            style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
            onPress={handleOpenFilters}
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros de balance"
            hitSlop={12}
          >
            <Ionicons
              name="filter-outline"
              size={18}
              color={hasActiveFilters ? palette.primary : palette.text}
              style={styles.filterButtonIcon}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: insets.bottom + palette.spacing.lg },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.cardFullWidth, styles.summaryCard, {padding: palette.spacing.lg, borderRadius: palette.radius.lg}]}> 
          <View style={[styles.summaryHeader, {marginBottom: palette.spacing.md}]}> 
            <View style={styles.summaryIconWrap}> 
              <IconSymbol name="chart.pie.fill" size={24} color={palette.primary} /> 
            </View> 
            <View style={styles.summaryTitleGroup}> 
              <ThemedText variant="title" weight="bold" style={styles.summaryTitle}>
                Balance personal
              </ThemedText> 
              {memberName ? ( 
                <ThemedText variant="label" style={styles.summarySubtitle} numberOfLines={1}>
                  {memberName}
                </ThemedText> 
              ) : null} 
            </View> 
          </View> 

          <View style={[styles.summaryGrid, {marginBottom: palette.spacing.md}]}> 
            <View style={[styles.summaryMetric, {padding: palette.spacing.md, borderRadius: palette.radius.md}]}> 
              <ThemedText variant="label" style={{ color: palette.textMuted }}>Te deben</ThemedText> 
              <ThemedText variant="title" weight="bold" style={{ color: palette.success }}> 
                {formatCurrency(totals.owedToYou)} 
              </ThemedText> 
            </View> 
            <View style={[styles.summaryMetric, {padding: palette.spacing.md, borderRadius: palette.radius.md}]}> 
              <ThemedText variant="label" style={{ color: palette.textMuted }}>Tú debes</ThemedText> 
              <ThemedText variant="title" weight="bold" style={{ color: palette.warning }}> 
                {formatCurrency(totals.youOwe)} 
              </ThemedText> 
            </View> 
          </View> 

          <View style={[styles.flowRow, styles.summaryBadgeRow, {marginBottom: palette.spacing.sm}]}> 
            <View 
              style={[ 
                styles.netChip, 
                netIsPositive ? styles.netChipPositive : styles.netChipNegative, 
                {paddingVertical: palette.spacing.xs, paddingHorizontal: palette.spacing.md} 
              ]} 
            > 
              <ThemedText 
                variant="bodyBold"
                weight="semiBold"
                style={[ 
                  styles.netChipText, 
                  netIsPositive ? styles.netChipTextPositive : styles.netChipTextNegative 
                ]} 
              > 
                Balance neto {formatCurrency(totals.net)} 
              </ThemedText> 
            </View> 
            <ThemedText variant="label" style={styles.summaryDescription} numberOfLines={2}> 
              {netFlowText} 
            </ThemedText> 
          </View> 

          {error ? ( 
            <Pressable
              style={styles.errorBanner}
              onPress={() => {
                void loadBalance();
              }}
            > 
              <ThemedText variant="bodyBold" style={styles.errorText}>{error}</ThemedText> 
              <ThemedText variant="label" weight="semiBold" style={styles.errorAction}>Reintentar</ThemedText> 
            </Pressable> 
          ) : null} 
        </Card>

        <View style={styles.sectionContainer}> 
          <Card style={[styles.cardFullWidth, styles.sectionCard, {padding: palette.spacing.lg, borderRadius: palette.radius.lg}]}> 
            <View style={[styles.sectionHeader, {marginBottom: palette.spacing.sm}]}> 
              <View style={{ flex: 1, gap: 4 }}> 
                <ThemedText variant="headline" weight="semiBold" style={{ color: palette.text }}>
                  Por grupo
                </ThemedText> 
                <ThemedText variant="label" style={styles.sectionDescription}> 
                  Visualiza cómo se reparten tus pendientes en cada grupo activo. 
                </ThemedText> 
              </View> 
              <View style={[styles.sectionIcon, { backgroundColor: applyAlpha(palette.primary, 0.16) }]}>  
                <IconSymbol name="person.3.fill" size={20} color={palette.primary} /> 
              </View> 
            </View> 

            {groupBreakdown.length === 0 ? ( 
              <View style={styles.emptyState}> 
                <ThemedText variant="label" style={{ color: palette.textMuted }}> 
                  No tienes saldos pendientes en tus grupos. 
                </ThemedText> 
              </View> 
            ) : ( 
              <View style={styles.listBody}> 
                {groupBreakdown.map((group) => ( 
                  <View key={group.groupId} style={[styles.listRow, {paddingVertical: palette.spacing.sm}]}> 
                    <View style={styles.listRowLeft}> 
                      <View style={[styles.rowIcon, { backgroundColor: applyAlpha(palette.primary700, 0.14), width: 40, height: 40 }]}>  
                        <IconSymbol name="folder.fill" size={18} color={palette.primary700} /> 
                      </View> 
                      <View style={{ flex: 1, gap: 2 }}> 
                        <ThemedText variant="bodyBold" style={{ color: palette.text }} numberOfLines={1}> 
                          {group.groupName} 
                        </ThemedText> 
                        <ThemedText variant="label" style={styles.listRowMeta}> 
                          {group.settlements.length} movimiento(s) 
                        </ThemedText> 
                      </View> 
                    </View> 
                    <View style={styles.listRowAmounts}> 
                      <View 
                        style={[ 
                          styles.amountChip, 
                          styles.amountChipPositive, 
                          group.owedToYou <= DISPLAY_THRESHOLD && styles.amountChipMuted, 
                        ]} 
                      > 
                        <ThemedText variant="bodyBold" style={styles.amountChipText}> 
                          {formatCurrency(group.owedToYou)} 
                        </ThemedText> 
                      </View> 
                      <View 
                        style={[ 
                          styles.amountChip, 
                          styles.amountChipNegative, 
                          group.youOwe <= DISPLAY_THRESHOLD && styles.amountChipMuted, 
                        ]} 
                      > 
                        <ThemedText variant="bodyBold" style={styles.amountChipText}> 
                          {formatCurrency(group.youOwe)} 
                        </ThemedText> 
                      </View> 
                    </View> 
                  </View> 
                ))} 
              </View> 
            )} 
          </Card> 
        </View>

        <View style={styles.sectionContainer}> 
          <Card style={[styles.cardFullWidth, styles.sectionCard, {padding: palette.spacing.lg, borderRadius: palette.radius.lg}]}> 
            <View style={[styles.sectionHeader, {marginBottom: palette.spacing.sm}]}> 
              <View style={{ flex: 1, gap: 4 }}> 
                <ThemedText variant="headline" weight="semiBold" style={{ color: palette.text }}>
                  Por persona
                </ThemedText> 
                <ThemedText variant="label" style={styles.sectionDescription}> 
                  Resume cuánto debes o te deben tus contactos para cerrar cuentas. 
                </ThemedText> 
              </View> 
              <View style={[styles.sectionIcon, { backgroundColor: applyAlpha(palette.accent, 0.16) }]}>  
                <IconSymbol name="person.crop.circle" size={20} color={palette.accent} /> 
              </View> 
            </View> 

            {personBreakdown.length === 0 ? ( 
              <View style={styles.emptyState}> 
                <ThemedText variant="label" style={{ color: palette.textMuted }}> 
                  No tienes deudas pendientes con personas específicas. 
                </ThemedText> 
              </View> 
            ) : ( 
              <View style={styles.peopleList}> 
                {personBreakdown.map((person) => ( 
                  <View key={person.memberId} style={[styles.personRow, {paddingVertical: palette.spacing.sm}]}> 
                    <View style={styles.listRowLeft}> 
                      <View style={[styles.rowIcon, { backgroundColor: applyAlpha(palette.primary, 0.12), width: 40, height: 40 }]}>  
                        <IconSymbol name="person.fill" size={18} color={palette.primary} /> 
                      </View> 
                      <View style={{ flex: 1, gap: 2 }}> 
                        <ThemedText variant="bodyBold" style={{ color: palette.text }} numberOfLines={1}> 
                          {person.name} 
                        </ThemedText> 
                        <View style={styles.personChips}> 
                          {person.owedToYou > DISPLAY_THRESHOLD ? ( 
                            <View style={[styles.chip, styles.chipPositive]}> 
                              <ThemedText variant="label" weight="semiBold" style={styles.chipText}> 
                                +{formatCurrency(person.owedToYou)} 
                              </ThemedText> 
                            </View> 
                          ) : null} 
                          {person.youOwe > DISPLAY_THRESHOLD ? ( 
                            <View style={[styles.chip, styles.chipNegative]}> 
                              <ThemedText variant="label" weight="semiBold" style={styles.chipText}> 
                                -{formatCurrency(person.youOwe)} 
                              </ThemedText> 
                            </View> 
                          ) : null} 
                        </View> 
                      </View> 
                    </View> 

                    {person.settlements.map((entry) => { 
                      const isOutgoing = entry.fromMemberId === currentMemberId; 
                      const isLoading = actionLoadingId === entry.id; 
                      return ( 
                        <View key={entry.id} style={[styles.settlementRow, {marginTop: palette.spacing.xs}]}> 
                          <View style={{ flex: 1, gap: 2 }}> 
                            <ThemedText variant="label" weight="semiBold" style={{ color: palette.text }} numberOfLines={1}> 
                              {entry.groupName} 
                            </ThemedText> 
                            <ThemedText variant="label" style={styles.listRowMeta} numberOfLines={1}> 
                              {isOutgoing 
                                ? `Pagas ${formatCurrency(entry.amount)} a ${entry.toName}` 
                                : `${entry.fromName} debe ${formatCurrency(entry.amount)}`} 
                            </ThemedText> 
                          </View> 
                          <Pressable 
                            style={[ 
                              styles.actionButton, 
                              isOutgoing 
                                ? getActionStyles("markPaid", palette) 
                                : getActionStyles("remind", palette), 
                              isLoading && styles.actionButtonDisabled, 
                              {minWidth: 120, paddingVertical: palette.spacing.xs, paddingHorizontal: palette.spacing.md} 
                            ]} 
                            onPress={() => { 
                              if (isOutgoing) { 
                                void handleMarkAsPaid(entry); 
                              } else { 
                                void handleReminder(entry); 
                              } 
                            }} 
                            disabled={isLoading} 
                          > 
                            {isLoading ? ( 
                              <ActivityIndicator size="small" color={palette.primary} /> 
                            ) : ( 
                              <ThemedText 
                                variant="label"
                                weight="semiBold"
                                style={getActionTextStyles( 
                                  isOutgoing ? "markPaid" : "remind", 
                                  palette 
                                )} 
                              > 
                                {isOutgoing ? "Marcar pago" : "Recordar"} 
                              </ThemedText> 
                            )} 
                          </Pressable> 
                        </View> 
                      ); 
                    })} 
                  </View> 
                ))} 
              </View> 
            )} 
          </Card> 
        </View>
      </ScrollView>
    </ThemedView>
  );
}


type ActionVariant = "markPaid" | "remind";

const getActionStyles = (variant: ActionVariant, palette: AppPalette) => {
  const background =
    variant === "markPaid"
      ? applyAlpha(palette.success, 0.16)
      : applyAlpha(palette.primary, 0.16);
  const border =
    variant === "markPaid"
      ? applyAlpha(palette.success, 0.32)
      : applyAlpha(palette.primary, 0.32);
  return {
    backgroundColor: background,
    borderColor: border,
  };
};

const getActionTextStyles = (variant: ActionVariant, palette: AppPalette): TextStyle => ({
  color: variant === "markPaid" ? palette.success : palette.primary,
  textAlign: "center",
});

const buildFilterSummary = (filter: FilterState, groups: RawGroupData[]): string => {
  const dateLabel = getDateLabelForFilter(filter);
  const groupLabel =
    filter.groupId === "all"
      ? "Todos los grupos"
      : groups.find((group) => group.groupId === filter.groupId)?.groupName ?? "Grupo seleccionado";

  return `${dateLabel} • ${groupLabel}`;
};

const buildFilteredBreakdowns = (
  groupsData: RawGroupData[],
  filter: FilterState,
  memberId: number | null
): { groupBreakdown: GroupBreakdown[]; personBreakdown: PersonBreakdown[] } => {
  if (!memberId) {
    return { groupBreakdown: [], personBreakdown: [] };
  }

  const { startTime, endTime } = resolveDateBounds(filter);
  const selectedGroupId = filter.groupId;

  const groupResults: GroupBreakdown[] = [];
  const personMap = new Map<number, PersonBreakdown>();

  groupsData.forEach((group) => {
    if (selectedGroupId !== "all" && group.groupId !== selectedGroupId) {
      return;
    }

    const filteredDebts = group.debts.filter((debt) => {
      if (!Number.isFinite(debt.amount) || debt.amount <= DISPLAY_THRESHOLD) {
        return false;
      }
      const debtTime = getTimeOrNull(debt.occurredAt);
      if (startTime !== null && debtTime !== null && debtTime < startTime) {
        return false;
      }
      if (endTime !== null && debtTime !== null && debtTime > endTime) {
        return false;
      }
      return true;
    });

    if (!filteredDebts.length) {
      if (selectedGroupId !== "all" && group.groupId === selectedGroupId) {
        groupResults.push({
          groupId: group.groupId,
          groupName: group.groupName,
          youOwe: 0,
          owedToYou: 0,
          settlements: [],
        });
      }
      return;
    }

    const balances: Record<number, number> = {};
    const pairDates = new Map<string, string | null>();

    filteredDebts.forEach((debt) => {
      balances[debt.fromMemberId] = roundToTwo((balances[debt.fromMemberId] ?? 0) - debt.amount);
      balances[debt.toMemberId] = roundToTwo((balances[debt.toMemberId] ?? 0) + debt.amount);

      if (debt.occurredAt) {
        const key = `${debt.fromMemberId}->${debt.toMemberId}`;
        const current = pairDates.get(key);
        if (!current || (getTimeOrNull(debt.occurredAt) ?? 0) > (getTimeOrNull(current) ?? 0)) {
          pairDates.set(key, debt.occurredAt);
        }
      }
    });

    const settlements = computeSettlementMatrix(balances)
      .map((payment, index) => {
        const amount = roundToTwo(payment.amount);
        if (amount <= DISPLAY_THRESHOLD) {
          return null;
        }
        const key = `${payment.from}->${payment.to}`;
        const occurredAt = pairDates.get(key) ?? null;
        const fromName =
          group.memberNames[payment.from] ??
          group.memberNames[String(payment.from)] ??
          `Miembro ${payment.from}`;
        const toName =
          group.memberNames[payment.to] ??
          group.memberNames[String(payment.to)] ??
          `Miembro ${payment.to}`;

        return {
          id: `${group.groupId}-${payment.from}-${payment.to}-${index}`,
          groupId: group.groupId,
          groupName: group.groupName,
          fromMemberId: payment.from,
          toMemberId: payment.to,
          amount,
          fromName,
          toName,
          occurredAt,
        } as SettlementEntry;
      })
      .filter((entry): entry is SettlementEntry => entry !== null);

    if (!settlements.length) {
      if (selectedGroupId !== "all" && group.groupId === selectedGroupId) {
        groupResults.push({
          groupId: group.groupId,
          groupName: group.groupName,
          youOwe: 0,
          owedToYou: 0,
          settlements: [],
        });
      }
      return;
    }

    let youOwe = 0;
    let owedToYou = 0;

    settlements.forEach((entry) => {
      if (entry.fromMemberId === memberId) {
        youOwe += entry.amount;
      }
      if (entry.toMemberId === memberId) {
        owedToYou += entry.amount;
      }

      if (entry.fromMemberId === memberId || entry.toMemberId === memberId) {
        const counterpartId = entry.fromMemberId === memberId ? entry.toMemberId : entry.fromMemberId;
        const counterpartName =
          group.memberNames[counterpartId] ??
          group.memberNames[String(counterpartId)] ??
          `Miembro ${counterpartId}`;
        const existing = personMap.get(counterpartId) ?? {
          memberId: counterpartId,
          name: counterpartName,
          youOwe: 0,
          owedToYou: 0,
          settlements: [],
        };

        if (entry.fromMemberId === memberId) {
          existing.youOwe += entry.amount;
        } else {
          existing.owedToYou += entry.amount;
        }

        existing.settlements.push(entry);
        personMap.set(counterpartId, existing);
      }
    });

    groupResults.push({
      groupId: group.groupId,
      groupName: group.groupName,
      youOwe: roundToTwo(youOwe),
      owedToYou: roundToTwo(owedToYou),
      settlements,
    });
  });

  const personBreakdown = Array.from(personMap.values())
    .map((person) => ({
      ...person,
      youOwe: roundToTwo(person.youOwe),
      owedToYou: roundToTwo(person.owedToYou),
    }))
    .filter((person) => person.youOwe > DISPLAY_THRESHOLD || person.owedToYou > DISPLAY_THRESHOLD);

  groupResults.sort((a, b) => b.owedToYou - a.owedToYou);

  return { groupBreakdown: groupResults, personBreakdown };
};

const buildExpenseDebts = (detail: GroupDetailsResponse): RawDebt[] => {
  const expenses = Array.isArray(detail.expenses) ? detail.expenses : [];
  const debts: RawDebt[] = [];

  expenses.forEach((expense) => {
    const payerCandidate =
      (expense?.payer as { id?: number; memberId?: number } | undefined)?.id ??
      (expense?.payer as { id?: number; memberId?: number } | undefined)?.memberId ??
      (expense?.paidBy as { id?: number; memberId?: number } | undefined)?.id ??
      (typeof expense?.paidBy === "number" ? (expense.paidBy as number) : undefined);
    const payerId = toNumber(payerCandidate);
    if (payerId === null) {
      return;
    }

    const expenseAmount = typeof expense.amount === "number" ? expense.amount : Number(expense?.amount ?? 0);
    if (!Number.isFinite(expenseAmount) || expenseAmount <= DISPLAY_THRESHOLD) {
      return;
    }

    const sharesArray = Array.isArray(expense.shares) ? expense.shares : [];
    const normalizedShares: { memberId: number; amount: number }[] = [];

    sharesArray.forEach((share) => {
      const memberId = toNumber(
        (share as { memberId?: number })?.memberId ??
          (share as { member?: { id?: number; memberId?: number } })?.member?.id ??
          (share as { member?: { id?: number; memberId?: number } })?.member?.memberId
      );

      let amount = typeof share?.amount === "number" ? share.amount : Number((share as { amount?: number })?.amount ?? 0);
      if (!Number.isFinite(amount) && typeof share?.percentage === "number") {
        amount = roundToTwo(((share.percentage ?? 0) / 100) * expenseAmount);
      }

      if (memberId !== null && Number.isFinite(amount) && amount > DISPLAY_THRESHOLD) {
        normalizedShares.push({ memberId, amount: roundToTwo(amount) });
      }
    });

    if (!normalizedShares.length) {
      const participantsSource =
        Array.isArray(expense.splitAmong) && expense.splitAmong.length > 0 ? expense.splitAmong : detail.members;
      const participantIds = participantsSource
        .map((member) => toNumber((member as { id?: number; memberId?: number })?.id ?? (member as { memberId?: number })?.memberId))
        .filter((id): id is number => id !== null);

      if (participantIds.length) {
        const evenShare = roundToTwo(expenseAmount / participantIds.length);
        participantIds.forEach((participantId) => {
          if (participantId !== null && evenShare > DISPLAY_THRESHOLD) {
            normalizedShares.push({ memberId: participantId, amount: evenShare });
          }
        });
      }
    }

    const expenseDate =
      typeof expense.date === "string" && expense.date.trim().length > 0
        ? expense.date
        : typeof expense.createdAt === "string" && expense.createdAt.trim().length > 0
          ? expense.createdAt
          : detail.createdAt ?? null;

    normalizedShares.forEach(({ memberId, amount }) => {
      if (memberId === payerId || amount <= DISPLAY_THRESHOLD) {
        return;
      }

      debts.push({
        amount,
        fromMemberId: memberId,
        toMemberId: payerId,
        occurredAt: expenseDate ?? null,
      });
    });
  });

  return debts;
};

const buildConfirmedPaymentDebts = (detail: GroupDetailsResponse): RawDebt[] => {
  const payments = Array.isArray(detail.confirmedPayments) ? detail.confirmedPayments : [];
  const debts: RawDebt[] = [];

  payments.forEach((payment) => {
    const amount = typeof payment?.amount === "number" ? payment.amount : Number(payment?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= DISPLAY_THRESHOLD) {
      return;
    }

    const payerId = toNumber(
      (payment.fromMember as { id?: number } | undefined)?.id ??
        (typeof payment.fromMember === "number" ? payment.fromMember : undefined)
    );
    const receiverId = toNumber(
      (payment.toMember as { id?: number } | undefined)?.id ??
        (typeof payment.toMember === "number" ? payment.toMember : undefined)
    );

    if (payerId === null || receiverId === null) {
      return;
    }

    debts.push({
      amount: roundToTwo(amount),
      fromMemberId: receiverId,
      toMemberId: payerId,
      occurredAt: typeof payment?.createdAt === "string" ? payment.createdAt : null,
    });
  });

  return debts;
};

const resolveDateBounds = (filter: FilterState): { startTime: number | null; endTime: number | null } => {
  if (filter.dateRange === "7d") {
    const now = new Date();
    const end = endOfDay(now);
    const start = startOfDay(new Date(end.getTime() - 6 * MS_IN_DAY));
    return { startTime: start.getTime(), endTime: end.getTime() };
  }

  if (filter.dateRange === "30d") {
    const now = new Date();
    const end = endOfDay(now);
    const start = startOfDay(new Date(end.getTime() - 29 * MS_IN_DAY));
    return { startTime: start.getTime(), endTime: end.getTime() };
  }

  if (filter.dateRange === "custom") {
    const start = filter.startDate ? startOfDay(new Date(filter.startDate)) : null;
    const end = filter.endDate ? endOfDay(new Date(filter.endDate)) : null;
    return {
      startTime: start ? start.getTime() : null,
      endTime: end ? end.getTime() : null,
    };
  }

  return { startTime: null, endTime: null };
};

const getTimeOrNull = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
};

const getDateLabelForFilter = (filter: FilterState): string => {
  switch (filter.dateRange) {
    case "7d":
      return "Últimos 7 días";
    case "30d":
      return "Últimos 30 días";
    case "custom": {
      const startLabel = formatDisplayDate(filter.startDate);
      const endLabel = formatDisplayDate(filter.endDate);
      if (startLabel && endLabel) {
        return `${startLabel} al ${endLabel}`;
      }
      if (startLabel) {
        return `Desde ${startLabel}`;
      }
      if (endLabel) {
        return `Hasta ${endLabel}`;
      }
      return "Personalizado";
    }
    default:
      return "Todo el tiempo";
  }
};

const formatDisplayDate = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
};

const parseDateInput = (value: string): Date | null => {
  const sanitized = value.trim();
  if (!sanitized) {
    return null;
  }
  if (!ISO_DATE_REGEX.test(sanitized)) {
    return null;
  }
  const date = new Date(`${sanitized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toInputDate = (value: string | null): string => {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
};

const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const buildMemberNameMap = (
  aggregatedShares: AggregatedShare[] | undefined,
  members: GroupDetailsResponse["members"] | undefined
) => {
  const nameMap = new Map<number, string>();
  if (Array.isArray(members)) {
    members.forEach((member) => {
      const id = toNumber(member?.id);
      if (id !== null) {
        const name = typeof member?.name === "string" && member.name.trim().length > 0
          ? member.name
          : typeof member?.email === "string"
            ? member.email
            : undefined;
        if (name) {
          nameMap.set(id, name);
        }
      }
    });
  }
  if (Array.isArray(aggregatedShares)) {
    aggregatedShares.forEach((share) => {
      const id = toNumber(share?.memberId);
      if (id !== null && !nameMap.has(id)) {
        const name = typeof share?.memberName === "string" && share.memberName.trim().length > 0
          ? share.memberName
          : undefined;
        if (name) {
          nameMap.set(id, name);
        }
      }
    });
  }
  return nameMap;
};

const extractBalances = (detail: GroupDetailsResponse) => {
  const rawBalances = detail.balanceAdjusted ?? detail.balanceOriginal ?? {};
  const result: Record<number, number> = {};
  for (const [key, value] of Object.entries(rawBalances ?? {})) {
    const memberId = toNumber(key);
    const numericValue = typeof value === "number" ? value : Number(value);
    if (memberId !== null && Number.isFinite(numericValue)) {
      result[memberId] = roundToTwo(numericValue);
    }
  }
  if (!Object.keys(result).length && Array.isArray(detail.aggregatedShares)) {
    detail.aggregatedShares.forEach((share) => {
      const memberId = toNumber(share?.memberId);
      const balance = typeof share?.balance === "number" ? share.balance : Number(share?.balance);
      if (memberId !== null && Number.isFinite(balance)) {
        result[memberId] = roundToTwo(balance);
      }
    });
  }
  return result;
};

const computeSettlementMatrix = (balances: Record<number, number>) => {
  const debtors: { id: number; amount: number }[] = [];
  const creditors: { id: number; amount: number }[] = [];

  Object.entries(balances).forEach(([key, value]) => {
    const id = Number(key);
    const balance = roundToTwo(value);
    if (Math.abs(balance) <= DISPLAY_THRESHOLD) {
      return;
    }
    if (balance < 0) {
      debtors.push({ id, amount: roundToTwo(-balance) });
    } else {
      creditors.push({ id, amount: roundToTwo(balance) });
    }
  });

  const payments: { from: number; to: number; amount: number }[] = [];

  debtors.forEach((debtor) => {
    let remaining = debtor.amount;
    for (const creditor of creditors) {
      if (remaining <= DISPLAY_THRESHOLD) {
        break;
      }
      if (creditor.amount <= DISPLAY_THRESHOLD) {
        continue;
      }
      const payAmount = Math.min(remaining, creditor.amount);
      if (payAmount <= DISPLAY_THRESHOLD) {
        continue;
      }
      const rounded = roundToTwo(payAmount);
      payments.push({ from: debtor.id, to: creditor.id, amount: rounded });
      creditor.amount = roundToTwo(creditor.amount - rounded);
      remaining = roundToTwo(remaining - rounded);
    }
  });

  return payments;
};

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const applyAlpha = (hexColor: string, alpha: number) => {
  const sanitized = hexColor?.replace("#", "") ?? "";
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

const createStyles = (palette: AppPalette) => {
  const actionButtonSize = 40;
  const actionContainerWidth = actionButtonSize;

  return StyleSheet.create({
    screenContent: {
      paddingHorizontal: 14,
      paddingTop: palette.spacing.lg,
      gap: palette.spacing.lg,
    },
    cardFullWidth: {
      marginHorizontal: 0,
    },
    headerSection: {
      backgroundColor: palette.surface,
      paddingHorizontal: palette.spacing.lg,
      paddingTop: palette.spacing.lg,
      paddingBottom: palette.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: applyAlpha(palette.text, 0.08),
      ...palette.shadow.card,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: palette.spacing.sm,
      marginTop: palette.spacing.xs,
    },
    headerSidePlaceholder: {
      width: actionContainerWidth,
      height: actionButtonSize,
      marginRight: palette.spacing.sm,
    },
    headerTitleWrapper: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      columnGap: palette.spacing.xs,
      paddingHorizontal: palette.spacing.md,
    },
    headerTitle: {
      letterSpacing: 1,
      textTransform: "uppercase",
      color: palette.text,
    },
    headerActionButton: {
      width: actionButtonSize,
      height: actionButtonSize,
      borderRadius: palette.radius.md,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: applyAlpha(palette.text, 0.06),
      alignItems: "center",
      justifyContent: "center",
      ...palette.shadow.card,
      marginLeft: palette.spacing.sm,
    },
    headerBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: palette.spacing.sm,
      minHeight: 44,
      marginTop: 0,
      marginBottom: 0,
      paddingVertical: palette.spacing.xs,
    },
    filterSummaryGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: palette.spacing.xs,
      flex: 1,
      marginRight: palette.spacing.sm,
      paddingRight: palette.spacing.sm,
    },
    filterSummaryText: {
      color: palette.textMuted,
      fontSize: palette.font.small,
      flexShrink: 1,
    },
    filterButton: {
      width: actionButtonSize,
      height: actionButtonSize,
      borderRadius: palette.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.text, 0.12),
      backgroundColor: palette.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    filterButtonActive: {
      backgroundColor: applyAlpha(palette.primary, 0.16),
      borderColor: applyAlpha(palette.primary, 0.4),
    },
    filterButtonIcon: {},
    filterModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(10,15,25,0.55)",
      justifyContent: "flex-end",
    },
    filterModalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    filterModalContent: {
      paddingHorizontal: palette.spacing.lg,
      paddingVertical: palette.spacing.lg,
      borderTopLeftRadius: palette.radius.lg,
      borderTopRightRadius: palette.radius.lg,
      gap: palette.spacing.lg,
    },
    filterModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    filterModalTitle: {
      color: palette.text,
    },
    filterModalCloseButton: {
      width: 36,
      height: 36,
      borderRadius: palette.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.surfaceAlt,
    },
    filterSection: {
      gap: palette.spacing.sm,
    },
    filterSectionTitle: {
      color: palette.text,
    },
    filterOptionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: palette.spacing.xs,
    },
    filterOption: {
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.text, 0.12),
      backgroundColor: palette.surfaceAlt,
    },
    filterOptionActive: {
      backgroundColor: applyAlpha(palette.primary, 0.18),
      borderColor: applyAlpha(palette.primary, 0.4),
    },
    filterOptionText: {
      color: palette.textMuted,
    },
    filterOptionTextActive: {
      color: palette.primary,
    },
    filterCustomRow: {
      flexDirection: "row",
      gap: palette.spacing.sm,
    },
    filterInputWrapper: {
      flex: 1,
      gap: 6,
    },
    filterInputLabel: {
      color: palette.textMuted,
    },
    filterInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.text, 0.14),
      borderRadius: palette.radius.md,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      color: palette.text,
      backgroundColor: palette.surfaceAlt,
    },
    filterGroupList: {
      gap: palette.spacing.xs,
    },
    filterGroupScroll: {
      maxHeight: 200,
    },
    filterGroupScrollContent: {
      gap: palette.spacing.xs,
      paddingBottom: palette.spacing.xs,
    },
    filterListItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.sm,
      borderRadius: palette.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.text, 0.12),
      backgroundColor: palette.surfaceAlt,
    },
    filterListItemActive: {
      borderColor: applyAlpha(palette.primary, 0.45),
      backgroundColor: applyAlpha(palette.primary, 0.16),
    },
    filterListItemText: {
      color: palette.text,
      flex: 1,
      marginRight: palette.spacing.sm,
    },
    filterListItemTextActive: {
      color: palette.primary,
    },
    filterActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: palette.spacing.sm,
    },
    filterResetButton: {
      flex: 1,
      paddingVertical: palette.spacing.sm,
      borderRadius: palette.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.text, 0.2),
      alignItems: "center",
      justifyContent: "center",
    },
    filterResetButtonText: {
      color: palette.textMuted,
    },
    filterApplyButton: {
      flex: 1,
      paddingVertical: palette.spacing.sm,
      borderRadius: palette.radius.md,
      backgroundColor: palette.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    filterApplyButtonText: {
      color: palette.surface,
    },
    summaryCard: {
      gap: palette.spacing.md,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: palette.spacing.sm,
      flexWrap: "wrap",
    },
    summaryIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: applyAlpha(palette.primary, 0.15),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    summaryTitleGroup: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    summaryTitle: {
      color: palette.text,
      letterSpacing: 0.5,
    },
    summarySubtitle: {
      color: palette.textMuted,
    },
    summaryGrid: {
      flexDirection: "row",
      gap: palette.spacing.md,
      flexWrap: "wrap",
    },
    summaryMetric: {
      flex: 1,
      gap: 6,
      backgroundColor: palette.surfaceAlt,
      borderRadius: palette.radius.md,
      padding: palette.spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: applyAlpha(palette.text, 0.08),
      minWidth: 0,
    },
    summaryBadgeRow: {
      flexDirection: "row",
      gap: palette.spacing.sm,
      flexWrap: "wrap",
      alignItems: "center",
    },
    netChip: {
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      alignSelf: "flex-start",
      flexShrink: 0,
    },
    netChipPositive: {
      backgroundColor: applyAlpha(palette.success, 0.18),
    },
    netChipNegative: {
      backgroundColor: applyAlpha(palette.warning, 0.22),
    },
  netChipText: {},
    netChipTextPositive: {
      color: palette.success,
    },
    netChipTextNegative: {
      color: palette.warning,
    },
    summaryDescription: {
      color: palette.textMuted,
      flex: 1,
      minWidth: 0,
    },
    flowRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: applyAlpha(palette.text, 0.12),
      paddingTop: palette.spacing.sm,
    },
    errorBanner: {
      marginTop: palette.spacing.sm,
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.md,
      borderRadius: palette.radius.md,
      backgroundColor: applyAlpha("#EF4444", 0.1),
      borderWidth: 1,
      borderColor: applyAlpha("#B91C1C", 0.3),
    },
    errorText: {
      color: "#B91C1C",
      marginBottom: 2,
    },
    errorAction: {
      color: palette.primary,
    },
    sectionContainer: {
      gap: palette.spacing.md,
    },
    sectionCard: {
      gap: palette.spacing.lg,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: palette.spacing.md,
    },
    sectionDescription: {
      color: palette.textMuted,
      fontSize: palette.font.small,
    },
    sectionIcon: {
      width: 40,
      height: 40,
      borderRadius: palette.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: palette.spacing.lg,
      borderRadius: palette.radius.md,
      backgroundColor: palette.surfaceAlt,
    },
    listBody: {
      gap: palette.spacing.sm,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: palette.spacing.xs,
      gap: palette.spacing.sm,
    },
    listRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: palette.spacing.sm,
      flex: 1,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: palette.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    listRowMeta: {
      color: palette.textMuted,
      fontSize: palette.font.small,
    },
    listRowAmounts: {
      flexDirection: "row",
      gap: palette.spacing.xs,
    },
    amountChip: {
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      borderWidth: 1,
    },
    amountChipPositive: {
      backgroundColor: applyAlpha(palette.success, 0.14),
      borderColor: applyAlpha(palette.success, 0.3),
    },
    amountChipNegative: {
      backgroundColor: applyAlpha(palette.warning, 0.2),
      borderColor: applyAlpha(palette.warning, 0.35),
    },
    amountChipMuted: {
      opacity: 0.45,
    },
    amountChipText: {
      color: palette.text,
    },
    peopleList: {
      gap: palette.spacing.md,
    },
    personRow: {
      gap: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: applyAlpha(palette.text, 0.06),
    },
    personChips: {
      flexDirection: "row",
      gap: palette.spacing.xs,
      flexWrap: "wrap",
    },
    chip: {
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
    },
    chipPositive: {
      backgroundColor: applyAlpha(palette.success, 0.18),
    },
    chipNegative: {
      backgroundColor: applyAlpha(palette.warning, 0.24),
    },
    chipText: {
      color: palette.text,
    },
    settlementRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
    },
    actionButton: {
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      borderWidth: 1,
      minWidth: 130,
      alignItems: "center",
      justifyContent: "center",
    },
    actionButtonDisabled: {
      opacity: 0.6,
    },
  });
};
