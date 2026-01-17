import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { handleApiError } from '@/services/apiService';
import { authenticatedApiService } from '@/services/authenticatedApiService';
import { type GroupMember, type ProcessReceiptResponse } from '@/services/types';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    Linking,
    Pressable,
    Image as RNImage,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

type PermissionSnapshot = {
  camera: boolean;
  mediaLibrary: boolean;
  gallery: boolean;
};

const initialPermissions: PermissionSnapshot = {
  camera: false,
  mediaLibrary: false,
  gallery: false,
};

type FileKind = 'image' | 'pdf' | 'other';

type SelectedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  kind: FileKind;
};

const determineFileKind = (mimeType?: string | null, name?: string | null): FileKind => {
  const lowerMime = mimeType?.toLowerCase() ?? '';
  const lowerName = name?.toLowerCase() ?? '';

  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }

  if (lowerMime.startsWith('image/') || /\.(jpe?g|png|gif|bmp|heic|webp)$/i.test(lowerName)) {
    return 'image';
  }

  return 'other';
};

export type CaptureReceiptContentProps = {
  groupId?: number;
  onClose?: () => void;
  onProcessed?: () => void;
  groupMembers?: GroupMember[];
  defaultPayerId?: number | null;
  onReceiptReady?: (payload: ReceiptProcessingPayload) => void;
  processReceipt?: (
    fileUri: string,
    groupId: number,
    options: {
      fileName?: string;
      currency?: string;
      note?: string;
      payerId?: number;
    }
  ) => Promise<ProcessReceiptResponse>;
};

export type ReceiptProcessingPayload = {
  expense: ProcessReceiptResponse['expense'];
  ocrText?: string;
  payerId: number;
  note: string;
  currency: string;
  imageUri: string;
  fileName?: string;
  mimeType?: string;
  fileKind?: FileKind;
};

