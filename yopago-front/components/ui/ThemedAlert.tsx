import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Colors, type AppPalette } from '@/constants/theme';

type ThemedAlertProps = {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  onDismiss?: () => void;
};

export function ThemedAlert({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  onDismiss,
}: ThemedAlertProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  if (!visible) {
    return null;
  }

  const handleButtonPress = (button: typeof buttons[0]) => {
    button.onPress?.();
    onDismiss?.();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.alertBox, { backgroundColor: palette.surface }]}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: palette.textMuted }]}>
              {message}
            </Text>
          ) : null}

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    { borderTopColor: palette.divider },
                    index > 0 && { borderLeftColor: palette.divider, borderLeftWidth: 0.5 },
                  ]}
                  onPress={() => handleButtonPress(button)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.cancelButtonText,
                      isDestructive && styles.destructiveButtonText,
                      { color: isDestructive ? '#ff3b30' : palette.primary },
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook helper para mostrar alerts temáticos fácilmente
export function useThemedAlert() {
  const [alertConfig, setAlertConfig] = React.useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons?: ThemedAlertProps['buttons'];
  }>({
    visible: false,
    title: '',
  });

  const showAlert = React.useCallback(
    (
      title: string,
      message?: string,
      buttons?: ThemedAlertProps['buttons']
    ) => {
      setAlertConfig({
        visible: true,
        title,
        message,
        buttons: buttons || [{ text: 'OK', style: 'default' }],
      });
    },
    []
  );

  const hideAlert = React.useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const AlertComponent = React.useMemo(
    () => (
      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={hideAlert}
      />
    ),
    [alertConfig, hideAlert]
  );

  return { showAlert, hideAlert, AlertComponent };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  alertBox: {
    minWidth: 270,
    maxWidth: 400,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '400',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  destructiveButtonText: {
    fontWeight: '400',
  },
});
