import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedButton } from '../ui/Button';

const applyAlpha = (hexColor: string, alpha: number) => {
  const sanitized = hexColor.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface LoginFormProps {
  onLoginSuccess?: () => void;
  onSwitchToRegister?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'plain';
  showDemoUsers?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLoginSuccess,
  onSwitchToRegister,
  style,
  variant = 'card',
  showDemoUsers = true,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});

  const { t } = useTranslation();
  const { login, isLoading, error } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const inputBackground = colorScheme === 'dark' ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.92)';
  const inputTextColor = colorScheme === 'dark' ? '#f8fafc' : palette.text;
  const placeholderColor = colorScheme === 'dark' ? 'rgba(248,250,252,0.86)' : 'rgba(15,23,42,0.55)';
  const labelColor = colorScheme === 'dark' ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.68)';
  const outlineColor = colorScheme === 'dark' ? 'rgba(148,163,184,0.32)' : 'rgba(15,23,42,0.22)';

  const inputTheme = useMemo(
    () => ({
      colors: {
        primary: palette.tint,
        background: inputBackground,
        surface: inputBackground,
        text: inputTextColor,
        placeholder: placeholderColor,
        onSurface: inputTextColor,
        onSurfaceVariant: labelColor,
        outline: outlineColor,
      },
    }),
    [inputBackground, inputTextColor, labelColor, outlineColor, palette.tint, placeholderColor],
  );

  useEffect(() => {
    setFieldErrors({});
  }, [variant]);

  const handleLogin = async () => {
    const validation = validateForm();
    if (validation) {
      setFieldErrors(validation);
      return;
    }
  setFieldErrors({});
  setIsSubmitting(true);

    try {
      const success = await login({ username: username.trim(), password });

      if (success) {
        setUsername('');
        setPassword('');
        onLoginSuccess?.();
      }
    } catch (err) {
      console.error('Error en login:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  function validateForm() {
    const errors: {[key: string]: string} = {};
    if (!username.trim()) errors.username = t('auth.emailRequired');
    if (!password.trim()) errors.password = t('auth.passwordRequired');
    return Object.keys(errors).length ? errors : null;
  }

  const isButtonDisabled = isSubmitting || isLoading || !username.trim() || !password.trim();
  const isPlain = variant === 'plain';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: palette.background }, isPlain && styles.containerPlain, style]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContainer, isPlain && styles.scrollContainerPlain]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.formContainer,
            {
              backgroundColor: palette.surface,
              borderColor: palette.divider,
            },
            isPlain && styles.formContainerPlain,
          ]}
        >
          {!isPlain && (
            <Text style={[styles.title, { color: palette.text }]}>{t('auth.login')}</Text>
          )}

          {error && (
            <View
              style={[
                styles.errorContainer,
                { backgroundColor: '#2d0707', borderColor: '#b71c1c' },
              ]}
            >
              <Text style={[styles.errorText, { color: '#ff5252' }]}>{error}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <PaperTextInput
              label={t('auth.email')}
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              editable={!isSubmitting && !isLoading}
              textColor={inputTextColor}
              placeholderTextColor={placeholderColor}
              selectionColor={palette.tint}
              theme={inputTheme}
            />
            {fieldErrors.username && <Text style={{ color: palette.accent, marginTop: 2, marginLeft: 4, fontSize: 13 }}>{fieldErrors.username}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <PaperTextInput
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              editable={!isSubmitting && !isLoading}
              textColor={inputTextColor}
              placeholderTextColor={placeholderColor}
              selectionColor={palette.tint}
              theme={inputTheme}
            />
            {fieldErrors.password && <Text style={{ color: palette.accent, marginTop: 2, marginLeft: 4, fontSize: 13 }}>{fieldErrors.password}</Text>}
          </View>

          <ThemedButton
            title={t('auth.enterButton')}
            onPress={handleLogin}
            loading={isSubmitting || isLoading}
            disabled={isButtonDisabled}
            variant="primary"
            fullWidth
            style={[styles.loginButton, isPlain && styles.loginButtonPlain]}
          />

          {onSwitchToRegister && !isPlain && (
            <ThemedButton
              title={t('auth.noAccountRegister')}
              onPress={onSwitchToRegister}
              disabled={isSubmitting}
              variant="ghost"
              style={[styles.switchButton, isPlain && styles.switchButtonPlain]}
              textStyle={[
                styles.switchButtonText,
                { color: palette.tint },
                isPlain && styles.switchButtonTextPlain,
                isPlain && { color: palette.tint },
              ]}
            />
          )}

          {showDemoUsers && (
            <View
              style={[
                styles.demoContainer,
                {
                  backgroundColor: applyAlpha(palette.primary, 0.12),
                  borderColor: applyAlpha(palette.primary, 0.35),
                },
                isPlain && styles.demoContainerPlain,
                isPlain && {
                  backgroundColor: applyAlpha(palette.primary, 0.16),
                  borderColor: applyAlpha(palette.primary, 0.3),
                },
              ]}
            >
              <Text style={[styles.demoTitle, { color: palette.primary }, isPlain && styles.demoTitlePlain]}>
                Usuarios de prueba:
              </Text>
              <Text style={[styles.demoText, { color: palette.text }, isPlain && styles.demoTextPlain, isPlain && { color: palette.text }]}>Usuario: pagador</Text>
              <Text style={[styles.demoText, { color: palette.text }, isPlain && styles.demoTextPlain, isPlain && { color: palette.text }]}>Contraseña: password123</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerPlain: {
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  scrollContainerPlain: {
    padding: 0,
    justifyContent: 'flex-start',
  },
  formContainer: {
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 4,
  },
  formContainerPlain: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
  },
  titlePlain: {
    textAlign: 'left',
    fontSize: 24,
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#fee',
    borderColor: '#f66',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorContainerPlain: {
    backgroundColor: 'rgba(254,242,242,0.9)',
    borderColor: 'rgba(248,113,113,0.65)',
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
    textAlign: 'center',
  },
  errorTextPlain: {
    textAlign: 'left',
  },
  inputContainer: {
    marginBottom: 18,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8, // margen lateral para que el input no toque el borde del card
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelPlain: {
    color: '#1f2937',
  },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'left',
    backgroundColor: 'rgba(30,41,59,0.55)', // fondo semitransparente acorde al card
    color: '#F2F6FA', // texto claro
  },
  inputPlain: {
    backgroundColor: 'rgba(30,41,59,0.55)',
    color: '#F2F6FA',
    textAlign: 'left',
  },
  loginButton: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  loginButtonPlain: {
    alignSelf: 'center',
    width: '100%',
  },
  demoContainer: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  demoContainerPlain: {
    backgroundColor: 'rgba(241,245,249,0.9)',
    borderColor: 'rgba(148,163,184,0.4)',
    alignSelf: 'stretch',
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  demoTitlePlain: {
    textAlign: 'left',
  },
  demoText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  demoTextPlain: {
    textAlign: 'left',
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? undefined : undefined,
  },
  switchButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  switchButtonPlain: {
    alignSelf: 'flex-start',
  },
  switchButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  switchButtonTextPlain: {
    textAlign: 'left',
  },
});

export default LoginForm;