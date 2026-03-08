import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useThemedAlert } from '@/components/ui/ThemedAlert';
import { ThemedText } from '@/components/themed-text';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthenticatedApiService } from '@/services/authenticatedApiService';
import { GroupSummary } from '@/services/types';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeightDebug } from '@/hooks/use-header-height-debug';
import { useRealTime } from '@/contexts/RealTimeContext';

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

function MisGruposContent() {
	const { t, i18n } = useTranslation();
	const [groups, setGroups] = useState<GroupSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [showFabMenu, setShowFabMenu] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
	const [menuGroupId, setMenuGroupId] = useState<number | null>(null);
	const [groupPendingDeletion, setGroupPendingDeletion] = useState<GroupSummary | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);

	const colorScheme = useColorScheme() ?? 'light';
	const palette = Colors[colorScheme];
	const styles = useMemo(() => createStyles(palette), [palette]);
	const insets = useSafeAreaInsets();
	const handleHeaderLayout = useHeaderHeightDebug('my-groups');

	const { showAlert, AlertComponent } = useThemedAlert();

	const authenticatedApiService = useAuthenticatedApiService();
	const { subscribeToUserEvents, subscribeToGroupEvents } = useRealTime();
	const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const loadGroupsRef = useRef<(() => Promise<void>) | null>(null);

	const currencyFormatter = useMemo(
		() =>
			new Intl.NumberFormat('es-CO', {
				style: 'currency',
				currency: 'COP',
				minimumFractionDigits: 0,
			}),
		[]
	);

	const formatCurrency = useCallback(
		(value: number | undefined | null) => {
			const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
			return currencyFormatter.format(numericValue);
		},
		[currencyFormatter]
	);

	const loadGroups = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
		try {
			if (!silent) {
				setIsLoading(true);
			}
			console.log('============================================');
			console.log('🔄 [MyGroups] CARGANDO GRUPOS - NUEVO CODIGO');
			console.log('============================================');
			const userGroups = await authenticatedApiService.getUserGroups();
			console.log('✅ [MyGroups] Grupos recibidos:', userGroups.length, 'grupos');

			const mappedGroups: GroupSummary[] = userGroups.reduce(
				(acc: GroupSummary[], group: any) => {
				console.log('🔍 Mapeando grupo:', group);

					const rawGroupId =
						group.groupId ?? group.id ?? group.group?.id ?? group?.group?.groupId;
					const numericGroupId =
						typeof rawGroupId === 'number' ? rawGroupId : Number(rawGroupId);

					if (!Number.isFinite(numericGroupId)) {
						console.warn('⚠️ Skipping group without valid identifier:', group);
						return acc;
					}

					console.log('🔍 groupId normalizado:', numericGroupId);
				const roleCandidates: string[] = [
					group.userRole,
					group.role,
					group.memberRole,
					group.currentUserRole,
					group.currentUser?.role,
				]
					.filter((value: unknown): value is string => typeof value === 'string')
					.map((value) => value.toLowerCase());

				const hasAdminRole = roleCandidates.some((role) =>
					['admin', 'administrator', 'owner', 'creator', 'manager'].includes(role)
				);

				const booleanAdminFlags = [
					group.isAdmin,
					group.admin,
					group.isOwner,
					group.owner,
					group.createdByCurrentUser,
					group.currentUserIsOwner,
					group.currentUserIsAdmin,
					group.canDelete,
					group.currentUserCanDelete,
					Array.isArray(group.permissions) && group.permissions.includes('DELETE_GROUP'),
					Array.isArray(group.actions) && group.actions.includes('DELETE'),
				].some((flag) => flag === true);

				const explicitCanDelete =
					typeof group.canDelete === 'boolean'
						? group.canDelete
						: typeof group.currentUserCanDelete === 'boolean'
							? group.currentUserCanDelete
							: undefined;

				const computedCanDelete = hasAdminRole || booleanAdminFlags;
				const canDelete = explicitCanDelete ?? computedCanDelete;
				const userRole: GroupSummary['userRole'] = canDelete ? 'admin' : 'member';
				const showActions = explicitCanDelete !== false;

				const expensesArray = Array.isArray(group.expenses) ? group.expenses : [];
				const totalExpensesCount =
					typeof group.totalExpenses === 'number'
						? group.totalExpenses
						: expensesArray.length;
				const totalAmount = typeof group.totalAmount === 'number'
					? group.totalAmount
					: expensesArray.reduce((sum: number, expense: any) => {
							const amount = typeof expense?.amount === 'number' ? expense.amount : 0;
							return sum + amount;
						}, 0);
				const memberCountValue = typeof group.totalMembers === 'number'
					? group.totalMembers
					: Array.isArray(group.members)
						? group.members.length
						: typeof (group as any).memberCount === 'number'
							? (group as any).memberCount
							: 0;

					acc.push({
						groupId: numericGroupId,
						name: group.name || t('groups.noName'),
						memberCount: memberCountValue,
						totalExpenses: totalExpensesCount,
						totalAmount,
						lastActivity: group.createdAt,
						userRole,
						canDelete,
						showActions,
					});

					return acc;
				}, []);

			console.log('✅ [MyGroups] Grupos mapeados:', mappedGroups.length, 'grupos', mappedGroups);
			setGroups(mappedGroups);
			console.log('🔄 [MyGroups] Estado de grupos actualizado');
		} catch (error) {
			console.error('❌ [MyGroups] Error cargando grupos:', error);
			showAlert(t('common.error'), error instanceof Error ? error.message : t('groups.unknownError'));
		} finally {
			if (!silent) {
				setIsLoading(false);
			}
		}
	}, [authenticatedApiService, showAlert, t]);

	// Mantener la referencia actualizada de loadGroups
	useEffect(() => {
		loadGroupsRef.current = () => loadGroups({ silent: true });
	}, [loadGroups]);

	const scheduleReload = useCallback(() => {
		if (refreshTimeoutRef.current) {
			return;
		}

		console.log('⏰ [MyGroups] Programando recarga en 700ms...');
		refreshTimeoutRef.current = setTimeout(() => {
			refreshTimeoutRef.current = null;
			console.log('🔄 [MyGroups] Ejecutando recarga programada');
			if (loadGroupsRef.current) {
				void loadGroupsRef.current();
			}
		}, 700);
	}, []);

	useEffect(() => {
		let active = true;
		const resolveMember = async () => {
			try {
				const current = await authenticatedApiService.getCurrentMember();
				if (active && current && Number.isFinite(current.memberId)) {
					setCurrentMemberId(current.memberId);
				}
			} catch (error) {
				console.warn('⚠️ No se pudo obtener el miembro actual para tiempo real:', error);
			}
		};

		void resolveMember();

		return () => {
			active = false;
		};
	}, [authenticatedApiService]);

	useEffect(() => {
		return () => {
			if (refreshTimeoutRef.current) {
				clearTimeout(refreshTimeoutRef.current);
				refreshTimeoutRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		loadGroups();
	}, [loadGroups]);

	// Suscribirse a eventos de usuario (nuevos grupos, eliminaciones, etc)
	useEffect(() => {
		if (!currentMemberId || currentMemberId <= 0) {
			return undefined;
		}

		const unsubscribe = subscribeToUserEvents(currentMemberId, (event) => {
			if (!event || typeof event.type !== 'string') {
				return;
			}

			if (event.type.startsWith('user.group.')) {
				console.log('🔄 [MyGroups] Evento de usuario:', event.type);
				scheduleReload();
			}
		});

		return () => {
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			}
		};
	}, [currentMemberId, scheduleReload, subscribeToUserEvents]);

	// Subscribe to events for each group (expenses, payments, members)
	useEffect(() => {
		console.log('🔍 [MyGroups] subscription useEffect executed, groups:', groups.length);

		if (!groups.length) {
			console.log('⚠️ [MyGroups] No groups to subscribe to');
			return undefined;
		}

		console.log(`📡 [MyGroups] Subscribing to ${groups.length} groups:`, groups.map(g => g.groupId));
		const unsubscribers: (() => void)[] = [];

		groups.forEach((group) => {
			console.log(`🔌 [MyGroups] Subscribing to group ${group.groupId} (${group.name})`);
			const unsubscribe = subscribeToGroupEvents(group.groupId, (event) => {
				console.log(`📨 [MyGroups] Event received from group ${group.groupId}:`, event);

				if (!event || typeof event.type !== 'string') {
					console.warn(`⚠️ [MyGroups] Event without type from group ${group.groupId}:`, event);
					return;
				}

				// Update when there are changes in expenses, payments or members
				if (
					event.type === 'group.expense.created' ||
					event.type === 'group.expense.updated' ||
					event.type === 'group.expense.deleted' ||
					event.type === 'group.payment.created' ||
					event.type === 'group.payment.confirmed' ||
					event.type === 'group.member.added' ||
					event.type === 'group.member.removed'
				) {
					console.log(`✅ [MyGroups] Valid event in group ${group.groupId} (${group.name}):`, event.type);
					scheduleReload();
				} else {
					console.log(`ℹ️ [MyGroups] Ignored event from group ${group.groupId}:`, event.type);
				}
			});

			if (typeof unsubscribe === 'function') {
				unsubscribers.push(unsubscribe);
			}
		});

		return () => {
			console.log(`🔌 [MyGroups] Unsubscribing from ${unsubscribers.length} groups`);
			unsubscribers.forEach((unsub) => {
				if (typeof unsub === 'function') {
					unsub();
				}
			});
		};
	}, [groups, scheduleReload, subscribeToGroupEvents]);

	const onRefresh = async () => {
		setRefreshing(true);
		await loadGroups({ silent: true });
		setRefreshing(false);
	};

	const filteredGroups = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) {
			return groups;
		}

		return groups.filter((group: GroupSummary) => {
			const name = group.name?.toLowerCase() ?? '';
			const code = (group as any)?.code?.toLowerCase?.() ?? '';
			return name.includes(term) || code.includes(term);
		});
	}, [groups, searchTerm]);

	useEffect(() => {
		if (menuGroupId === null) {
			return;
		}

		const stillVisible = filteredGroups.some((group: GroupSummary) => group.groupId === menuGroupId);
		if (!stillVisible) {
			setMenuGroupId(null);
		}
	}, [filteredGroups, menuGroupId]);

	const hasGroups = groups.length > 0;
	const hasSearch = searchTerm.trim().length > 0;

	const openGroupDetails = (groupId: number) => {
		console.log('🚀 Navegando a group-details con groupId:', groupId);

		if (!groupId) {
			console.error('❌ GroupId es undefined o null');
			showAlert(t('common.error'), t('groups.invalidGroupId'));
			return;
		}

		setMenuGroupId(null);
		router.push(`/(tabs)/group-details?groupId=${groupId}`);
	};

	const createNewGroup = useCallback(() => {
		setShowFabMenu(false);
		router.push('/create-group');
	}, []);

	const joinGroup = useCallback(() => {
		setShowFabMenu(false);
		router.push('/join-group');
	}, []);

	const handleDeleteGroup = useCallback(
	async (groupId: number) => {
				const numericGroupId = Number(groupId);

				if (!Number.isFinite(numericGroupId)) {
					console.warn('⚠️ Invalid group ID, cannot delete:', groupId);
				setDeleteError(t('groups.deleteIdentifyError'));
				return false;
				}

				setMenuGroupId(null);
				setDeletingGroupId(numericGroupId);
			setDeleteError(null);

				try {
					await authenticatedApiService.deleteGroup(numericGroupId);
					setGroups((prev: GroupSummary[]) => prev.filter((group: GroupSummary) => group.groupId !== numericGroupId));
					return true;
			} catch (error) {
				console.error('❌ Error eliminando grupo:', error);
				setDeleteError(
					error instanceof Error && error.message
						? error.message
						: t('groups.deleteGroupError')
				);
				return false;
			} finally {
				setDeletingGroupId(null);
			}
		},
		[authenticatedApiService, t]
	);

	const confirmDeleteGroup = useCallback((group: GroupSummary) => {
		setMenuGroupId(null);
		setGroupPendingDeletion(group);
	}, []);

	const handleCancelDelete = useCallback(() => {
		if (groupPendingDeletion && deletingGroupId === groupPendingDeletion.groupId) {
			return;
		}
		setDeleteError(null);
		setGroupPendingDeletion(null);
	}, [groupPendingDeletion, deletingGroupId]);

	const handleConfirmDelete = useCallback(async () => {
		if (!groupPendingDeletion) {
			return;
		}
		const success = await handleDeleteGroup(groupPendingDeletion.groupId);
		if (success) {
			setGroupPendingDeletion(null);
		}
	}, [groupPendingDeletion, handleDeleteGroup]);

	const isDeleteDialogOpen = groupPendingDeletion !== null;
	const isDeleteLoading =
		groupPendingDeletion !== null && deletingGroupId === groupPendingDeletion.groupId;

	if (isLoading) {
		return (
			<View style={[styles.container, styles.centered]}>
				<ActivityIndicator size="large" color={palette.primary} />
				<ThemedText style={styles.loadingText}>{t('groups.loadingGroups')}</ThemedText>
			</View>
		);
	}

	return (
		<View style={styles.container}>
	<View
		style={[styles.headerSection, { paddingTop: insets.top + palette.spacing.sm }]}
		onLayout={handleHeaderLayout}
	>
				<View style={styles.headerTopRow}>
					<View style={styles.headerSidePlaceholder} />

					<View style={styles.headerTitleWrapper}>
						<Ionicons
							name="people"
							size={24}
							color={palette.primary}
							style={styles.headerTitleIcon}
						/>
						<ThemedText variant="headline" weight="bold" style={styles.headerTitle}>
							{t('groups.myGroups')}
						</ThemedText>
					</View>

					<Pressable
						style={styles.headerActionButton}
						onPress={onRefresh}
						accessibilityRole="button"
						accessibilityLabel={t('groups.refreshLabel')}
						hitSlop={12}
					>
						<Ionicons name="notifications-outline" size={20} color={palette.text} />
					</Pressable>
				</View>

				<View style={styles.searchContainer}>
					<Ionicons
						name="search"
						size={18}
						color={palette.textMuted}
						style={styles.searchIcon}
					/>
					<TextInput
						style={styles.searchInput}
						placeholder={t('groups.searchByNameOrCode')}
						placeholderTextColor={applyAlpha(palette.textMuted, 0.6)}
						value={searchTerm}
						onChangeText={setSearchTerm}
						autoCorrect={false}
						autoCapitalize="none"
						underlineColorAndroid="transparent"
						selectionColor={palette.primary}
						returnKeyType="search"
					/>
					{hasSearch && (
						<Pressable
							onPress={() => setSearchTerm('')}
							accessibilityRole="button"
							accessibilityLabel={t('groups.clearSearch')}
							style={styles.clearSearchButton}
							hitSlop={12}
						>
							<Ionicons name="close-circle" size={20} color={palette.textMuted} />
						</Pressable>
					)}
				</View>
			</View>
			<ScrollView
				style={styles.groupsList}
				contentContainerStyle={styles.groupsContent}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				showsVerticalScrollIndicator={false}
			>
				{!hasGroups ? (
					<View style={styles.emptyState}>
						<ThemedText style={styles.emptyIcon}>📝</ThemedText>
						<ThemedText variant="headline" weight="semiBold" style={styles.emptyTitle}>
							{t('groups.noGroups')}
						</ThemedText>
						<ThemedText variant="label" style={styles.emptyDescription}>
							{t('groups.createFirst')}
						</ThemedText>
						<TouchableOpacity
							style={styles.emptyActionButton}
							onPress={createNewGroup}
							activeOpacity={0.8}
						>
							<ThemedText variant="label" weight="semiBold" style={styles.emptyActionButtonText}>
								{t('groups.createGroup')}
							</ThemedText>
						</TouchableOpacity>
					</View>
				) : filteredGroups.length === 0 ? (
					<View style={styles.noMatches}>
						<Ionicons name="search" size={28} color={palette.textMuted} />
						<ThemedText variant="headline" weight="semiBold" style={styles.noMatchesTitle}>
							{t('groups.noMatches')}
						</ThemedText>
						<ThemedText variant="label" style={styles.noMatchesSubtitle}>
						{t('groups.noMatchesSubtitle')}
					</ThemedText>
				</View>
			) : (
				filteredGroups.map((group: GroupSummary) => {
					const isDeleting = deletingGroupId === group.groupId;
					const isMenuOpen = menuGroupId === group.groupId;

					return (
						<TouchableOpacity
							key={group.groupId}
								style={styles.groupCard}
								onPress={() => openGroupDetails(group.groupId)}
								activeOpacity={0.75}
							>
								<View style={styles.groupCardHeader}>
									<View style={styles.groupInfo}>
										<ThemedText variant="bodyBold" style={styles.groupName}>
											{group.name}
											{group.userRole === 'admin' && (
												<ThemedText style={styles.adminBadge}> 👑</ThemedText>
											)}
										</ThemedText>
										<ThemedText variant="label" style={styles.groupMemberCount}>
											👥 {group.memberCount} {group.memberCount === 1 ? t('groups.member') : t('groups.members')}
										</ThemedText>
									</View>

									<View style={styles.groupHeaderActions}>
										{(group.showActions ?? true) && (
											<Pressable
												onPress={(event: any) => {
													event.stopPropagation();
													setMenuGroupId((current: number | null) =>
														current === group.groupId ? null : group.groupId
													);
											}}
												disabled={isDeleting}
												style={({ pressed }: { pressed: boolean }) => [
													styles.groupMenuButton,
													pressed && styles.groupMenuButtonPressed,
													isDeleting && styles.groupMenuButtonDisabled,
												]}
												accessibilityRole="button"
												accessibilityLabel={t('groups.optionsFor', { name: group.name })}
												hitSlop={14}
											>
												{isDeleting ? (
													<ActivityIndicator size="small" color={palette.primary} />
												) : (
													<Ionicons
														name="ellipsis-horizontal"
														size={26}
														color={palette.textMuted}
														style={styles.groupMenuIcon}
													/>
												)}
											</Pressable>
										)}

										<View style={styles.groupExpenses}>
											<ThemedText variant="title" weight="bold" style={styles.expenseAmount}>
												{formatCurrency(group.totalAmount)}
											</ThemedText>
											<ThemedText variant="label" style={styles.expenseLabel}>{t('groups.totalExpenses')}</ThemedText>
										</View>
									</View>
								</View>

								<View style={styles.groupCardFooter}>
									<ThemedText variant="label" style={styles.lastActivity}>
										{group.lastActivity && (
											t('groups.lastActivity', { date: new Date(group.lastActivity).toLocaleDateString(i18n.language) })
										)}
									</ThemedText>

									<View
										style={[
											styles.roleIndicator,
											group.userRole === 'admin' && styles.roleIndicatorAdmin,
										]}
									>
										<ThemedText
											variant="caption"
											weight="semiBold"
											style={[
												styles.roleText,
												group.userRole === 'admin' && styles.roleTextAdmin,
											]}
										>
											{group.userRole === 'admin' ? t('groups.roleAdmin') : t('groups.roleMember')}
										</ThemedText>
									</View>
								</View>

							{isMenuOpen && (
								<View style={styles.groupMenuOverlay} pointerEvents="box-none">
									<Pressable
										style={styles.groupMenuBackdrop}
										onPress={(event) => {
											event.stopPropagation();
											setMenuGroupId(null);
										}}
									/>
									<View style={styles.groupMenuContainer}>
										<Pressable
											style={({ pressed }) => [
												styles.groupMenuItem,
												pressed && styles.groupMenuItemPressed,
											]}
											onPress={(event) => {
												event.stopPropagation?.();
												setMenuGroupId(null);
												confirmDeleteGroup(group);
											}}
										>
											<Ionicons name="trash" size={18} color={palette.warning} />
											<ThemedText variant="label" weight="semiBold" style={styles.groupMenuItemText}>
												{t('groups.deleteMenuLabel')}
											</ThemedText>
										</Pressable>
									</View>
								</View>
							)}

							</TouchableOpacity>
						);
					})
				)}
			</ScrollView>

			{showFabMenu && (
				<Pressable style={styles.fabBackdrop} onPress={() => setShowFabMenu(false)} />
			)}

			{showFabMenu && (
				<View style={styles.fabMenu}>
					<Pressable style={styles.fabMenuItem} onPress={createNewGroup}>
						<Ionicons name="construct-outline" size={20} color={palette.primary} />
						<ThemedText variant="label" weight="semiBold" style={styles.fabMenuLabel}>
							{t('groups.createGroup')}
						</ThemedText>
					</Pressable>
					<Pressable style={styles.fabMenuItem} onPress={joinGroup}>
						<Ionicons name="people-outline" size={20} color={palette.primary} />
						<ThemedText variant="label" weight="semiBold" style={styles.fabMenuLabel}>
							{t('groups.joinGroup')}
						</ThemedText>
					</Pressable>
				</View>
			)}

			<Pressable
				style={[styles.fabButton, showFabMenu && styles.fabButtonActive]}
				onPress={() => setShowFabMenu((prev) => !prev)}
				accessibilityRole="button"
				accessibilityLabel={
					showFabMenu ? t('groups.closeQuickActions') : t('groups.openQuickActions')
				}
				hitSlop={12}
			>
				<Ionicons
					name={showFabMenu ? 'close' : 'add'}
					size={28}
					color={palette.surface}
				/>
			</Pressable>

			<ConfirmDialog
				visible={isDeleteDialogOpen && !!groupPendingDeletion}
				title={t('groups.deleteGroup')}
				description={
					groupPendingDeletion
						? t('groups.deleteConfirmFull', { name: groupPendingDeletion.name })
						: undefined
				}
				confirmLabel={t('common.delete')}
				cancelLabel={t('common.cancel')}
				danger
				loading={isDeleteLoading}
				errorMessage={deleteError ?? undefined}
				onCancel={handleCancelDelete}
				onConfirm={() => {
					void handleConfirmDelete();
				}}
			/>
			{AlertComponent}
		</View>
	);
}

