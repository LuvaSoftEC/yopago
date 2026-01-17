import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
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

export default function CreateGroupForm() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [createdGroup, setCreatedGroup] = useState<CreateGroupResponse | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre del grupo es obligatorio';
    }

    if (formData.name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = 'La descripción no puede exceder 200 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

      console.log('🔄 Enviando solicitud de creación de grupo:', groupRequest);
      
      const response = await authenticatedApiService.createGroup(groupRequest);
      
      console.log('✅ Grupo creado exitosamente:', response);

      // Guardar los datos del grupo creado y mostrar el modal
      setCreatedGroup(response);
      setShowSuccessModal(true);

      // Limpiar formulario
      setFormData({ name: '', description: '' });
      setErrors({});

    } catch (error) {
      console.error('❌ Error creando grupo:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No se pudo crear el grupo'
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

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Crear Nuevo Grupo</Text>
          <Text style={styles.subtitle}>
            Crea un grupo para compartir gastos con tus amigos
          </Text>

          {/* Nombre del Grupo */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre del Grupo *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Ej: Viaje a la playa"
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

          {/* Descripción */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Descripción (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder="Describe el propósito del grupo..."
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

          {/* Botones */}
          <View style={styles.buttonContainer}>
            <ThemedButton
              title="Cancelar"
              onPress={handleCancel}
              disabled={loading}
              variant="secondary"
              style={styles.button}
              textStyle={styles.cancelButtonText}
            />

            <ThemedButton
              title="Crear Grupo"
              onPress={handleCreateGroup}
              loading={loading}
              disabled={loading || !formData.name.trim()}
              variant="primary"
              style={styles.button}
            />
          </View>
        </View>
      </ScrollView>

      {/* Modal de éxito */}
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