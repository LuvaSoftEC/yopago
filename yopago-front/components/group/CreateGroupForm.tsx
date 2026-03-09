import { Colors, type AppPalette } from '@/constants/theme';
import { GROUP_TYPES, GROUP_TYPE_MAP, STORAGE_KEY_GROUP_TYPES, type GroupTypeId } from '@/constants/groupTypes';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { authenticatedApiService } from '../../services/authenticatedApiService';
import { CreateGroupRequest, CreateGroupResponse } from '../../services/types';
import { ThemedButton } from '../ui/Button';
import GroupCreatedModal from './GroupCreatedModal';

type PropertyTypeId = 'apartamento' | 'casa' | 'finca';
const PROPERTY_TYPES: { id: PropertyTypeId; labelKey: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'apartamento', labelKey: 'groups.propertyTypeApartamento', icon: 'business' },
  { id: 'casa',        labelKey: 'groups.propertyTypeCasa',         icon: 'home' },
  { id: 'finca',       labelKey: 'groups.propertyTypeFinca',        icon: 'leaf' },
];
const STORAGE_KEY_PROPERTY_META = 'yopago_property_meta';

export default function CreateGroupForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [groupType, setGroupType] = useState<GroupTypeId>('general');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [createdGroup, setCreatedGroup] = useState<CreateGroupResponse | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [propertyTypeId, setPropertyTypeId] = useState<PropertyTypeId>('apartamento');
  const [propertyAddress, setPropertyAddress] = useState('');

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = t('createGroup.errorName');
    }

    if (formData.name.trim().length < 3) {
      newErrors.name = t('createGroup.nameTooShort');
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = t('createGroup.descriptionTooLong');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveGroupType = async (groupId: number, type: GroupTypeId) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_GROUP_TYPES);
      const map: Record<string, GroupTypeId> = raw ? JSON.parse(raw) : {};
      map[String(groupId)] = type;
      await AsyncStorage.setItem(STORAGE_KEY_GROUP_TYPES, JSON.stringify(map));
    } catch {
      // Non-critical — type badge just won't show
    }
  };

  const savePropertyMeta = async (groupId: number) => {
    if (groupType !== 'propiedad') return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_PROPERTY_META);
      const map: Record<string, { propertyType: PropertyTypeId; address: string }> = raw ? JSON.parse(raw) : {};
      map[String(groupId)] = { propertyType: propertyTypeId, address: propertyAddress.trim() };
      await AsyncStorage.setItem(STORAGE_KEY_PROPERTY_META, JSON.stringify(map));
    } catch {
      // Non-critical
    }
  };

  const handleCreateGroup = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const groupRequest: CreateGroupRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      console.log('🔄 Sending group creation request:', groupRequest);

      const response = await authenticatedApiService.createGroup(groupRequest);

      console.log('✅ Group created successfully:', response);

      await saveGroupType(response.groupId, groupType);
      await savePropertyMeta(response.groupId);

      setCreatedGroup(response);
      setShowSuccessModal(true);

      setFormData({ name: '', description: '' });
      setGroupType('general');
      setPropertyTypeId('apartamento');
      setPropertyAddress('');
      setErrors({});

    } catch (error) {
      console.error('❌ Error creating group:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('groups.createGroupError')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setCreatedGroup(null);
  };

  const handleViewGroup = () => {
    if (createdGroup) {
      setShowSuccessModal(false);
      router.push({
        pathname: '/(tabs)/group-details',
        params: {
          groupId: createdGroup.groupId,
          groupName: createdGroup.name
        }
      });
    }
  };

  const handleGoToGroups = () => {
    setShowSuccessModal(false);
    router.push('/(tabs)/my-groups' as Href);
  };

  const selectedType = GROUP_TYPE_MAP[groupType];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>{t('groups.createGroupTitle')}</Text>
          <Text style={styles.subtitle}>{t('groups.createGroupSubtitle')}</Text>

          {/* Group Type Selector */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('groups.groupType')}</Text>
            <View style={styles.typeGrid}>
              {GROUP_TYPES.map((type) => {
                const isActive = groupType === type.id;
                return (
                  <Pressable
                    key={type.id}
                    style={[
                      styles.typeChip,
                      isActive && { borderColor: type.color, backgroundColor: type.color + '18' },
                    ]}
                    onPress={() => setGroupType(type.id)}
                    disabled={loading}
                  >
                    <Ionicons
                      name={type.icon}
                      size={20}
                      color={isActive ? type.color : palette.textMuted}
                    />
                    <Text
                      style={[
                        styles.typeChipLabel,
                        { color: isActive ? type.color : palette.textMuted },
                      ]}
                    >
                      {t(type.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.typeHint}>{t(selectedType.descriptionKey)}</Text>
          </View>

          {/* Property Metadata — only shown when type is "propiedad" */}
          {groupType === 'propiedad' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('groups.propertyType')}</Text>
              <View style={styles.typeGrid}>
                {PROPERTY_TYPES.map((pt) => {
                  const isActive = propertyTypeId === pt.id;
                  return (
                    <Pressable
                      key={pt.id}
                      style={[
                        styles.typeChip,
                        isActive && { borderColor: '#10B981', backgroundColor: '#10B98118' },
                      ]}
                      onPress={() => setPropertyTypeId(pt.id)}
                      disabled={loading}
                    >
                      <Ionicons
                        name={pt.icon}
                        size={18}
                        color={isActive ? '#10B981' : palette.textMuted}
                      />
                      <Text style={[styles.typeChipLabel, { color: isActive ? '#10B981' : palette.textMuted }]}>
                        {t(pt.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={[styles.input, { marginTop: palette.spacing.sm }]}
                placeholder={t('groups.propertyAddressPlaceholder')}
                placeholderTextColor={palette.textMuted}
                value={propertyAddress}
                onChangeText={setPropertyAddress}
                maxLength={100}
                editable={!loading}
              />
              <Text style={styles.typeHint}>{t('groups.propertyAddress')}</Text>
            </View>
          )}

          {/* Group Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('groups.groupName')} *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder={t('groups.groupNamePlaceholder')}
              placeholderTextColor={palette.textMuted}
              value={formData.name}
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
              maxLength={50}
              autoCapitalize="words"
              editable={!loading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('groups.descriptionOptional')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder={t('groups.descriptionPlaceholder')}
              placeholderTextColor={palette.textMuted}
              value={formData.description}
              onChangeText={(text) => {
                setFormData({ ...formData, description: text });
                if (errors.description) {
                  setErrors({ ...errors, description: '' });
                }
              }}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!loading}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            <Text style={styles.characterCount}>
              {formData.description.length}/200
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <ThemedButton
              title={t('common.cancel')}
              onPress={handleCancel}
              disabled={loading}
              variant="secondary"
              style={styles.button}
              textStyle={styles.cancelButtonText}
            />

            <ThemedButton
              title={t('groups.createGroup')}
              onPress={handleCreateGroup}
              loading={loading}
              disabled={loading || !formData.name.trim()}
              variant="primary"
              style={styles.button}
            />
          </View>
        </View>
      </ScrollView>

      {createdGroup && (
        <GroupCreatedModal
          visible={showSuccessModal}
          onClose={handleCloseModal}
          groupData={createdGroup}
          onViewGroup={handleViewGroup}
          onGoToGroups={handleGoToGroups}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: palette.spacing.xl,
      paddingVertical: palette.spacing.xl,
      gap: palette.spacing.lg,
    },
    formContainer: {
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      ...palette.shadow.card,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: palette.text,
      textAlign: 'center',
      marginBottom: palette.spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
      marginBottom: palette.spacing.lg,
    },
    inputContainer: {
      marginBottom: palette.spacing.lg,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: palette.spacing.xs,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: palette.spacing.sm,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: palette.radius.pill,
      borderWidth: 1.5,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceAlt,
    },
    typeChipLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    typeHint: {
      fontSize: 12,
      color: palette.textMuted,
      marginTop: palette.spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: palette.radius.md,
      padding: palette.spacing.sm,
      fontSize: 16,
      backgroundColor: palette.surfaceAlt,
      color: palette.text,
    },
    textArea: {
      minHeight: 80,
    },
    inputError: {
      borderColor: palette.accent,
    },
    errorText: {
      color: palette.accent,
      fontSize: 12,
      marginTop: 4,
    },
    characterCount: {
      fontSize: 12,
      color: palette.textMuted,
      textAlign: 'right',
      marginTop: 4,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: palette.spacing.lg,
      gap: palette.spacing.md,
    },
    button: {
      flex: 1,
    },
    cancelButtonText: {
      color: palette.textMuted,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
