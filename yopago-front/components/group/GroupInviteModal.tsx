import { ThemedButton } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { GroupDetailsResponse } from '../../services/types';

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

interface GroupInviteModalProps {
  visible: boolean;
  onClose: () => void;
  groupData: GroupDetailsResponse;
}

export default function GroupInviteModal({
  visible,
  onClose,
  groupData,
}: GroupInviteModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const copyCodeToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(groupData.code);
      Alert.alert(t('groups.inviteCopied'), t('groups.inviteCopiedMsg'));
    } catch (error) {
      console.error('Error copying code:', error);
      Alert.alert(t('common.error'), t('groups.inviteCopyError'));
    }
  };

  const shareGroupInvite = async () => {
    const deepLink = ExpoLinking.createURL('/join-group', {
      queryParams: { code: groupData.code },
    });

    const inviteBaseUrl = process.env.EXPO_PUBLIC_INVITE_BASE_URL;
    const normalizedBaseUrl = typeof inviteBaseUrl === 'string' && inviteBaseUrl.trim().length > 0
      ? inviteBaseUrl.replace(/\/$/, '')
      : null;
    const webLink = normalizedBaseUrl
      ? `${normalizedBaseUrl}/join?code=${encodeURIComponent(groupData.code)}`
      : null;

    const shareMessageLines = [
      `¡Te invito a unirte a mi grupo "${groupData.name}"!`,
      '',
      `Código de invitación: ${groupData.code}`,
    ];

    if (deepLink) {
      shareMessageLines.push('', `Únete desde la app: ${deepLink}`);
    }

    if (webLink) {
      shareMessageLines.push(`Únete desde el navegador: ${webLink}`);
    }

    shareMessageLines.push('', '¡Únete para compartir gastos fácilmente!');

    const shareMessage = shareMessageLines.join('\n');

    const whatsappDeepLink = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
    const whatsappWebLink = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

    try {
      const canUseWhatsapp = await Linking.canOpenURL(whatsappDeepLink);

      if (canUseWhatsapp) {
        await Linking.openURL(whatsappDeepLink);
        return;
      }

      await Linking.openURL(whatsappWebLink);
    } catch (whatsappError) {
      console.error('Error compartiendo por WhatsApp:', whatsappError);
      try {
        await Share.share({
          message: shareMessage,
          title: `Invitación al grupo ${groupData.name}`,
          url: webLink ?? deepLink,
        });
      } catch (shareError) {
        console.error('Error using share menu:', shareError);
        Alert.alert(t('groups.inviteShareError'), t('groups.inviteShareErrorMsg'));
      }
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('groups.inviteModalClose')}
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
            >
              <IconSymbol name="xmark" size={22} color={palette.textMuted} />
            </Pressable>
            <Text style={styles.title}>{t('groups.inviteModalTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('groups.inviteModalSubtitle', { name: groupData.name })}
            </Text>
          </View>

          {/* Información del Grupo */}
          <View style={styles.infoCard}>
            <Text style={styles.groupName}>{groupData.name}</Text>
            {groupData.description && (
              <Text style={styles.groupDescription}>{groupData.description}</Text>
            )}
            <View style={styles.groupStats}>
              <Text style={styles.statItem}>👥 {groupData.totalMembers} {t('groups.inviteModalMembers')}</Text>
              <Text style={styles.statItem}>💰 {groupData.totalExpenses} {t('groups.inviteModalExpenses')}</Text>
            </View>
          </View>

          {/* Código QR */}
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>{t('groups.inviteQrTitle')}</Text>
            <View style={styles.qrContainer}>
              {groupData.qrCodeBase64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${groupData.qrCodeBase64}` }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>📱</Text>
                  <Text style={styles.qrPlaceholderSubtext}>
                    {t('groups.inviteQrUnavailable')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.qrInstructions}>
              {t('groups.inviteQrHint')}
            </Text>
          </View>

          {/* Código de Invitación */}
          <View style={styles.codeCard}>
            <Text style={styles.codeTitle}>{t('groups.inviteCodeTitle')}</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{groupData.code}</Text>
              <ThemedButton
                title={t('groups.inviteCodeCopy')}
                onPress={copyCodeToClipboard}
                style={styles.copyButton}
                textStyle={styles.copyButtonText}
                variant="secondary"
              />
            </View>
            <Text style={styles.codeInstructions}>
              {t('groups.inviteCodeHint')}
            </Text>
          </View>

          {/* Botones de Acción */}
          <View style={styles.actionButtons}>
            <ThemedButton
              title={t('groups.inviteWhatsapp')}
              onPress={shareGroupInvite}
              fullWidth
            />
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (palette: AppPalette) => {
  const cardBase = {
    backgroundColor: palette.surface,
    borderRadius: palette.radius.md,
    padding: palette.spacing.lg,
    marginBottom: palette.spacing.lg,
    ...palette.shadow.card,
  };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: palette.spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: palette.spacing.lg,
      marginTop: palette.spacing.md,
    },
      closeButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        padding: palette.spacing.xs,
        borderRadius: palette.radius.lg,
      },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: palette.text,
      textAlign: 'center',
      marginBottom: palette.spacing.xs,
    },
    subtitle: {
      fontSize: 16,
      color: palette.textMuted,
      textAlign: 'center',
    },
    infoCard: {
      ...cardBase,
    },
    groupName: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
      marginBottom: palette.spacing.xs,
      textAlign: 'center',
    },
    groupDescription: {
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
      marginBottom: palette.spacing.sm,
      fontStyle: 'italic',
    },
    groupStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: palette.spacing.sm,
    },
    statItem: {
      fontSize: 14,
      color: palette.text,
      fontWeight: '600',
    },
    qrCard: {
      ...cardBase,
      alignItems: 'center',
    },
    qrTitle: {
      fontSize: 18,
      fontWeight: '700',
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
    qrPlaceholder: {
      width: 200,
      height: 200,
      backgroundColor: applyAlpha(palette.textMuted, 0.12),
      borderRadius: palette.radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: applyAlpha(palette.textMuted, 0.2),
      borderStyle: 'dashed',
    },
    qrPlaceholderText: {
      fontSize: 48,
      marginBottom: palette.spacing.xs,
    },
    qrPlaceholderSubtext: {
      fontSize: 12,
      color: palette.textMuted,
      textAlign: 'center',
    },
    qrInstructions: {
      fontSize: 12,
      color: palette.textMuted,
      textAlign: 'center',
      maxWidth: 250,
    },
    codeCard: {
      ...cardBase,
    },
    codeTitle: {
      fontSize: 18,
      fontWeight: '700',
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
    },
    codeText: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: palette.primary,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    copyButton: {
      minHeight: 0,
      paddingHorizontal: palette.spacing.sm,
      paddingVertical: palette.spacing.xs,
      borderRadius: palette.radius.sm,
      marginLeft: palette.spacing.sm,
    },
    copyButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    codeInstructions: {
      fontSize: 12,
      color: palette.textMuted,
      textAlign: 'center',
    },
      actionButtons: {
        rowGap: palette.spacing.sm,
        marginBottom: palette.spacing.lg,
      },
  });
};