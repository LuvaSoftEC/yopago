import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { ThemedButton } from '@/components/ui/Button';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { handleApiError } from '@/services/apiService';
import { useAuthenticatedApiService } from '@/services/authenticatedApiService';

export default function JoinGroupScreen() {
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const placeholderColor = palette.textMuted;
  const authenticatedApi = useAuthenticatedApiService();

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Por favor ingresa el código de acceso del grupo');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔗 Attempting to join group...');
      const result = await authenticatedApi.joinGroup(joinCode.trim());

      console.log('✅ Resultado:', result);
      console.log('🔍 Estructura del resultado:', JSON.stringify(result, null, 2));

      const groupId = typeof result?.id === 'number' ? result.id : Number(result?.id);
      if (!Number.isFinite(groupId)) {
        throw new Error('Invalid response: could not determine the group');
      }

      if (result.alreadyMember) {
        Alert.alert('Información', 'Ya eres miembro de este grupo. Te llevaremos a los detalles.');
      }

      console.log('🚀 Navegando a group-details con groupId:', groupId);
      router.push(`/(tabs)/group-details?groupId=${groupId}`);
      
    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Error', handleApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const formatJoinCode = (text: string) => {
    // Convertir a mayúsculas y remover caracteres no válidos
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setJoinCode(cleaned);
  };

  useEffect(() => {
    const rawParam = Array.isArray(params.code) ? params.code[0] : params.code;
    if (typeof rawParam !== 'string') {
      return;
    }
    const cleaned = rawParam.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length > 0) {
      setJoinCode(cleaned);
    }
  }, [params.code]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.joinIcon}>🔗</Text>
          </View>

          <Text style={styles.title}>Unirse a un Grupo</Text>
          <Text style={styles.subtitle}>
            Ingresa el código de acceso que te compartieron para unirte al grupo
          </Text>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Código de Acceso</Text>
              <TextInput
                style={styles.codeInput}
                value={joinCode}
                onChangeText={formatJoinCode}
                placeholder="Ej: D76675ED"
                placeholderTextColor={placeholderColor}
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect={false}
                selectionColor={palette.tint}
                textAlign="center"
              />
              <Text style={styles.inputHelp}>Introduce el código de 8 caracteres</Text>
            </View>

            <View style={styles.buttonGroup}>
              <ThemedButton
                title="🚀 Unirse al Grupo"
                onPress={handleJoinGroup}
                loading={isLoading}
                disabled={isLoading || !joinCode.trim()}
                variant="primary"
                fullWidth
                style={styles.primaryButton}
              />
              <ThemedButton
                title="Cancelar"
                onPress={() => router.back()}
                disabled={isLoading}
                variant="secondary"
                fullWidth
                style={styles.secondaryButton}
                textStyle={styles.secondaryButtonText}
              />
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📱 ¿Cómo obtener el código?</Text>
          <View style={styles.stepsList}>
            <Text style={styles.stepText}>1. Pide al administrador del grupo que comparta el código</Text>
            <Text style={styles.stepText}>2. También puedes escanear el código QR si está disponible</Text>
            <Text style={styles.stepText}>3. El código tiene 8 caracteres (letras y números)</Text>
          </View>
        </View>

        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>💡 Ejemplo de código: D76675ED</Text>
          <Text style={styles.exampleText}>
            Los códigos son únicos para cada grupo y permiten acceso inmediato
          </Text>
        </View>
      </ScrollView>
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
      alignItems: 'center',
      paddingHorizontal: palette.spacing.xl,
      paddingVertical: palette.spacing.xl,
      gap: palette.spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      alignItems: 'center',
      gap: palette.spacing.md,
      ...palette.shadow.card,
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: palette.radius.pill,
      backgroundColor: palette.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    joinIcon: {
      fontSize: 30,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: palette.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    formContainer: {
      width: '100%',
      gap: palette.spacing.md,
    },
    inputGroup: {
      gap: palette.spacing.xs,
      width: '100%',
      alignItems: 'stretch',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    codeInput: {
      width: '100%',
      maxWidth: 260,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surfaceAlt,
      color: palette.text,
      paddingVertical: palette.spacing.sm,
      paddingHorizontal: palette.spacing.md,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 4,
      fontFamily: palette.fontFamily.semiBold,
      alignSelf: 'center',
    },
    inputHelp: {
      fontSize: 13,
      color: palette.textMuted,
      textAlign: 'center',
    },
    buttonGroup: {
      gap: palette.spacing.sm,
    },
    primaryButton: {
      alignSelf: 'stretch',
    },
    secondaryButton: {
      alignSelf: 'stretch',
    },
    secondaryButtonText: {
      fontWeight: '600',
    },
    infoCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      gap: palette.spacing.sm,
      ...palette.shadow.soft,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    stepsList: {
      gap: palette.spacing.xs,
    },
    stepText: {
      fontSize: 14,
      color: palette.textMuted,
      lineHeight: 20,
    },
    exampleCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      alignItems: 'center',
      gap: palette.spacing.xs,
      ...palette.shadow.soft,
    },
    exampleTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      textAlign: 'center',
    },
    exampleText: {
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}