import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  authenticatedApiService,
  JoinGroupInviteRequest,
  JoinGroupRegisteredRequest,
  JoinGroupMemberResponse,
  RegisteredUserSummary,
} from '../../services/authenticatedApiService';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemedAlert } from '@/components/ui/ThemedAlert';

interface JoinGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onMemberAdded: (member: JoinGroupMemberResponse) => void;
  groupId: number;
}

const COUNTRY_OPTIONS = [
  { code: 'EC', label: 'Ecuador', dialCode: '+593' },
  { code: 'CO', label: 'Colombia', dialCode: '+57' },
  { code: 'PE', label: 'Perú', dialCode: '+51' },
];

const applyAlpha = (hexColor: string, alpha: number) => {
  const sanitized = hexColor.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function JoinGroupModal({
  visible,
  onClose,
  onMemberAdded,
  groupId,
}: JoinGroupModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'invite' | 'registered'>('invite');
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useThemedAlert();

  // Para miembros invitados (no registrados)
  const [memberName, setMemberName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountryIndex, setSelectedCountryIndex] = useState(0);
  const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

  // Para miembros registrados
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState<number | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const placeholderColor = applyAlpha(palette.textMuted, 0.55);

  const selectedCountry = COUNTRY_OPTIONS[selectedCountryIndex];

  const loadRegisteredUsers = useCallback(async (query?: string) => {
    try {
      setIsFetchingUsers(true);
      setUsersError(null);
      setHasAttemptedLoad(true);

      const normalizedQuery = query?.trim();
      const users = await authenticatedApiService.getRegisteredUsers(
        normalizedQuery ? normalizedQuery : undefined,
      );
      setRegisteredUsers(users ?? []);
    } catch (error) {
      console.error('❌ Error cargando usuarios registrados:', error);
      setUsersError(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios registrados');
      setRegisteredUsers([]);
    } finally {
      setIsFetchingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (visible && activeTab === 'registered' && !isFetchingUsers && !hasAttemptedLoad) {
      loadRegisteredUsers();
    }
  }, [visible, activeTab, loadRegisteredUsers, isFetchingUsers, hasAttemptedLoad]);

  const handleRefreshRegisteredUsers = useCallback(() => {
    if (isFetchingUsers) {
      return;
    }
    setHasAttemptedLoad(false);
    loadRegisteredUsers(searchQuery.trim() ? searchQuery.trim() : undefined);
  }, [isFetchingUsers, loadRegisteredUsers, searchQuery]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return registeredUsers;
    }

    return registeredUsers.filter((user) => {
      const username = user.username?.toLowerCase() ?? '';
      const emailAddress = user.email?.toLowerCase() ?? '';
      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();

      return (
        username.includes(query) ||
        emailAddress.includes(query) ||
        fullName.includes(query)
      );
    });
  }, [registeredUsers, searchQuery]);

  const addRegisteredMember = useCallback(
    async (memberIdNumber: number) => {
      try {
        setIsLoading(true);
        setAddingUserId(memberIdNumber);

        const request: JoinGroupRegisteredRequest = {
          memberId: memberIdNumber,
        };

        const response = await authenticatedApiService.joinGroupAsRegistered(groupId, request);

        onMemberAdded(response);
        onClose();

        showAlert('¡Éxito!', response.message || 'Miembro registrado agregado exitosamente');
      } catch (error) {
        showAlert('Error', error instanceof Error ? error.message : 'No se pudo agregar el miembro registrado');
      } finally {
        setIsLoading(false);
        setAddingUserId(null);
      }
    },
    [groupId, onMemberAdded, onClose, showAlert],
  );

  const handleSubmitInvite = async () => {
    if (!memberName.trim() || !phoneNumber.trim()) {
      showAlert('Error', 'Nombre y número telefónico son obligatorios');
      return;
    }

    try {
      setIsLoading(true);

      const fullPhone = `${selectedCountry.dialCode} ${phoneNumber.trim()}`.trim();

      // La API actual requiere un email, así que generamos uno técnico
      const normalizedPhone = fullPhone.replace(/[^0-9+]/g, '') || 'sin-telefono';
      const technicalEmail = `${normalizedPhone}@guest.yopago.local`.toLowerCase();

      const request: JoinGroupInviteRequest = {
        memberName: memberName.trim(),
        email: technicalEmail,
        phoneNumber: fullPhone,
      };

      const response = await authenticatedApiService.joinGroupAsInvite(groupId, request);

      // Limpiar formulario
      setMemberName('');
      setPhoneNumber('');

      onMemberAdded(response);
      onClose();

      showAlert('¡Éxito!', response.message || 'Miembro invitado agregado exitosamente');
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo agregar el miembro invitado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRegisteredFromList = (userId: number) => {
    void addRegisteredMember(userId);
  };

  const handleClose = () => {
    // Limpiar formularios al cerrar
    setMemberName('');
    setPhoneNumber('');
    setIsCountryPickerVisible(false);
    setRegisteredUsers([]);
    setSearchQuery('');
    setUsersError(null);
    setAddingUserId(null);
    setIsFetchingUsers(false);
    setActiveTab('invite');
    setHasAttemptedLoad(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} color={palette.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('joinGroup.title')}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'invite' && styles.activeTab]}
            onPress={() => setActiveTab('invite')}
          >
            <Text style={[styles.tabText, activeTab === 'invite' && styles.activeTabText]}>
              {t('joinGroup.inviteNew')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'registered' && styles.activeTab]}
            onPress={() => setActiveTab('registered')}
          >
            <Text style={[styles.tabText, activeTab === 'registered' && styles.activeTabText]}>
              {t('joinGroup.registeredUser')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'invite' ? (
            <>
              <Text style={styles.description}>
                {t('joinGroup.inviteDescription')}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre completo *</Text>
                <TextInput
                  style={styles.input}
                  value={memberName}
                  onChangeText={setMemberName}
                  placeholder="Nombre del nuevo miembro"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Número telefónico *</Text>
                <View style={styles.phoneRow}>
                  <TouchableOpacity
                    style={styles.countryCodeButton}
                    onPress={() => setIsCountryPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.countryCodeText}>
                      {selectedCountry.dialCode} {selectedCountry.code}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Ej: 98 123 4567"
                    placeholderTextColor={placeholderColor}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleSubmitInvite}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={palette.surface} size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Invitar Miembro</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.registeredContent}>
              <Text style={styles.description}>
                Agrega a alguien que ya tiene cuenta en la aplicación
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Buscar usuario registrado</Text>
                <TextInput
                  style={styles.input}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Busca por username, nombre o correo"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.userListHeader}>
                <Text style={styles.sectionTitle}>Usuarios disponibles</Text>
                <TouchableOpacity
                  onPress={handleRefreshRegisteredUsers}
                  style={styles.refreshButton}
                  disabled={isFetchingUsers}
                  activeOpacity={0.7}
                >
                  {isFetchingUsers ? (
                    <ActivityIndicator color={palette.primary} size="small" />
                  ) : (
                    <Text style={styles.refreshButtonText}>Actualizar</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.userListContainer}>
                {isFetchingUsers && registeredUsers.length === 0 ? (
                  <View style={styles.userListState}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={styles.userListStateText}>Cargando usuarios registrados...</Text>
                  </View>
                ) : usersError ? (
                  <View style={styles.userListState}>
                    <Text style={styles.userListStateText}>{usersError}</Text>
                    <TouchableOpacity
                      onPress={handleRefreshRegisteredUsers}
                      style={styles.retryButton}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    style={styles.userList}
                    data={filteredUsers}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={[
                      styles.userListContent,
                      filteredUsers.length === 0 ? styles.userListEmpty : null,
                    ]}
                    ListEmptyComponent={
                      filteredUsers.length === 0 && !isFetchingUsers ? (
                        <View style={styles.userListState}>
                          <Text style={styles.userListStateText}>
                            No se encontraron usuarios con ese criterio.
                          </Text>
                        </View>
                      ) : null
                    }
                    renderItem={({ item }) => {
                      const fullName = item.name || `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();

                      return (
                        <View style={styles.userRow}>
                          <View style={styles.userInfo}>
                            <Text style={styles.userName} numberOfLines={1}>
                              {fullName || item.username || 'Usuario sin nombre'}
                            </Text>
                            {item.username ? (
                              <Text style={styles.userMeta} numberOfLines={1}>
                                @{item.username}
                              </Text>
                            ) : null}
                            {item.email ? (
                              <Text style={styles.userMeta} numberOfLines={1}>
                                {item.email}
                              </Text>
                            ) : null}
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.addUserButton,
                              isLoading ? styles.addUserButtonDisabled : null,
                            ]}
                            onPress={() => handleAddRegisteredFromList(item.id)}
                            disabled={isLoading}
                            activeOpacity={0.8}
                          >
                            {isLoading && addingUserId === item.id ? (
                              <ActivityIndicator color={palette.surface} size="small" />
                            ) : (
                              <Text style={styles.addUserButtonText}>Agregar</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Selector de país/código telefónico */}
      <Modal
        transparent
        animationType="fade"
        visible={isCountryPickerVisible}
        onRequestClose={() => setIsCountryPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.countryPickerOverlay}
          activeOpacity={1}
          onPress={() => setIsCountryPickerVisible(false)}
        >
          <View style={styles.countryPickerContainer}>
            {COUNTRY_OPTIONS.map((country, index) => (
              <TouchableOpacity
                key={country.code}
                style={[
                  styles.countryPickerItem,
                  index === selectedCountryIndex && styles.countryPickerItemActive,
                ]}
                onPress={() => {
                  setSelectedCountryIndex(index);
                  setIsCountryPickerVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.countryPickerText}>
                  {country.dialCode} · {country.label} ({country.code})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      paddingTop: 60,
      backgroundColor: palette.surface,
    },
    title: {
      fontSize: palette.font.h2,
      fontWeight: '600',
      color: palette.text,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: palette.surfaceAlt,
      margin: palette.spacing.md,
      borderRadius: palette.radius.md,
      padding: palette.spacing.xs,
    },
    tab: {
      flex: 1,
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.md,
      borderRadius: palette.radius.sm,
      alignItems: 'center',
    },
    activeTab: {
      backgroundColor: palette.primary,
    },
    tabText: {
      fontSize: palette.font.small,
      fontWeight: '500',
      color: palette.textMuted,
    },
    activeTabText: {
      color: palette.surface,
    },
    content: {
      flex: 1,
      padding: palette.spacing.md,
    },
    description: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginBottom: palette.spacing.lg,
      textAlign: 'center',
    },
    registeredContent: {
      flex: 1,
    },
    inputGroup: {
      marginBottom: palette.spacing.md,
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
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    countryCodeButton: {
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.sm,
      borderRadius: palette.radius.sm,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceAlt,
      marginRight: palette.spacing.xs,
    },
    countryCodeText: {
      fontSize: 14,
      color: palette.text,
      fontWeight: '500',
    },
    phoneInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.sm,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.sm,
      fontSize: 16,
      backgroundColor: palette.surface,
      color: palette.text,
    },
    countryPickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    countryPickerContainer: {
      width: '80%',
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.sm,
    },
    countryPickerItem: {
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.sm,
      borderRadius: palette.radius.sm,
    },
    countryPickerItemActive: {
      backgroundColor: applyAlpha(palette.primary, 0.1),
    },
    countryPickerText: {
      fontSize: 14,
      color: palette.text,
    },
    submitButton: {
      backgroundColor: palette.primary,
      paddingVertical: palette.spacing.sm + 4,
      borderRadius: palette.radius.md,
      alignItems: 'center',
      marginTop: 'auto',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: palette.surface,
      fontSize: palette.font.body,
      fontWeight: '600',
    },
    userListHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: palette.spacing.sm,
      marginTop: palette.spacing.xs,
    },
    sectionTitle: {
      fontSize: palette.font.body,
      fontWeight: '600',
      color: palette.text,
    },
    refreshButton: {
      paddingHorizontal: palette.spacing.sm + 4,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
      borderWidth: 1,
      borderColor: palette.primary,
      backgroundColor: palette.surfaceAlt,
    },
    refreshButtonText: {
      fontSize: palette.font.small,
      color: palette.primary,
      fontWeight: '600',
    },
    userListContainer: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.sm,
      backgroundColor: palette.surface,
    },
    userList: {
      flex: 1,
    },
    userListState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: palette.spacing.lg,
    },
    userListStateText: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      textAlign: 'center',
      marginTop: palette.spacing.xs,
    },
    retryButton: {
      paddingHorizontal: palette.spacing.md,
      paddingVertical: palette.spacing.xs,
      backgroundColor: palette.primary,
      borderRadius: palette.radius.sm,
      marginTop: palette.spacing.sm,
    },
    retryButtonText: {
      color: palette.surface,
      fontWeight: '600',
    },
    userListContent: {
      paddingVertical: palette.spacing.xs,
      flexGrow: 1,
    },
    userListEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.sm,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.divider,
      marginBottom: palette.spacing.xs,
    },
    userInfo: {
      flex: 1,
      marginRight: palette.spacing.sm,
    },
    userName: {
      fontSize: palette.font.body,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 2,
    },
    userMeta: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      marginBottom: 2,
    },
    addUserButton: {
      backgroundColor: palette.primary,
      borderRadius: palette.radius.sm,
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addUserButtonDisabled: {
      opacity: 0.6,
    },
    addUserButtonText: {
      color: palette.surface,
      fontSize: palette.font.small,
      fontWeight: '600',
    },
  });
}