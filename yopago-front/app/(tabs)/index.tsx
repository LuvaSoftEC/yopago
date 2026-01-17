import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { AuthScreen } from "@/components/auth/AuthScreen";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, type AppPalette } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useRealTime } from "@/contexts/RealTimeContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHeaderHeightDebug } from "@/hooks/use-header-height-debug";
import { useAuthenticatedApiService } from "@/services/authenticatedApiService";
import type {
	AggregatedShare,
	GroupDetailsResponse,
	GroupExpense,
	GroupSummary,
} from "@/services/types";

const CURRENCY_LOCALE = "es-CO";
const CURRENCY_CODE = "COP";
const DISPLAY_THRESHOLD = 0.009;

type SummaryState = {
	youOwe: number;
	owedToYou: number;
	net: number;
};

type DistributionSlice = {
	groupId: number;
	name: string;
	amount: number;
	percentage: number;
};

type ActivityEntryStatus = "youOwe" | "owedToYou" | "neutral";

type ActivityEntry = {
	id: string;
	groupId: number;
	groupName: string;
	description?: string;
	amount: number;
	createdAt?: string;
	paidBy?: string;
	status: ActivityEntryStatus;
};

type RecommendationItem = {
	id: string;
	title: string;
	description: string;
	icon: React.ComponentProps<typeof IconSymbol>["name"];
	cta: string;
	onPress: () => void;
};

