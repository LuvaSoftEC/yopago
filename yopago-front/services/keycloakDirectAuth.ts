import { KEYCLOAK_CONFIG } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DirectLoginCredentials {
  username: string;
  password: string;
}

export interface DirectLoginResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

class KeycloakDirectAuth {
  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: '@yopago/access_token',
    REFRESH_TOKEN: '@yopago/refresh_token',
    USER_INFO: '@yopago/user_info',
    TOKEN_EXPIRY: '@yopago/token_expiry',
  };

  /**
   * Login directo con usuario y contraseña (Resource Owner Password Credentials Grant)
   */
  async directLogin(credentials: DirectLoginCredentials): Promise<DirectLoginResponse | null> {
    try {
      console.log('🔐 Iniciando login directo con Keycloak...');
      
      // Endpoint de token de Keycloak
      const tokenEndpoint = `${KEYCLOAK_CONFIG.ISSUER}/protocol/openid-connect/token`;
      
      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: KEYCLOAK_CONFIG.CLIENT_ID,
        username: credentials.username,
        password: credentials.password,
        scope: KEYCLOAK_CONFIG.SCOPES.join(' '),
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Error de autenticación');
      }

      const tokenData: DirectLoginResponse = await response.json();
      
      // Almacenar tokens
      await this.storeTokens(tokenData);
      
      // Obtener información del usuario
      const userInfo = await this.getUserInfo(tokenData.access_token);
      await this.storeUserInfo(userInfo);
      
      console.log('✅ Login directo exitoso');
      return tokenData;
      
    } catch (error) {
      console.error('❌ Error en login directo:', error);
      throw error;
    }
  }

  /**
   * Obtiene información del usuario usando el access token
   */
  private async getUserInfo(accessToken: string) {
    try {
      const userInfoEndpoint = `${KEYCLOAK_CONFIG.ISSUER}/protocol/openid-connect/userinfo`;
      
      const response = await fetch(userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error obteniendo información del usuario');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error obteniendo información del usuario:', error);
      throw error;
    }
  }

  /**
   * Almacena los tokens en AsyncStorage
   */
  private async storeTokens(tokens: DirectLoginResponse): Promise<void> {
    try {
      const expiryTime = Date.now() + (tokens.expires_in * 1000);
      
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token),
        AsyncStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token),
        AsyncStorage.setItem(this.STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString()),
      ]);
      
      console.log('💾 Tokens almacenados correctamente');
    } catch (error) {
      console.error('❌ Error almacenando tokens:', error);
      throw error;
    }
  }

  /**
   * Almacena la información del usuario
   */
  private async storeUserInfo(userInfo: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
    } catch (error) {
      console.error('❌ Error almacenando información del usuario:', error);
      throw error;
    }
  }

  /**
   * Verifica si hay un token válido
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const accessToken = await AsyncStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
      const expiryTime = await AsyncStorage.getItem(this.STORAGE_KEYS.TOKEN_EXPIRY);
      
      if (!accessToken || !expiryTime) {
        return false;
      }

      const now = Date.now();
      const expiry = parseInt(expiryTime, 10);
      
      if (now >= expiry) {
        console.log('🔄 Token expirado, intentando renovar...');
        return await this.refreshToken();
      }

      return true;
    } catch (error) {
      console.error('❌ Error verificando autenticación:', error);
      return false;
    }
  }

  /**
   * Renueva el access token usando refresh token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await AsyncStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
      
      if (!refreshToken) {
        await this.logout();
        return false;
      }

      const tokenEndpoint = `${KEYCLOAK_CONFIG.ISSUER}/protocol/openid-connect/token`;
      
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: KEYCLOAK_CONFIG.CLIENT_ID,
        refresh_token: refreshToken,
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        await this.logout();
        return false;
      }

      const tokenData: DirectLoginResponse = await response.json();
      await this.storeTokens(tokenData);
      
      console.log('✅ Token renovado exitosamente');
      return true;
    } catch (error) {
      console.error('❌ Error renovando token:', error);
      await this.logout();
      return false;
    }
  }

  /**
   * Obtiene el access token actual
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        return null;
      }
      
      return await AsyncStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('❌ Error obteniendo access token:', error);
      return null;
    }
  }

  /**
   * Obtiene información del usuario actual
   */
  async getCurrentUser(): Promise<any> {
    try {
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        return null;
      }

      const userInfo = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_INFO);
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
      console.error('❌ Error obteniendo usuario actual:', error);
      return null;
    }
  }

  /**
   * Cierra sesión
   */
  async logout(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.removeItem(this.STORAGE_KEYS.USER_INFO),
        AsyncStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXPIRY),
      ]);
      
      console.log('✅ Sesión cerrada correctamente');
    } catch (error) {
      console.error('❌ Error cerrando sesión:', error);
      throw error;
    }
  }
}

export const keycloakDirectAuth = new KeycloakDirectAuth();
export default keycloakDirectAuth;