import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  Image,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CreateGroupResponse } from '../../services/types';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedButton } from '../ui/Button';

interface GroupCreatedModalProps {
  visible: boolean;
  onClose: () => void;
  groupData: CreateGroupResponse;
  onViewGroup: () => void;
  onGoToGroups: () => void;
}

export default function GroupCreatedModal({
  visible,
  onClose,
  groupData,
  onViewGroup,
  onGoToGroups,
}: GroupCreatedModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const styles = useMemo(() => createStyles(palette), [palette]);

  const copyCodeToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(groupData.joinCode);
      Alert.alert('Copiado', 'Código copiado al portapapeles');
    } catch (error) {
      console.error('Error copiando código:', error);
      Alert.alert('Error', 'No se pudo copiar el código');
    }
  };

  const shareGroupInfo = async () => {
    try {
      const shareMessage = `¡Te invito a unirte a mi grupo "${groupData.name}"!\n\nCódigo de invitación: ${groupData.joinCode}\n\n¡Únete para compartir gastos fácilmente!`;
      
      await Share.share({
        message: shareMessage,
        title: `Invitación al grupo ${groupData.name}`,
      });
    } catch (error) {
      console.error('Error compartiendo:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>¡Grupo Creado!</Text>
            <Text style={styles.subtitle}>
              Tu grupo &quot;{groupData.name}&quot; está listo
            </Text>
          </View>

          {/* Información del Grupo */}
          <View style={styles.infoCard}>
            <Text style={styles.groupName}>{groupData.name}</Text>
            {groupData.description && (
              <Text style={styles.groupDescription}>{groupData.description}</Text>
            )}
            <Text style={styles.createdDate}>
              Creado el {new Date(groupData.createdAt).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>

          {/* Código QR */}
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Código QR para unirse</Text>
            <View style={styles.qrContainer}>
              <Image
                source={{ uri: `data:image/png;base64,${groupData.qrCodeBase64}` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.qrInstructions}>
              Los miembros pueden escanear este código para unirse al grupo
            </Text>
          </View>

          {/* Código de Invitación */}
          <View style={styles.codeCard}>
            <Text style={styles.codeTitle}>Código de Invitación</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{groupData.joinCode}</Text>
                <ThemedButton
                  title="Copiar"
                  onPress={copyCodeToClipboard}
                  variant="secondary"
                  style={styles.copyButton}
                  textStyle={styles.copyButtonText}
                />
            </View>
            <Text style={styles.codeInstructions}>
              Comparte este código para que otros se unan manualmente
            </Text>
          </View>

          {/* Botones de Acción */}
          <View style={styles.actionButtons}>
            <ThemedButton
              title="Compartir Invitación"
              onPress={shareGroupInfo}
              variant="primary"
              style={styles.actionButton}
              fullWidth
            />

            <ThemedButton
              title="Ver Grupo"
              onPress={onViewGroup}
              variant="secondary"
              style={styles.actionButton}
              fullWidth
            />

            <ThemedButton
              title="Mis Grupos"
              onPress={onGoToGroups}
              variant="ghost"
              style={styles.actionButton}
              fullWidth
              textStyle={styles.groupsButtonText}
            />
          </View>

          {/* Botón Cerrar */}
          <ThemedButton
            title="Cerrar"
            onPress={onClose}
            variant="ghost"
            style={styles.closeButton}
            textStyle={styles.closeButtonText}
            fullWidth
          />
        </ScrollView>
      </View>
    </Modal>
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
      padding: palette.spacing.lg,
      gap: palette.spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: palette.spacing.xl,
      marginTop: palette.spacing.lg,
    },
    title: {
      fontSize: palette.font.title,
      fontWeight: 'bold',
      color: palette.primary,
      textAlign: 'center',
      marginBottom: palette.spacing.xs,
    },
    subtitle: {
      fontSize: palette.font.body,
      color: palette.textMuted,
      textAlign: 'center',
    },
    infoCard: {
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      marginBottom: palette.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      ...palette.shadow.card,
    },
    groupName: {
      fontSize: palette.font.h2,
      fontWeight: 'bold',
      color: palette.text,
      marginBottom: palette.spacing.xs,
      textAlign: 'center',
    },
    groupDescription: {
      fontSize: palette.font.body,
      color: palette.textMuted,
      textAlign: 'center',
      marginBottom: palette.spacing.sm,
      fontStyle: 'italic',
    },
    createdDate: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      textAlign: 'center',
    },
    qrCard: {
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      marginBottom: palette.spacing.lg,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      ...palette.shadow.card,
    },
    qrTitle: {
      fontSize: palette.font.h2,
      fontWeight: 'bold',
      color: palette.text,
      marginBottom: palette.spacing.md,
    },
    qrContainer: {
      backgroundColor: palette.surfaceAlt,
      borderRadius: palette.radius.md,
      padding: palette.spacing.md,
      marginBottom: palette.spacing.md,
    },
    qrImage: {
      width: 200,
      height: 200,
    },
    qrInstructions: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      textAlign: 'center',
      maxWidth: 250,
    },
    codeCard: {
      backgroundColor: palette.surface,
      borderRadius: palette.radius.lg,
      padding: palette.spacing.lg,
      marginBottom: palette.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      ...palette.shadow.card,
    },
    codeTitle: {
      fontSize: palette.font.h2,
      fontWeight: 'bold',
      color: palette.text,
      marginBottom: palette.spacing.md,
      textAlign: 'center',
    },
    codeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surfaceAlt,
      borderRadius: palette.radius.md,
      padding: palette.spacing.sm,
      marginBottom: palette.spacing.sm,
      gap: palette.spacing.sm,
    },
    codeText: {
      flex: 1,
      fontSize: palette.font.h2,
      fontWeight: 'bold',
      color: palette.primary,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    copyButton: {
      minHeight: 40,
      paddingVertical: palette.spacing.xs,
      paddingHorizontal: palette.spacing.md,
    },
    copyButtonText: {
      fontSize: palette.font.small,
      fontWeight: '600',
    },
    codeInstructions: {
      fontSize: palette.font.small,
      color: palette.textMuted,
      textAlign: 'center',
    },
    actionButtons: {
      gap: palette.spacing.sm,
      marginBottom: palette.spacing.lg,
    },
    actionButton: {
      alignSelf: 'stretch',
    },
    groupsButtonText: {
      color: palette.primary,
    },
    closeButton: {
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surface,
    },
    closeButtonText: {
      color: palette.textMuted,
      fontWeight: '600',
    },
  });
}