type NormalizedGroup = {
	groupId: number;
	groupName: string;
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export default function HomeScreen() {
	const { t, i18n } = useTranslation();
	const scheme = useColorScheme() ?? "light";
	const palette = Colors[scheme];
	const insets = useSafeAreaInsets();
	const styles = useMemo(() => createStyles(palette), [palette]);
	const router = useRouter();
	const handleHeaderLayout = useHeaderHeightDebug("home");
	const { isAuthenticated, isLoading } = useAuth();
	const api = useAuthenticatedApiService();
	const { subscribeToGroupEvents } = useRealTime();

	// Tips dinámicos basados en traducciones
	const TIPS = useMemo(() => [
		{
			id: "items",
			title: t('home.tips.items'),
			subtitle: t('home.tips.itemsSubtitle'),
		},
		{
			id: "camera",
			title: t('home.tips.camera'),
			subtitle: t('home.tips.cameraSubtitle'),
		},
		{
			id: "friends",
			title: t('home.tips.friends'),
			subtitle: t('home.tips.friendsSubtitle'),
		},
	] as const, [t]);


	const [loadingHome, setLoadingHome] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [homeError, setHomeError] = useState<string | null>(null);
	const [memberName, setMemberName] = useState<string | undefined>();
	const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);
	const [userGroupIds, setUserGroupIds] = useState<number[]>([]);
	const [summary, setSummary] = useState<SummaryState>({ youOwe: 0, owedToYou: 0, net: 0 });
	const [distribution, setDistribution] = useState<DistributionSlice[]>([]);
	const [activity, setActivity] = useState<ActivityEntry[]>([]);
	const [bannerDismissed, setBannerDismissed] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	
	const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const currencyFormatter = useMemo(
		() =>
			new Intl.NumberFormat(CURRENCY_LOCALE, {
				style: "currency",
				currency: CURRENCY_CODE,
				maximumFractionDigits: 0,
			}),
		[]
	);

	const formatCurrency = useCallback(
		(value: number) => currencyFormatter.format(roundToTwo(value ?? 0)),
		[currencyFormatter]
	);

	const trimmedSearch = searchTerm.trim().toLowerCase();
	const hasSearch = trimmedSearch.length > 0;

	const visibleTips = useMemo(
		() => TIPS.filter((tip) => !bannerDismissed.includes(tip.id)),
		[bannerDismissed, TIPS]
	);

	const loadHomeData = useCallback(async () => {
		setHomeError(null);
		setLoadingHome(true);

		try {
			const currentMember = await api.getCurrentMember();
			setMemberName(currentMember.name ?? currentMember.email);
			const currentMemberId = currentMember.memberId;
			setCurrentMemberId(currentMemberId);

					const userGroups = await api.getUserGroups();
					const normalizedGroups: NormalizedGroup[] = (userGroups ?? [])
						.map((group: Partial<GroupSummary> & { group?: Partial<GroupSummary> }) => {
							const rawGroup = group as Record<string, unknown>;
							const rawNested = rawGroup.group as Record<string, unknown> | undefined;
							const idCandidate =
								rawGroup.groupId ??
								rawGroup.id ??
								rawNested?.groupId ??
								rawNested?.id;
					const groupId = toNumber(idCandidate);
					if (groupId === null) {
						return null;
					}

								const groupNameCandidate =
									typeof rawGroup.name === "string" && rawGroup.name.trim().length > 0
										? (rawGroup.name as string)
										: typeof rawNested?.name === "string" && rawNested.name
											? (rawNested.name as string)
											: undefined;

								const groupName = groupNameCandidate ?? t("groups.fallbackName", { id: groupId });

					return { groupId, groupName };
				})
				.filter((item): item is NormalizedGroup => item !== null);

			// Guardar los IDs de los grupos del usuario para suscribirse a eventos
			setUserGroupIds(normalizedGroups.map((g) => g.groupId));

			if (!normalizedGroups.length) {
				setSummary({ youOwe: 0, owedToYou: 0, net: 0 });
				setDistribution([]);
				setActivity([]);
				return;
			}

			const details = await Promise.allSettled(
				normalizedGroups.map((group) => api.getGroupDetails(group.groupId))
			);

			let youOwe = 0;
			let owedToYou = 0;
			const distributionAccumulator = new Map<number, { name: string; amount: number }>();
			const activityFeed: ActivityEntry[] = [];

			details.forEach((result, index) => {
				const groupMeta = normalizedGroups[index];
				if (!groupMeta) {
					return;
				}

				if (result.status !== "fulfilled") {
					console.warn(
						"No se pudieron obtener los detalles del grupo",
						groupMeta.groupId,
						result.reason
					);
					return;
				}

				const detail = result.value;
				const memberNames = buildMemberNameMap(detail.aggregatedShares, detail.members);
				const balances = extractBalances(detail);
				const settlements = computeSettlementMatrix(balances);

				settlements.forEach((settlement) => {
					const amount = Math.max(0, roundToTwo(settlement.amount));
					if (amount <= DISPLAY_THRESHOLD) {
						return;
					}
					if (settlement.from === currentMemberId) {
						youOwe += amount;
					}
					if (settlement.to === currentMemberId) {
						owedToYou += amount;
					}
				});

				const totalForGroup = computeGroupTotal(detail);
				if (totalForGroup > DISPLAY_THRESHOLD) {
					const existing = distributionAccumulator.get(groupMeta.groupId) ?? {
						name: groupMeta.groupName,
						amount: 0,
					};

					existing.amount += totalForGroup;
					distributionAccumulator.set(groupMeta.groupId, existing);
				}

				const groupExpenses = Array.isArray(detail.expenses) ? detail.expenses : [];
				groupExpenses.forEach((expense) => {
					if (typeof expense?.id === "undefined") {
						return;
					}

					const amount =
						typeof expense.amount === "number" ? expense.amount : Number(expense?.amount ?? 0);
					if (!Number.isFinite(amount)) {
						return;
					}

											const payerRaw = expense?.payer as Record<string, unknown> | undefined;
											const paidByRaw =
												typeof expense?.paidBy === "object" && expense?.paidBy !== null
													? (expense.paidBy as unknown as Record<string, unknown>)
													: undefined;
								const payerCandidate =
									payerRaw?.id ??
									payerRaw?.memberId ??
									paidByRaw?.id ??
									expense?.paidBy;
					const paidById = toNumber(payerCandidate);
					const isPayer = paidById !== null && paidById === currentMemberId;

					const status: ActivityEntryStatus = isPayer
						? "owedToYou"
						: owedShare(detail, currentMemberId, expense)
							? "youOwe"
							: "neutral";

					activityFeed.push({
						id: `${groupMeta.groupId}-${expense.id}`,
						groupId: groupMeta.groupId,
						groupName: groupMeta.groupName,
						description: expense.description ?? expense.note,
						amount,
						createdAt: expense.createdAt ?? expense.date,
						paidBy:
							typeof expense?.payer?.name === "string"
								? expense.payer.name
								: typeof expense?.paidBy === "object" && expense?.paidBy !== null && "name" in expense.paidBy
									? String((expense.paidBy as { name?: string }).name ?? "") || undefined
									: paidById !== null
										? memberNames.get(paidById)
										: undefined,
						status,
					});
				});
			});

			const totalSummary: SummaryState = {
				youOwe: roundToTwo(youOwe),
				owedToYou: roundToTwo(owedToYou),
				net: roundToTwo(owedToYou - youOwe),
			};

			const distributionArray = Array.from(distributionAccumulator.entries())
				.map(([groupId, item]) => ({
					groupId,
					name: item.name,
					amount: roundToTwo(item.amount),
				}))
				.sort((a, b) => b.amount - a.amount)
				.filter((item) => item.amount > DISPLAY_THRESHOLD);

			const distributionTotal = distributionArray.reduce((acc, item) => acc + item.amount, 0);
			const slices: DistributionSlice[] = distributionArray.map((item) => ({
				...item,
				percentage:
					distributionTotal > 0 ? roundToTwo((item.amount / distributionTotal) * 100) : 0,
			}));

			const condensedSlices = condenseDistribution(slices, t("home.otherLabel"));

			const recentActivity = activityFeed
				.filter((entry) => Number.isFinite(entry.amount))
				.sort((a, b) => {
					const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
					const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
					return timeB - timeA;
				})
				.slice(0, 10);

			setSummary(totalSummary);
			setDistribution(condensedSlices);
			setActivity(recentActivity);
		} catch (error) {
			console.error("Error loading home dashboard:", error);
			const fallbackMessage = t("home.loadError");
			const message =
				error instanceof Error && typeof error.message === "string" && error.message.trim().length > 0
					? error.message
					: fallbackMessage;
			setHomeError(message || fallbackMessage);
			setSummary({ youOwe: 0, owedToYou: 0, net: 0 });
			setDistribution([]);
			setActivity([]);
		} finally {
			setLoadingHome(false);
		}
	}, [api, t]);

	// Función para programar una actualización con debounce
	const scheduleDataRefresh = useCallback(() => {
		if (refreshTimeoutRef.current) {
			return;
		}

		refreshTimeoutRef.current = setTimeout(() => {
			refreshTimeoutRef.current = null;
			void loadHomeData();
		}, 800);
	}, [loadHomeData]);

	// Limpiar timeout al desmontar
	useEffect(() => {
		return () => {
			if (refreshTimeoutRef.current) {
				clearTimeout(refreshTimeoutRef.current);
				refreshTimeoutRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (isAuthenticated) {
			void loadHomeData();
		} else {
			setLoadingHome(false);
		}
	}, [isAuthenticated, loadHomeData]);

	// Suscribirse a eventos en tiempo real de todos los grupos del usuario
	useEffect(() => {
		if (!userGroupIds.length) {
			return undefined;
		}

		const unsubscribers: (() => void)[] = [];

		userGroupIds.forEach((groupId) => {
			const unsubscribe = subscribeToGroupEvents(groupId, (event) => {
				if (!event || typeof event.type !== 'string') {
					return;
				}

				// Recargar datos cuando hay cambios en cualquier grupo
				if (event.type.startsWith('group.')) {
					console.log(`🔄 [Home] Evento recibido en grupo ${groupId}:`, event.type);
					scheduleDataRefresh();
				}
			});

			if (typeof unsubscribe === 'function') {
				unsubscribers.push(unsubscribe);
			}
		});

		return () => {
			unsubscribers.forEach((unsub) => {
				if (typeof unsub === 'function') {
					unsub();
				}
			});
		};
	}, [userGroupIds, subscribeToGroupEvents, scheduleDataRefresh]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await loadHomeData();
		setRefreshing(false);
	}, [loadHomeData]);

	const handleCreateGroup = useCallback(() => {
		router.push("/create-group" as Href);
	}, [router]);

	const handleAddExpense = useCallback(() => {
		router.push("/capture-receipt" as Href);
	}, [router]);

	const handleViewBalance = useCallback(() => {
		router.push("/wallet" as Href);
	}, [router]);

	const goToMyGroups = useCallback(() => {
		router.push("/(tabs)/my-groups" as Href);
	}, [router]);

	const handleOpenGroup = useCallback(
		(groupId: number) => {
			router.push({
				pathname: "/(tabs)/group-details",
				params: { groupId: String(groupId) },
			});
		},
		[router]
	);

	const filteredDistribution = useMemo(() => {
		if (!hasSearch) {
			return distribution;
		}
		return distribution.filter((slice) =>
			slice.name.toLowerCase().includes(trimmedSearch)
		);
	}, [distribution, hasSearch, trimmedSearch]);

	const filteredActivity = useMemo(() => {
		if (!hasSearch) {
			return activity;
		}
		return activity.filter((entry) => {
			const haystack = `${entry.groupName} ${entry.description ?? ""}`.toLowerCase();
			return haystack.includes(trimmedSearch);
		});
	}, [activity, hasSearch, trimmedSearch]);

	const totalBalance = summary.youOwe + summary.owedToYou;
	const oweRatio = totalBalance > 0 ? summary.youOwe / totalBalance : 0;
	const owedRatio = totalBalance > 0 ? summary.owedToYou / totalBalance : 0;

	const recommendations = useMemo(
		() =>
			buildRecommendations(
				summary,
				activity,
				formatCurrency,
				handleViewBalance,
				handleAddExpense,
				goToMyGroups,
				t
			),
		[summary, activity, formatCurrency, handleViewBalance, handleAddExpense, goToMyGroups, t]
	);

	if (isLoading) {
		return (
			<ThemedView
				style={{
					flex: 1,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: palette.background,
					padding: palette.spacing.lg,
				}}
			>
				<ActivityIndicator size="large" color={palette.tint} />
				<ThemedText style={{ marginTop: 12, color: palette.textMuted }}>
					{t("home.preparingExperience")}
				</ThemedText>
			</ThemedView>
		);
	}

	if (!isAuthenticated) {
		return <AuthScreen />;
	}

	const showEmptyActivity = !loadingHome && filteredActivity.length === 0 && activity.length === 0;
	const showNoSearchResults = hasSearch && filteredActivity.length === 0 && activity.length > 0;

	return (
		<ThemedView style={{ flex: 1, backgroundColor: palette.background }}>
			<View
				style={{
					paddingTop: insets.top + palette.spacing.sm,
					paddingBottom: palette.spacing.md,
					paddingHorizontal: palette.spacing.lg,
					backgroundColor: palette.surface,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: applyAlpha(palette.text, 0.08),
					...palette.shadow.card,
				}}
				onLayout={handleHeaderLayout}
			>
				<View style={styles.headerTopRow}>
					<View style={styles.headerSidePlaceholder} />
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "center",
							columnGap: palette.spacing.xs,
							flex: 1,
							height: 40,
							paddingHorizontal: palette.spacing.md,
							borderRadius: palette.radius.pill,
							borderWidth: 1,
							borderColor: applyAlpha(palette.primary, 0.35),
							backgroundColor: applyAlpha(palette.primary, 0.12),
						}}
					>
						<ThemedText
							weight="bold"
							style={[styles.headerLogoYo, { backgroundColor: palette.primary, color: palette.surface }]}
						>
							yo
						</ThemedText>
						<ThemedText weight="bold" style={[styles.headerLogoPago, { color: palette.primary700 }]}>pago</ThemedText>
					</View>
					<Pressable
						style={styles.headerActionButton}
						onPress={goToMyGroups}
						accessibilityRole="button"
						accessibilityLabel={t("home.accessibility.goToMyGroups")}
						hitSlop={12}
					>
						<Ionicons name="notifications-outline" size={20} color={palette.text} />
					</Pressable>
				</View>

				<View style={styles.searchContainer}>
					<Ionicons name="search" size={18} color={palette.textMuted} style={styles.searchIcon} />
					<TextInput
						style={styles.searchInput}
						value={searchTerm}
						onChangeText={setSearchTerm}
						placeholder={t("home.searchPlaceholder")}
						placeholderTextColor={applyAlpha(palette.textMuted, 0.6)}
						autoCorrect={false}
						autoCapitalize="none"
						underlineColorAndroid="transparent"
						selectionColor={palette.tint}
						returnKeyType="search"
					/>
					{hasSearch ? (
						<Pressable
							onPress={() => setSearchTerm("")}
							accessibilityRole="button"
							accessibilityLabel={t("home.accessibility.clearSearch")}
							style={styles.clearSearchButton}
							hitSlop={12}
						>
							<Ionicons name="close-circle" size={20} color={palette.textMuted} />
						</Pressable>
					) : null}
				</View>
			</View>

			<ScrollView
				contentContainerStyle={[
					styles.screenContent,
					{ paddingBottom: insets.bottom + palette.spacing.lg },
				]}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={palette.tint}
					/>
				}
			>
				{visibleTips.length > 0 ? (
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: palette.spacing.sm }}
					>
						{visibleTips.map((tip) => (
							<View
								key={tip.id}
								style={[
									styles.bannerCard,
									{
										backgroundColor: palette.surface,
										borderColor: applyAlpha(palette.text, 0.08),
									},
								]}
							>
								<View style={{ flex: 1 }}>
									<ThemedText variant="bodyBold" style={{ marginBottom: 4 }}>
										{tip.title}
									</ThemedText>
									{tip.subtitle ? (
										<ThemedText variant="label" style={{ color: palette.textMuted }}>
											{tip.subtitle}
										</ThemedText>
									) : null}
								</View>
								<Pressable
									onPress={() => setBannerDismissed((prev) => [...prev, tip.id])}
									accessibilityRole="button"
									accessibilityLabel={t("home.accessibility.dismissBanner")}
									hitSlop={8}
								>
									<Ionicons name="close" size={18} color={palette.textMuted} />
								</Pressable>
							</View>
						))}
					</ScrollView>
				) : null}

				<Card style={styles.cardFullWidth}>
					<View style={{ gap: palette.spacing.md }}>
						<View style={styles.summaryHeader}>
							<View style={styles.summaryTitle}>
								<ThemedText variant="headline" weight="semiBold">{t('home.summary')}</ThemedText>
								<ThemedText variant="label" style={{ color: palette.textMuted }}>
									{memberName ? `${memberName}, ` : ""}{t('home.summaryDescription')}
								</ThemedText>
							</View>
							<Pressable onPress={handleViewBalance} hitSlop={8} style={styles.summaryHeaderAction}>
								<ThemedText variant="label" weight="semiBold" style={styles.summaryHeaderActionText}>
									{t('home.viewDetail')}
								</ThemedText>
							</Pressable>
						</View>

						<View style={styles.summaryMetricsRow}>
							<View style={styles.summaryMetricCard}>
								<ThemedText variant="label" style={{ color: palette.textMuted, marginBottom: 4 }}>
									💸 {t('home.theyOweYou')}
								</ThemedText>
								<ThemedText
									variant="title"
									weight="bold"
									style={[styles.summaryAmount, { color: palette.success }]}
								>
									{formatCurrency(summary.owedToYou)}
								</ThemedText>
							</View>
							<View style={styles.summaryMetricCard}>
								<ThemedText variant="label" style={{ color: palette.textMuted, marginBottom: 4 }}>
									📉 {t('home.youOwe')}
								</ThemedText>
								<ThemedText
									variant="title"
									weight="bold"
									style={[styles.summaryAmount, { color: palette.warning }]}
								>
									{formatCurrency(summary.youOwe)}
								</ThemedText>
							</View>
						</View>

						<View style={styles.summaryBarContainer}>
							<View style={styles.summaryBarTrack}>
								<View
									style={{
										flex: owedRatio,
										backgroundColor: applyAlpha(palette.success, 0.35),
										borderTopLeftRadius: palette.radius.pill,
										borderBottomLeftRadius: palette.radius.pill,
									}}
								/>
								<View
									style={{
										flex: oweRatio,
										backgroundColor: applyAlpha(palette.warning, 0.35),
										borderTopRightRadius: palette.radius.pill,
										borderBottomRightRadius: palette.radius.pill,
									}}
								/>
							</View>
							<View style={styles.summaryBarLabels}>
								<ThemedText variant="label" style={{ color: palette.success }}>
									{t('home.owedPercentage', { percent: Math.round(owedRatio * 100) })}
								</ThemedText>
								<ThemedText variant="label" style={{ color: palette.warning }}>
									{t('home.owePercentage', { percent: Math.round(oweRatio * 100) })}
								</ThemedText>
							</View>
						</View>

						<View style={styles.summaryNetRow}>
							<ThemedText variant="label" style={{ color: palette.textMuted }}>
								{t("home.netBalance")}
							</ThemedText>
							<ThemedText
								variant="headline"
								weight="semiBold"
								style={{
									color: summary.net >= 0 ? palette.success : palette.warning,
								}}
							>
								{formatCurrency(summary.net)}
							</ThemedText>
						</View>

						{filteredDistribution.length > 0 ? (
							<View style={styles.distributionWrapper}>
								<ThemedText variant="headline" weight="semiBold">
									{t("home.distributionByGroup")}
								</ThemedText>
								<View style={{ gap: palette.spacing.sm }}>
									{filteredDistribution.map((slice) => (
										<TouchableOpacity
											key={`${slice.groupId}-${slice.name}`}
											onPress={() => handleOpenGroup(slice.groupId)}
											activeOpacity={0.85}
											style={styles.distributionRow}
										>
											<View style={styles.distributionInfo}>
												<IconSymbol name="circle.fill" size={12} color={palette.primary} />
												<ThemedText variant="body" style={{ flex: 1 }} numberOfLines={1}>
													{slice.name}
												</ThemedText>
											</View>
											<View style={styles.distributionMeta}>
												<ThemedText variant="label" style={{ color: palette.textMuted }}>
													{`${slice.percentage}%`}
												</ThemedText>
												<ThemedText variant="bodyBold" style={{ color: palette.text }}>
													{formatCurrency(slice.amount)}
												</ThemedText>
											</View>
										</TouchableOpacity>
									))}
								</View>
							</View>
						) : hasSearch && distribution.length > 0 ? (
							<ThemedText variant="label" style={{ color: palette.textMuted }}>
								{t("home.noGroupsSearch")}
							</ThemedText>
						) : null}

						{homeError ? (
							<Pressable style={styles.errorBanner} onPress={() => void loadHomeData()}>
								<ThemedText variant="bodyBold" style={styles.errorText}>{homeError}</ThemedText>
								<ThemedText variant="label" weight="semiBold" style={styles.errorAction}>
									{t("home.retry")}
								</ThemedText>
							</Pressable>
						) : null}
					</View>
				</Card>

				<View style={styles.quickActionsHeader}>
					<ThemedText variant="headline" weight="semiBold">{t("home.quickActions")}</ThemedText>
					<ThemedText variant="label" style={{ color: palette.textMuted }}>
						{t("home.quickActionsSubtitle")}
					</ThemedText>
				</View>
				<View style={styles.quickActionsRow}>
					<QuickActionButton
						color={palette.tint}
						label={t("home.quickActionsLabels.addExpense")}
						icon="add"
						onPress={handleAddExpense}
					/>
					<QuickActionButton
						color={palette.primary700}
						label={t("home.quickActionsLabels.createGroup")}
						icon="person-add"
						onPress={handleCreateGroup}
					/>
					<QuickActionButton
						color={palette.success}
						label={t("home.quickActionsLabels.viewDebts")}
						icon="cash"
						onPress={handleViewBalance}
					/>
				</View>

				<Card style={styles.cardFullWidth}>
					<View style={{ gap: palette.spacing.md }}>
						<View style={styles.sectionHeaderWithAction}>
							<ThemedText variant="headline" weight="semiBold">{t("home.recentActivity")}</ThemedText>
							<TouchableOpacity onPress={goToMyGroups} activeOpacity={0.7}>
								<ThemedText variant="label" weight="semiBold" style={{ color: palette.tint }}>
									{t("home.viewAll")}
								</ThemedText>
							</TouchableOpacity>
						</View>

						{loadingHome ? (
							<View style={styles.stateContainer}>
								<ActivityIndicator color={palette.tint} />
								<ThemedText variant="label" style={{ color: palette.textMuted }}>
									{t("home.loadingActivity")}
								</ThemedText>
							</View>
						) : showNoSearchResults ? (
							<View style={styles.stateContainer}>
								<ThemedText variant="label" style={{ color: palette.textMuted }}>
									{t("home.noActivitySearch")}
								</ThemedText>
							</View>
						) : showEmptyActivity ? (
							<View style={styles.stateContainer}>
								<ThemedText variant="label" style={{ color: palette.textMuted }}>
									{t("home.noActivity")}
								</ThemedText>
								<TouchableOpacity
									onPress={handleCreateGroup}
									style={styles.secondaryButton}
									activeOpacity={0.85}
								>
									<ThemedText variant="label" weight="semiBold" style={{ color: palette.tint }}>
										{t("groups.createGroup")}
									</ThemedText>
								</TouchableOpacity>
							</View>
						) : (
							<View style={{ gap: palette.spacing.sm }}>
								{filteredActivity.map((item) => (
									<TouchableOpacity
										key={item.id}
										style={styles.activityRow}
										activeOpacity={0.85}
										onPress={() => handleOpenGroup(item.groupId)}
									>
										<View style={styles.activityIcon}>
											<IconSymbol name="clock.fill" size={18} color={palette.primary700} />
										</View>
										<View style={{ flex: 1 }}>
											<ThemedText variant="bodyBold" numberOfLines={1}>
												{item.groupName}
											</ThemedText>
											<ThemedText variant="label" style={{ color: palette.textMuted }} numberOfLines={1}>
												{buildActivitySubtitle(item, t, i18n.language)}
											</ThemedText>
										</View>
										<View style={{ alignItems: "flex-end" }}>
											<ThemedText variant="bodyBold">
												{formatCurrency(item.amount)}
											</ThemedText>
											<StatusBadge palette={palette} status={item.status} t={t} />
										</View>
									</TouchableOpacity>
								))}
							</View>
						)}
					</View>
				</Card>

				{recommendations.length > 0 ? (
					<Card style={styles.cardFullWidth}>
						<View style={{ gap: palette.spacing.sm }}>
							<ThemedText variant="headline" weight="semiBold">{t("home.remindersTitle")}</ThemedText>
							{recommendations.map((item) => (
								<TouchableOpacity
									key={item.id}
									onPress={item.onPress}
									activeOpacity={0.85}
									style={styles.reminderRow}
								>
									<View style={styles.reminderIcon}>
										<IconSymbol name={item.icon} size={16} color={palette.primary700} />
									</View>
									<View style={{ flex: 1 }}>
										<ThemedText variant="bodyBold">{item.title}</ThemedText>
										<ThemedText variant="label" style={{ color: palette.textMuted }}>
											{item.description}
										</ThemedText>
									</View>
									<ThemedText variant="label" weight="semiBold" style={{ color: palette.tint }}>
										{item.cta}
									</ThemedText>
								</TouchableOpacity>
							))}
						</View>
					</Card>
				) : null}
			</ScrollView>
		</ThemedView>
	);
}

