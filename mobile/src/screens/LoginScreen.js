import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function LoginScreen({ navigation }) {
  const handleLogin = () => {
    // TODO: Implement actual OAuth2/OIDC authentication flow with Keycloak
    // This is a placeholder that bypasses authentication for demo purposes
    // See: https://docs.expo.dev/guides/authentication/#authsession
    // 
    // For production, use expo-auth-session with Keycloak endpoints:
    // - Discovery URL: http://keycloak:8180/realms/yopago/.well-known/openid-configuration
    // - Client ID: yopago-mobile (configured in Keycloak)
    console.warn('⚠️ Using demo login bypass - implement proper OAuth2 flow for production');
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Welcome to YoPago
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Track and split expenses with friends
      </Text>
      <Button mode="contained" onPress={handleLogin} style={styles.button}>
        Login with Keycloak
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    marginBottom: 10,
  },
  subtitle: {
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
  },
});
