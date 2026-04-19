import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { keycloakDirectAuth } from '../../services/keycloakDirectAuth';

interface DirectLoginFormProps {
  onLoginSuccess: () => void;
  style?: any;
}

export const DirectLoginForm: React.FC<DirectLoginFormProps> = ({
  onLoginSuccess,
  style
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth.loginErrorEmpty'));
      return;
    }

    try {
      setIsLoading(true);

      const result = await keycloakDirectAuth.directLogin({
        username: username.trim(),
        password: password.trim(),
      });

      if (result) {
        Alert.alert(t('common.success'), t('auth.loginSuccessMessage'), [
          { text: t('common.ok'), onPress: onLoginSuccess }
        ]);
      }
    } catch (error: any) {
      console.error('Error en login:', error);

      let errorMessage = t('auth.loginError');
      if (error.message?.includes('Invalid user credentials')) {
        errorMessage = t('auth.loginInvalidCredentials');
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(t('auth.loginErrorTitle'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{t('auth.login')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('auth.usernameShort')}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[styles.loginButton, isLoading && styles.disabledButton]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginButtonText}>{t('auth.login')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#0066CC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DirectLoginForm;