function QuickActionButton({
	color,
	label,
	icon,
	onPress,
}: {
	color: string;
	label: string;
	icon: React.ComponentProps<typeof Ionicons>["name"];
	onPress: () => void;
}) {
	return (
		<TouchableOpacity style={{ alignItems: "center", gap: 8 }} onPress={onPress} activeOpacity={0.85}>
			<View
				style={{
					width: 68,
					height: 68,
					borderRadius: 34,
					backgroundColor: applyAlpha(color, 0.16),
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Ionicons name={icon} size={26} color={color} />
			</View>
			<ThemedText variant="label" weight="semiBold" style={{ textAlign: "center" }}>
				{label}
			</ThemedText>
		</TouchableOpacity>
	);
}

function StatusBadge({ palette, status, t }: { palette: AppPalette; status: ActivityEntryStatus; t: TranslateFn }) {
	let backgroundColor = applyAlpha(palette.text, 0.1);
	let textColor = palette.text;
	let label = t('home.settled');

	if (status === "owedToYou") {
		backgroundColor = applyAlpha(palette.success, 0.18);
		textColor = palette.success;
		label = t('home.theyOweYou');
	} else if (status === "youOwe") {
		backgroundColor = applyAlpha(palette.warning, 0.2);
		textColor = palette.warning;
		label = t('home.youOwe');
	}

	return (
		<View
			style={{
				marginTop: 4,
				paddingHorizontal: 10,
				paddingVertical: 4,
				borderRadius: 999,
				backgroundColor,
			}}
		>
			<ThemedText variant="caption" weight="semiBold" style={{ color: textColor }}>
				{label}
			</ThemedText>
		</View>
	);
}

function buildActivitySubtitle(entry: ActivityEntry, t: TranslateFn, locale: string) {
	const formattedDate = entry.createdAt
		? (() => {
				const date = new Date(entry.createdAt);
				if (Number.isNaN(date.getTime())) {
					return t("home.activity.recent");
				}
				const localeToUse = locale && locale.trim().length > 0 ? locale : undefined;
				return new Intl.DateTimeFormat(localeToUse, {
					day: "numeric",
					month: "short",
				}).format(date);
			})()
		: t("home.activity.recent");
	const payer = entry.paidBy
		? t("home.activity.paidBy", { name: entry.paidBy })
		: t("home.activity.recorded");
	return `${payer} · ${formattedDate}`;
}

function buildRecommendations(
	summary: SummaryState,
	activity: ActivityEntry[],
	formatCurrency: (value: number) => string,
	goToBalance: () => void,
	addExpense: () => void,
	goToGroups: () => void,
	t: TranslateFn
): RecommendationItem[] {
	const items: RecommendationItem[] = [];

	if (summary.youOwe > summary.owedToYou && summary.youOwe > DISPLAY_THRESHOLD) {
		items.push({
			id: "settle",
			title: t("home.recommendations.settle.title"),
			description: t("home.recommendations.settle.description", {
				amount: formatCurrency(summary.youOwe),
			}),
			icon: "bell.badge",
			cta: t("home.recommendations.settle.cta"),
			onPress: goToBalance,
		});
	}

	if (summary.owedToYou >= summary.youOwe && summary.owedToYou > DISPLAY_THRESHOLD) {
		items.push({
			id: "remind",
			title: t("home.recommendations.remind.title"),
			description: t("home.recommendations.remind.description", {
				amount: formatCurrency(summary.owedToYou),
			}),
			icon: "envelope.badge",
			cta: t("home.recommendations.remind.cta"),
			onPress: goToBalance,
		});
	}

	if (activity.length === 0) {
		items.push({
			id: "first-expense",
			title: t("home.recommendations.firstExpense.title"),
			description: t("home.recommendations.firstExpense.description"),
			icon: "plus.circle",
			cta: t("home.recommendations.firstExpense.cta"),
			onPress: addExpense,
		});
	}

	items.push({
		id: "groups",
		title: t("home.recommendations.groups.title"),
		description: t("home.recommendations.groups.description"),
		icon: "person.3.fill",
		cta: t("home.recommendations.groups.cta"),
		onPress: goToGroups,
	});

	return items.slice(0, 3);
}

function condenseDistribution(slices: DistributionSlice[], otherLabel: string): DistributionSlice[] {
	if (slices.length <= 4) {
		return slices;
	}

	const topThree = slices.slice(0, 3);
	const remaining = slices.slice(3);
	const otherAmount = remaining.reduce((acc, slice) => acc + slice.amount, 0);
	const totalAmount = slices.reduce((acc, slice) => acc + slice.amount, 0);
	const otherPercentage = totalAmount > 0 ? roundToTwo((otherAmount / totalAmount) * 100) : 0;

	return [
		...topThree,
		{
			groupId: 0,
			name: otherLabel,
			amount: roundToTwo(otherAmount),
			percentage: otherPercentage,
		},
	];
}

function owedShare(
	detail: GroupDetailsResponse,
	memberId: number,
	expense: GroupExpense | undefined
): boolean {
	if (!expense) {
		return false;
	}
	const shareList = Array.isArray(expense.shares) ? expense.shares : [];
	return shareList.some((share) => toNumber(share?.memberId) === memberId && (share?.amount ?? 0) > 0);
}

function computeGroupTotal(detail: GroupDetailsResponse): number {
	if (typeof detail?.totalAmount === "number") {
		return detail.totalAmount;
	}
	if (Array.isArray(detail?.aggregatedShares)) {
		return detail.aggregatedShares.reduce((acc, share) => acc + (share?.totalAmount ?? 0), 0);
	}
	if (Array.isArray(detail?.expenses)) {
		return detail.expenses.reduce((acc, expense) => acc + (expense?.amount ?? 0), 0);
	}
	return 0;
}

function buildMemberNameMap(
	aggregatedShares: AggregatedShare[] | undefined,
	members: GroupDetailsResponse["members"] | undefined
) {
	const map = new Map<number, string>();

	if (Array.isArray(members)) {
		members.forEach((member) => {
			const id = toNumber(member?.id);
			if (id !== null) {
				const name =
					typeof member?.name === "string" && member.name.trim().length > 0
						? member.name
						: typeof member?.email === "string"
							? member.email
							: undefined;
				if (name) {
					map.set(id, name);
				}
			}
		});
	}

	if (Array.isArray(aggregatedShares)) {
		aggregatedShares.forEach((share) => {
			const id = toNumber(share?.memberId);
			if (id !== null && !map.has(id)) {
				const name =
					typeof share?.memberName === "string" && share.memberName.trim().length > 0
						? share.memberName
						: undefined;
				if (name) {
					map.set(id, name);
				}
			}
		});
	}

	return map;
}

function extractBalances(detail: GroupDetailsResponse) {
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
}

function computeSettlementMatrix(balances: Record<number, number>) {
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
}

function roundToTwo(value: number) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function applyAlpha(hexColor: string, alpha: number) {
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
}

function createStyles(palette: AppPalette) {
	return StyleSheet.create({
		screenContent: {
			paddingHorizontal: 14,
			paddingTop: palette.spacing.lg,
			gap: palette.spacing.lg,
		},
		cardFullWidth: {
			marginHorizontal: 0,
		},
		headerTopRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			marginBottom: palette.spacing.md,
			marginTop: palette.spacing.xs,
		},
		headerSidePlaceholder: {
			width: 40,
			height: 40,
			marginRight: palette.spacing.sm,
		},
		headerLogoYo: {
			fontSize: 17,
			textTransform: "uppercase",
			letterSpacing: 0.8,
			paddingHorizontal: palette.spacing.sm,
			paddingVertical: palette.spacing.xs,
			borderRadius: palette.radius.pill,
			overflow: "hidden",
		},
		headerLogoPago: {
			fontSize: 17,
			textTransform: "uppercase",
			letterSpacing: 0.6,
		},
		headerActionButton: {
			width: 40,
			height: 40,
			borderRadius: palette.radius.md,
			justifyContent: "center",
			alignItems: "center",
			backgroundColor: palette.background,
			borderWidth: 1,
			borderColor: applyAlpha(palette.text, 0.06),
			...palette.shadow.card,
			marginLeft: palette.spacing.sm,
		},
		searchContainer: {
			flexDirection: "row",
			alignItems: "center",
			borderRadius: palette.radius.lg,
			backgroundColor: palette.background,
			paddingHorizontal: palette.spacing.md,
			paddingVertical: palette.spacing.sm,
			borderWidth: 1,
			borderColor: applyAlpha(palette.text, 0.08),
			...palette.shadow.card,
			width: "100%",
			minHeight: 44,
		},
		searchIcon: {
			marginRight: palette.spacing.sm,
		},
		searchInput: {
			flex: 1,
			fontSize: 15,
			color: palette.text,
			paddingVertical: 0,
		},
		clearSearchButton: {
			marginLeft: palette.spacing.sm,
		},
		bannerCard: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: palette.spacing.sm,
			borderRadius: palette.radius.lg,
			borderWidth: 1,
			paddingVertical: palette.spacing.sm,
			paddingHorizontal: palette.spacing.md,
			width: 260,
		},
		summaryHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		summaryTitle: {
			flex: 1,
			gap: 2,
		},
		summaryHeaderAction: {
			alignSelf: "flex-start",
			flexShrink: 0,
			paddingHorizontal: palette.spacing.sm,
			paddingVertical: Math.max(4, palette.spacing.xs),
			borderRadius: palette.radius.pill,
			backgroundColor: applyAlpha(palette.tint, 0.12),
			borderWidth: 1,
			borderColor: applyAlpha(palette.tint, 0.25),
		},
		summaryHeaderActionText: {
			color: palette.tint,
		},
		summaryMetricsRow: {
			flexDirection: "row",
			gap: palette.spacing.md,
		},
		summaryMetricCard: {
			flex: 1,
			padding: palette.spacing.md,
			borderRadius: palette.radius.md,
			borderWidth: 1,
			borderColor: applyAlpha(palette.text, 0.05),
			backgroundColor: palette.surfaceAlt,
		},
		summaryAmount: {
			letterSpacing: -0.3,
		},
		summaryBarContainer: {
			gap: palette.spacing.xs,
		},
		summaryBarTrack: {
			height: 16,
			borderRadius: palette.radius.pill,
			overflow: "hidden",
			flexDirection: "row",
			backgroundColor: applyAlpha(palette.text, 0.08),
		},
		summaryBarLabels: {
			flexDirection: "row",
			justifyContent: "space-between",
		},
		summaryNetRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
		distributionWrapper: {
			gap: palette.spacing.sm,
		},
		distributionRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingVertical: palette.spacing.xs,
			columnGap: palette.spacing.sm,
		},
		distributionInfo: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			flex: 1,
		},
		distributionMeta: {
			alignItems: "flex-end",
			gap: 2,
		},
		quickActionsHeader: {
			gap: 4,
		},
		quickActionsRow: {
			flexDirection: "row",
			justifyContent: "space-between",
		},
		sectionHeaderWithAction: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
		stateContainer: {
			paddingVertical: palette.spacing.lg,
			alignItems: "center",
			gap: palette.spacing.sm,
		},
		secondaryButton: {
			borderRadius: palette.radius.pill,
			borderWidth: 1,
			borderColor: palette.tint,
			paddingHorizontal: palette.spacing.md,
			paddingVertical: palette.spacing.xs,
		},
		activityRow: {
			flexDirection: "row",
			gap: palette.spacing.md,
			alignItems: "center",
			paddingVertical: palette.spacing.sm,
		},
		activityIcon: {
			width: 40,
			height: 40,
			borderRadius: palette.radius.md,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: applyAlpha(palette.primary700, 0.12),
		},
		reminderRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: palette.spacing.sm,
			borderWidth: 1,
			borderColor: applyAlpha(palette.text, 0.08),
			borderRadius: palette.radius.md,
			paddingHorizontal: palette.spacing.md,
			paddingVertical: palette.spacing.sm,
		},
		reminderIcon: {
			width: 32,
			height: 32,
			borderRadius: palette.radius.pill,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: applyAlpha(palette.primary700, 0.12),
		},
		errorBanner: {
			paddingHorizontal: palette.spacing.md,
			paddingVertical: palette.spacing.sm,
			borderRadius: palette.radius.md,
			borderWidth: 1,
			borderColor: applyAlpha("#B91C1C", 0.35),
			backgroundColor: applyAlpha("#EF4444", 0.12),
			gap: 4,
		},
		errorText: {
			color: "#B91C1C",
		},
		errorAction: {
			color: palette.tint,
		},
	});
}