export default function MisGruposScreen() {
	return (
		<ProtectedRoute showLoginButton={true}>
			<Stack.Screen
				options={{
					title: 'Mis Grupos',
					headerShown: false,
				}}
			/>
			<MisGruposContent />
		</ProtectedRoute>
	);
}

const createStyles = (palette: AppPalette) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: palette.background,
		},
		centered: {
			justifyContent: 'center',
			alignItems: 'center',
			padding: palette.spacing.lg,
		},
		loadingText: {
			marginTop: palette.spacing.md,
			color: palette.textMuted,
		},
		groupsList: {
			flex: 1,
		},
		   groupsContent: {
			   paddingHorizontal: 14,
			   paddingBottom: palette.spacing.xl * 2,
			   paddingTop: palette.spacing.md,
		},
		searchContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			borderRadius: palette.radius.lg,
			backgroundColor: palette.background,
			paddingHorizontal: palette.spacing.md,
			paddingVertical: palette.spacing.sm,
			borderWidth: 1,
			borderColor: applyAlpha(palette.text, 0.08),
			...palette.shadow.card,
			width: '100%',
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
		headerSection: {
			paddingHorizontal: palette.spacing.lg,
			paddingTop: palette.spacing.lg,
			paddingBottom: palette.spacing.md,
			backgroundColor: palette.surface,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: applyAlpha(palette.text, 0.08),
			...palette.shadow.card,
		},
		headerTopRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			marginBottom: palette.spacing.md,
			marginTop: palette.spacing.xs,
		},
		headerSidePlaceholder: {
			width: 40,
			height: 40,
			marginRight: palette.spacing.sm,
		},
		headerTitleWrapper: {
			flexDirection: 'row',
			alignItems: 'center',
			columnGap: palette.spacing.xs,
			flex: 1,
			justifyContent: 'center',
			paddingHorizontal: palette.spacing.md,
		},
		headerTitleIcon: {
			marginRight: palette.spacing.xs,
		},
		headerTitle: {
			textTransform: 'uppercase',
			letterSpacing: 0.6,
			color: palette.text,
		},
		headerActionButton: {
			width: 40,
			height: 40,
			borderRadius: palette.radius.md,
			justifyContent: 'center',
			alignItems: 'center',
			backgroundColor: palette.background,
			borderWidth: 1,
			borderColor: applyAlpha(palette.text, 0.06),
			...palette.shadow.card,
			marginLeft: palette.spacing.sm,
		},
		emptyState: {
			alignItems: 'center',
			marginTop: palette.spacing.xl,
			backgroundColor: palette.surface,
			borderRadius: palette.radius.lg,
			borderWidth: 1,
			borderColor: palette.divider,
			padding: palette.spacing.xl,
			...palette.shadow.card,
		},
		emptyIcon: {
			fontSize: 48,
			marginBottom: palette.spacing.md,
		},
		emptyTitle: {
			marginBottom: palette.spacing.sm,
			textAlign: 'center',
			color: palette.text,
		},
		emptyDescription: {
			textAlign: 'center',
			color: palette.textMuted,
			lineHeight: 22,
			marginBottom: palette.spacing.lg,
		},
		emptyActionButton: {
			borderRadius: palette.radius.md,
			paddingVertical: palette.spacing.sm,
			paddingHorizontal: palette.spacing.lg,
			backgroundColor: palette.primary,
		},
		emptyActionButtonText: {
			color: palette.surface,
			fontSize: 16,
		},
		noMatches: {
			alignItems: 'center',
			paddingVertical: palette.spacing.xl,
			paddingHorizontal: palette.spacing.lg,
			rowGap: palette.spacing.sm,
		},
		noMatchesTitle: {
			fontSize: 16,
			color: palette.text,
		},
		noMatchesSubtitle: {
			fontSize: 13,
			color: palette.textMuted,
			textAlign: 'center',
			lineHeight: 20,
			paddingHorizontal: palette.spacing.md,
		},
		   groupCard: {
			   borderRadius: palette.radius.lg,
			   padding: palette.spacing.md,
			   marginBottom: palette.spacing.md,
			   borderWidth: 1,
			   borderColor: palette.divider,
			   backgroundColor: palette.surface,
			   position: 'relative',
			   ...palette.shadow.card,
		   },
		groupCardHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'flex-start',
			marginBottom: palette.spacing.sm,
		},
		groupInfo: {
			flex: 1,
		},
		   groupName: {
			   fontSize: 16,
			   marginBottom: palette.spacing.xs,
			   color: palette.text,
		   },
		adminBadge: {
			fontSize: 14,
			color: palette.warning,
		},
		groupMemberCount: {
			color: palette.textMuted,
			fontSize: 14,
		},
		groupExpenses: {
			alignItems: 'flex-end',
		},
		expenseAmount: {
			color: palette.success,
		},
		expenseLabel: {
			fontSize: 12,
			color: palette.textMuted,
		},
		groupCardFooter: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginTop: palette.spacing.sm,
		},
		lastActivity: {
			fontSize: 12,
			color: palette.textMuted,
		},
		roleIndicator: {
			backgroundColor: applyAlpha(palette.primary, 0.12),
			borderRadius: palette.radius.pill,
			paddingHorizontal: palette.spacing.md,
			paddingVertical: palette.spacing.xs,
		},
		roleIndicatorAdmin: {
			backgroundColor: applyAlpha(palette.warning, 0.18),
		},
		roleText: {
			color: palette.primary,
		},
		roleTextAdmin: {
			color: palette.warning,
		},
		fabBackdrop: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: applyAlpha('#000000', 0.25),
		},
		fabMenu: {
			position: 'absolute',
			right: palette.spacing.lg,
			bottom: palette.spacing.xl + 72,
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
			fontSize: 15,
			color: palette.text,
			marginLeft: palette.spacing.sm,
		},
		fabButton: {
			position: 'absolute',
			right: palette.spacing.lg,
			bottom: palette.spacing.xl,
			width: 56,
			height: 56,
			borderRadius: 28,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: palette.primary,
			...palette.shadow.card,
		},
		fabButtonActive: {
			backgroundColor: palette.primary700,
		},
		groupHeaderActions: {
			alignItems: 'flex-end',
			marginLeft: palette.spacing.md,
		},
		groupMenuButton: {
			paddingHorizontal: palette.spacing.sm,
			paddingVertical: palette.spacing.xs,
			borderRadius: palette.radius.md,
			marginBottom: palette.spacing.sm,
			marginTop: -palette.spacing.xs,
			marginRight: -palette.spacing.xs,
			alignSelf: 'flex-end',
		},
		groupMenuButtonPressed: {
			opacity: 0.6,
		},
		groupMenuButtonDisabled: {
			opacity: 0.5,
		},
		groupMenuIcon: {
			transform: [{ translateY: -5 }],
		},
		groupMenuOverlay: {
			...StyleSheet.absoluteFillObject,
			zIndex: 5,
			justifyContent: 'flex-start',
			alignItems: 'flex-end',
			paddingTop: palette.spacing.xs,
			paddingRight: palette.spacing.xs,
		},
		groupMenuBackdrop: {
			...StyleSheet.absoluteFillObject,
		},
		groupMenuContainer: {
			marginTop: -palette.spacing.lg,
			marginRight: -palette.spacing.xs,
			backgroundColor: palette.surfaceAlt,
			borderRadius: palette.radius.md,
			borderWidth: 1,
			borderColor: applyAlpha(palette.text, 0.1),
			paddingVertical: palette.spacing.xs,
			paddingHorizontal: palette.spacing.sm,
			minWidth: 160,
			...palette.shadow.card,
		},
		groupMenuItem: {
			flexDirection: 'row',
			alignItems: 'center',
			columnGap: palette.spacing.xs,
			paddingVertical: palette.spacing.xs,
		},
		groupMenuItemPressed: {
			opacity: 0.6,
		},
		groupMenuItemText: {
			fontSize: 14,
			color: palette.text,
		},
	});
