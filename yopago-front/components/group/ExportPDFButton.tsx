import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import type { GroupDetailsResponse } from '../../services/types';
import { generateGroupHTML } from '../../utils/generateGroupPDF';

interface ExportPDFButtonProps {
  groupDetails: GroupDetailsResponse;
  formatCurrency: (amount: number) => string;
  locale?: string;
}

export default function ExportPDFButton({
  groupDetails,
  formatCurrency,
  locale = 'es',
}: ExportPDFButtonProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [generating, setGenerating] = useState(false);

  const handleExport = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const html = generateGroupHTML(groupDetails, formatCurrency, locale);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert(t('common.error'), t('groups.exportPDFError'));
      }
    } catch (err) {
      console.error('[ExportPDFButton] Error generating PDF:', err);
      Alert.alert(t('common.error'), t('groups.exportPDFError'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={handleExport}
      disabled={generating}
      accessibilityLabel={t('groups.exportPDF')}
    >
      {generating ? (
        <ActivityIndicator size="small" color={palette.primary} />
      ) : (
        <Ionicons name="document-text-outline" size={20} color={palette.primary} />
      )}
      <Text style={styles.label}>
        {generating ? t('groups.exportPDFGenerating') : t('groups.exportPDF')}
      </Text>
    </Pressable>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: palette.radius.pill,
      borderWidth: 1,
      borderColor: palette.primary,
      backgroundColor: palette.primary + '12',
    },
    buttonPressed: {
      opacity: 0.7,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.primary,
    },
  });
}