export function CaptureReceiptContent({
  groupId,
  onClose,
  onProcessed,
  groupMembers,
  defaultPayerId = null,
  onReceiptReady,
  processReceipt,
}: CaptureReceiptContentProps) {
  const initialPayerId = typeof defaultPayerId === 'number'
    ? defaultPayerId
    : groupMembers?.[0]?.id ?? null;
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissions, setPermissions] = useState<PermissionSnapshot>(initialPermissions);
  const [payerId, setPayerId] = useState<number | null>(initialPayerId);
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');

  const sparkleOpacity = useRef(new Animated.Value(1)).current;
  const sparkleRotation = useRef(new Animated.Value(0)).current;
  const sparkleAnimations = useRef<Animated.CompositeAnimation[]>([]);
  const sparkleRotationDeg = useMemo(
    () =>
      sparkleRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [sparkleRotation],
  );

  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();

  useEffect(() => {
    sparkleAnimations.current.forEach((animation) => animation.stop());
    sparkleAnimations.current = [];

    if (!isProcessing) {
      sparkleOpacity.setValue(1);
      sparkleRotation.setValue(0);
      return;
    }

    sparkleOpacity.setValue(0.6);
    sparkleRotation.setValue(0);

    const fade = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleOpacity, {
          toValue: 0.6,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const rotate = Animated.loop(
      Animated.timing(sparkleRotation, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    sparkleAnimations.current = [fade, rotate];
    fade.start();
    rotate.start();

    return () => {
      sparkleAnimations.current.forEach((animation) => animation.stop());
      sparkleAnimations.current = [];
    };
  }, [isProcessing, sparkleOpacity, sparkleRotation]);

  useEffect(() => {
    if (typeof defaultPayerId === 'number') {
      setPayerId(defaultPayerId);
      return;
    }

    if (groupMembers?.length) {
      setPayerId(groupMembers[0].id);
    } else {
      setPayerId(null);
    }
  }, [defaultPayerId, groupMembers]);

  const payerName = useMemo(() => {
    if (!groupMembers?.length || payerId === null) {
      return null;
    }

    const member = groupMembers.find((candidate) => candidate.id === payerId);
    return member?.name || member?.email || String(member?.id ?? '');
  }, [groupMembers, payerId]);

  const handleCurrencyChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^a-zA-Z]/g, '').toUpperCase();
    setCurrency(cleaned.slice(0, 4));
  }, []);

  const hasAllPermissions = permissions.camera && permissions.mediaLibrary && permissions.gallery;

  const requestPermissions = useCallback(async () => {
    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      // MediaLibrary is optional, skip if it fails
      let mediaPermission = { status: 'granted' };
      try {
        mediaPermission = await MediaLibrary.requestPermissionsAsync();
      } catch (e) {
        console.warn('MediaLibrary permission request failed, continuing anyway');
      }

      setPermissions({
        camera: cameraPermission.status === 'granted',
        mediaLibrary: mediaPermission.status === 'granted',
        gallery: galleryPermission.status === 'granted',
      });
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Permisos', 'No se pudieron obtener los permisos necesarios.');
    }
  }, []);

  useEffect(() => {
    void requestPermissions();
  }, [requestPermissions]);

  const ensurePermissions = useCallback(() => {
    if (hasAllPermissions) {
      return true;
    }

    Alert.alert(
      'Permisos requeridos',
      'Necesitamos acceso a tu cámara y galería para capturar la factura.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Permitir',
          onPress: () => {
            Linking.openSettings().catch(() => {
              void requestPermissions();
            });
          },
        },
      ],
    );

    return false;
  }, [hasAllPermissions, requestPermissions]);

  const takePhoto = useCallback(async () => {
    if (!ensurePermissions()) {
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const name = asset.fileName ?? `receipt_${Date.now()}.jpg`;
        const mimeType = asset.mimeType ?? 'image/jpeg';

        setSelectedFile({
          uri: asset.uri,
          name,
          mimeType,
          kind: determineFileKind(mimeType, name),
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Ups', 'No pudimos abrir la cámara.');
    }
  }, [ensurePermissions]);

  const pickImage = useCallback(async () => {
    if (!permissions.gallery) {
      ensurePermissions();
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const name = asset.fileName ?? `receipt_${Date.now()}.jpg`;
        const mimeType = asset.mimeType ?? 'image/jpeg';

        setSelectedFile({
          uri: asset.uri,
          name,
          mimeType,
          kind: determineFileKind(mimeType, name),
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Ups', 'No pudimos abrir tu galería.');
    }
  }, [ensurePermissions, permissions.gallery]);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      const typedResult = result as DocumentPicker.DocumentPickerSuccessResult & {
        uri?: string | null;
        name?: string | null;
        mimeType?: string | null;
        size?: number | null;
        fileCopyUri?: string | null;
      };

      if (typedResult.canceled) {
        return;
      }

      const baseAsset = typedResult.assets && typedResult.assets.length > 0
        ? typedResult.assets[0]
        : {
            uri: typedResult.uri ?? null,
            name: typedResult.name ?? null,
            mimeType: typedResult.mimeType ?? null,
            size: typedResult.size ?? null,
            fileCopyUri: typedResult.fileCopyUri ?? null,
          };

      const asset = baseAsset as DocumentPicker.DocumentPickerAsset & { fileCopyUri?: string | null };
      const uri = asset.fileCopyUri ?? asset.uri;
      if (!uri) {
        Alert.alert('Ups', 'No pudimos acceder al archivo seleccionado.');
        return;
      }

      const name = asset.name ?? `receipt_${Date.now()}.pdf`;
      const mimeType = asset.mimeType ?? 'application/pdf';

      setSelectedFile({
        uri,
        name,
        mimeType,
        kind: determineFileKind(mimeType, name),
      });
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Ups', 'No pudimos abrir el selector de documentos.');
    }
  }, []);

  const goBack = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    router.back();
  }, [onClose, router]);

  const handleProcessed = useCallback(() => {
    if (onProcessed) {
      onProcessed();
    }

    if (onClose) {
      onClose();
    } else {
      router.push('/(tabs)');
    }
  }, [onClose, onProcessed, router]);

  const processReceiptHandler = useMemo(() => {
    if (typeof processReceipt === 'function') {
      return processReceipt;
    }
    return authenticatedApiService.processReceipt.bind(authenticatedApiService);
  }, [processReceipt]);

  const handleProcessReceipt = useCallback(async () => {
    if (!selectedFile) {
      Alert.alert('Selecciona un archivo', 'Primero toma una foto, elige una imagen o adjunta un PDF.');
      return;
    }

    if (typeof groupId !== 'number' || Number.isNaN(groupId)) {
      Alert.alert('Grupo no disponible', 'No pudimos identificar el grupo para asociar la factura.');
      return;
    }

    if (payerId === null || Number.isNaN(payerId)) {
      Alert.alert('Identifica al pagador', 'Necesitamos saber quién pagó la factura para registrarla.');
      return;
    }

    setIsProcessing(true);
    try {
      const fallbackName = selectedFile.kind === 'pdf' ? `receipt_${Date.now()}.pdf` : `receipt_${Date.now()}.jpg`;
      const fileName = selectedFile.name?.trim() ? selectedFile.name.trim() : fallbackName;

      const response = await processReceiptHandler(selectedFile.uri, groupId, {
        fileName,
        note,
        currency,
        payerId,
      });

      if (!response?.expense) {
        throw new Error('El servidor no devolvió la información del gasto procesado.');
      }

      if (onReceiptReady) {
        onReceiptReady({
          expense: response.expense,
          ocrText: response.ocrText,
          payerId,
          note,
          currency,
          imageUri: selectedFile.uri,
          fileName,
          mimeType: selectedFile.mimeType ?? undefined,
          fileKind: selectedFile.kind,
        });
      } else {
        Alert.alert('Listo ✨', 'Procesamos la factura y extraímos los datos automáticamente.', [
          { text: 'Ver resultados', onPress: handleProcessed },
        ]);
      }
    } catch (error) {
      const message = handleApiError(error);
      Alert.alert('Error al procesar', message);
    } finally {
      setIsProcessing(false);
    }
  }, [currency, groupId, handleProcessed, note, onReceiptReady, payerId, processReceiptHandler, selectedFile]);

  const resetSelection = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const renderPermissionStatus = (label: string, granted: boolean) => {
    const background = granted ? `${palette.primary}22` : `${palette.warning}22`;
    const color = granted ? palette.primary : palette.warning;
    const icon: keyof typeof Ionicons.glyphMap = granted ? 'checkmark-circle' : 'alert-circle';

    return (
      <View
        key={label}
        style={[styles.permissionBadge, { backgroundColor: background }]}
      >
        <Ionicons name={icon} size={16} color={color} />
        <ThemedText style={{ color, fontWeight: '600', fontSize: 13 }}>{label}</ThemedText>
      </View>
    );
  };

  const tips: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'sunny', text: 'Ilumina bien la factura, sin reflejos fuertes.' },
    { icon: 'document-text', text: 'Alinea el documento completo dentro del recuadro.' },
    { icon: 'resize', text: 'Evita arrugas y acerca lo suficiente para que el texto sea legible.' },
  ];

  return (
    <ThemedView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: palette.spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar captura de factura"
            onPress={goBack}
            hitSlop={12}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color={palette.textMuted} />
          </Pressable>
          <ThemedText type="title" style={[styles.headerTitle, { color: palette.text }]}>Capturar factura</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: palette.textMuted }]}>
            Usa tu cámara o sube una imagen clara para reconocer automáticamente los datos del ticket.
          </ThemedText>
        </View>

        {!selectedFile ? (
          <View style={[styles.actionsCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <ThemedText type="subtitle" style={{ color: palette.text, fontSize: 16 }}>¿Cómo deseas cargarla?</ThemedText>

            <View style={styles.actionButtons}>
              <Pressable style={[styles.actionButton, { backgroundColor: palette.primary }]} onPress={takePhoto}>
                <Ionicons name="camera" size={20} color={palette.surface} />
                <ThemedText style={styles.actionButtonText}>Tomar foto</ThemedText>
                <ThemedText style={[styles.actionHint, { color: `${palette.surface}CC` }]}>Captura usando la cámara</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.galleryButton, { borderColor: palette.primary, backgroundColor: palette.surface }]}
                onPress={pickImage}
              >
                <Ionicons name="images-outline" size={20} color={palette.primary} />
                <ThemedText style={[styles.actionButtonText, { color: palette.primary }]}>Subir desde galería</ThemedText>
                <ThemedText style={[styles.actionHint, { color: palette.textMuted }]}>Selecciona una foto existente</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.galleryButton, { borderColor: palette.primary, backgroundColor: palette.surface }]}
                onPress={pickDocument}
              >
                <Ionicons name="document-text-outline" size={20} color={palette.primary} />
                <ThemedText style={[styles.actionButtonText, { color: palette.primary }]}>Importar PDF</ThemedText>
                <ThemedText style={[styles.actionHint, { color: palette.textMuted }]}>Adjunta un archivo en PDF</ThemedText>
              </Pressable>
            </View>

              <View style={styles.badgeRow}>
              {renderPermissionStatus('Cámara', permissions.camera)}
              {renderPermissionStatus('Almacenamiento', permissions.mediaLibrary)}
              {renderPermissionStatus('Galería', permissions.gallery)}
            </View>

            {!hasAllPermissions ? (
              <Pressable style={styles.permissionLink} onPress={requestPermissions}>
                <Ionicons name="refresh" size={16} color={palette.primary} />
                <ThemedText style={{ color: palette.primary, fontWeight: '600' }}>
                  Volver a solicitar permisos
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={[styles.previewCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <View style={styles.previewHeader}>
              <ThemedText type="subtitle" style={{ color: palette.text }}>
                {selectedFile.kind === 'image' ? 'Vista previa' : 'Archivo adjunto'}
              </ThemedText>
              <Pressable style={[styles.resetChip, { backgroundColor: `${palette.primary}18` }]} onPress={resetSelection}>
                <Ionicons name="swap-horizontal" size={16} color={palette.primary} />
                <ThemedText style={{ color: palette.primary, fontWeight: '600' }}>Cambiar archivo</ThemedText>
              </Pressable>
            </View>

            <View style={[styles.imageFrame, { backgroundColor: `${palette.text}08`, borderColor: palette.divider }]}>
              {selectedFile.kind === 'image' ? (
                <RNImage source={{ uri: selectedFile.uri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.filePreviewFallback, { backgroundColor: `${palette.primary}18` }]}
                >
                  <Ionicons
                    name={selectedFile.kind === 'pdf' ? 'document-text-outline' : 'document-attach-outline'}
                    size={32}
                    color={palette.primary}
                  />
                  <ThemedText
                    style={{ color: palette.text, fontWeight: '600' }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedFile.name}
                  </ThemedText>
                  <ThemedText style={[styles.actionHint, { color: palette.textMuted }]}>
                    {selectedFile.mimeType ?? 'Archivo adjunto'}
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={[styles.metadataCard, { backgroundColor: palette.surfaceAlt, borderColor: palette.divider }]}>
              <ThemedText type="subtitle" style={{ color: palette.text, fontSize: 15 }}>
                Detalles para el recibo
              </ThemedText>
              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: palette.textMuted }]}>Moneda</ThemedText>
                <TextInput
                  value={currency}
                  onChangeText={handleCurrencyChange}
                  placeholder="USD"
                  placeholderTextColor={`${palette.textMuted}99`}
                  autoCapitalize="characters"
                  keyboardType="default"
                  style={[
                    styles.textInput,
                    {
                      color: palette.text,
                      borderColor: palette.divider,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: palette.textMuted }]}>Nota opcional</ThemedText>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ej. Cena equipo"
                  placeholderTextColor={`${palette.textMuted}99`}
                  style={[
                    styles.textInput,
                    {
                      color: palette.text,
                      borderColor: palette.divider,
                      backgroundColor: palette.surface,
                    },
                  ]}
                  maxLength={120}
                />
              </View>

              {/* Pagador detectado removido por solicitud del usuario */}
            </View>

            <ThemedText style={{ color: palette.textMuted, fontSize: 13 }}>
              Archivo seleccionado: <ThemedText style={{ color: palette.text, fontWeight: '600' }}>{selectedFile.name}</ThemedText>
            </ThemedText>

            <Pressable
              style={[styles.primaryAction, isProcessing && styles.primaryActionDisabled, { backgroundColor: palette.primary }]}
              onPress={handleProcessReceipt}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <View style={styles.processingRow}>
                  <Animated.View
                    style={[
                      styles.processingIcon,
                      {
                        opacity: sparkleOpacity,
                        transform: [{ rotate: sparkleRotationDeg }],
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={20} color={palette.surface} />
                  </Animated.View>
                  <ThemedText style={styles.primaryActionText}>Procesando factura…</ThemedText>
                </View>
              ) : (
                <View style={styles.processingRow}>
                  <Ionicons name="rocket-outline" size={18} color={palette.surface} />
                  <ThemedText style={styles.primaryActionText}>Procesar y extraer datos</ThemedText>
                </View>
              )}
            </Pressable>
          </View>
        )}

          <View style={[styles.tipsCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <ThemedText type="subtitle" style={{ color: palette.text, fontSize: 16 }}>Tips para un escaneo perfecto</ThemedText>
          <View style={styles.tipList}>
            {tips.map((tip) => (
              <View key={tip.text} style={styles.tipRow}>
                <View style={[styles.tipIconWrapper, { backgroundColor: `${palette.primary}18` }]}
                >
                  <Ionicons name={tip.icon} size={16} color={palette.primary} />
                </View>
                <ThemedText style={{ flex: 1, color: palette.textMuted }}>{tip.text}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: palette.spacing.md,
      gap: palette.spacing.md,
    },
    header: {
      alignItems: 'center',
      marginBottom: palette.spacing.sm,
      marginTop: palette.spacing.xs,
      position: 'relative',
    },
    closeButton: {
      position: 'absolute',
      top: 0,
      right: 0,
      padding: palette.spacing.xs,
      borderRadius: palette.radius.lg,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: palette.spacing.xs,
    },
    headerSubtitle: {
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: palette.spacing.xl,
    },
    heroCard: {
      flexDirection: 'row',
      gap: palette.spacing.sm,
      padding: palette.spacing.md,
      borderRadius: palette.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      ...palette.shadow.card,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: palette.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroText: {
      flex: 1,
      gap: palette.spacing.xs,
    },
    actionsCard: {
      gap: palette.spacing.md,
      padding: palette.spacing.md,
      borderRadius: palette.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      ...palette.shadow.card,
    },
    actionButtons: {
      gap: palette.spacing.sm,
    },
    actionButton: {
      borderRadius: palette.radius.lg,
      padding: palette.spacing.sm,
      gap: palette.spacing.xs,
    },
    galleryButton: {
      borderWidth: StyleSheet.hairlineWidth,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.surface,
    },
    actionHint: {
      fontSize: 12,
      color: palette.textMuted,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: palette.spacing.sm,
    },
    permissionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
    },
    permissionLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: palette.spacing.xs,
      alignSelf: 'flex-start',
    },
    previewCard: {
      gap: palette.spacing.sm,
      padding: palette.spacing.md,
      borderRadius: palette.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      ...palette.shadow.card,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    resetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: palette.spacing.xs,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.pill,
    },
    imageFrame: {
      width: '100%',
      borderRadius: palette.radius.md,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
    },
    filePreviewFallback: {
      flex: 1,
      minHeight: 200,
      alignItems: 'center',
      justifyContent: 'center',
      gap: palette.spacing.xs,
      padding: palette.spacing.md,
    },
    previewImage: {
      width: '100%',
      height: 280,
      resizeMode: 'contain',
    },
    metadataCard: {
      gap: palette.spacing.sm,
      padding: palette.spacing.sm,
      borderRadius: palette.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
    },
    fieldGroup: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    textInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: palette.radius.sm,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: 10,
      fontSize: 15,
    },
    primaryAction: {
      borderRadius: palette.radius.lg,
      paddingVertical: palette.spacing.sm,
      alignItems: 'center',
    },
    primaryActionDisabled: {
      opacity: 0.6,
    },
    processingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: palette.spacing.sm,
    },
    processingIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryActionText: {
      fontWeight: '700',
      color: palette.surface,
      fontSize: 15,
    },
    tipsCard: {
      padding: palette.spacing.md,
      gap: palette.spacing.sm,
      borderRadius: palette.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      ...palette.shadow.card,
    },
    tipList: {
      gap: palette.spacing.sm,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: palette.spacing.sm,
    },
    tipIconWrapper: {
      width: 24,
      height: 24,
      borderRadius: palette.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
