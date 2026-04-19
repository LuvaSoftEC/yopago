import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from './config';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  phoneNumber?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    keycloak_user_id: string;
    username: string;
    email: string;
    name: string;
  };
  error?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: AuthTokens;
  error?: string;
}

class AuthService {
  // Keys for AsyncStorage
  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: '@yopago/access_token',
    REFRESH_TOKEN: '@yopago/refresh_token',
    USER_INFO: '@yopago/user_info',
    TOKEN_EXPIRY: '@yopago/token_expiry',
  };
  private readonly TOKEN_GRACE_PERIOD_MS = 5 * 60 * 1000;

  /**
   * Registers a new user using your backend API
   */
  async register(credentials: RegisterCredentials): Promise<RegisterResponse> {
    try {
      console.log('🚀 Registering new user...');
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      const rawBody = await response.text();
      let parsed: RegisterResponse | null = null;

      if (rawBody && rawBody.trim().length > 0) {
        try {
          parsed = JSON.parse(rawBody);
        } catch (parseError) {
          console.warn('⚠️ Could not parse the registration response as JSON:', parseError);
        }
      }

      const result: RegisterResponse = parsed ?? {
        success: response.ok,
        message: response.ok
          ? 'Registro completado exitosamente.'
          : `Error en el registro (código ${response.status})`,
      };

      console.log('📝 Registration response:', result.success ? 'Successful' : 'Failed');

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Error en el registro');
      }

      console.log('✅ User registered successfully:', result.data?.username ?? credentials.username);
      return result;
    } catch (error) {
      console.error('❌ Error in registration:', error);
      throw error;
    }
  }

  /**
   * Performs login using your backend API
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens | null> {
    try {
      console.log('🚀 Starting login with backend API...');
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result: LoginResponse = await response.json();
      
      console.log('📝 Server response:', result.success ? 'Successful' : 'Failed');

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Error en el login');
      }

      if (result.data) {
        await this.storeTokens(result.data);
        
        // Get user information from the token
        const userInfo = await this.getUserInfoFromToken(result.data.access_token);
        if (userInfo) {
          await this.storeUserInfo(userInfo);
        }
        
        console.log('✅ Login successful and tokens stored');
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('❌ Error in login:', error);
      throw error;
    }
  }

  /**
   * Extracts user information from the JWT token
   */
  private async getUserInfoFromToken(accessToken: string): Promise<User | null> {
    try {
      // Decode the JWT (the payload part is base64 encoded)
      const tokenParts = accessToken.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid JWT token');
      }

      const payload = JSON.parse(atob(tokenParts[1]));
      
      const userInfo: User = {
        id: payload.sub || '',
        username: payload.preferred_username || '',
        email: payload.email || '',
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        roles: payload.realm_access?.roles || [],
      };

      console.log('👤 User information extracted:', userInfo.username);
      return userInfo;
    } catch (error) {
      console.error('❌ Error extracting user info:', error);
      return null;
    }
  }

  /**
   * Stores tokens in AsyncStorage
   */
  private async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      const expiryTime = Date.now() + (tokens.expires_in * 1000);
      
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token),
        AsyncStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token),
        AsyncStorage.setItem(this.STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString()),
      ]);
    } catch (error) {
      console.error('❌ Error storing tokens:', error);
      throw error;
    }
  }

  /**
   * Stores user information
   */
  private async storeUserInfo(userInfo: User): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
    } catch (error) {
      console.error('❌ Error storing user info:', error);
    }
  }

  /**
   * Checks if there is a valid stored token
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const [accessToken, expiryTimeStr] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(this.STORAGE_KEYS.TOKEN_EXPIRY),
      ]);

      if (!accessToken || !expiryTimeStr) {
        return false;
      }

      const expiryTime = parseInt(expiryTimeStr);
      const now = Date.now();

      if (Number.isNaN(expiryTime)) {
        return false;
      }

      // Check if the token has not expired (with grace period)
      return now < (expiryTime - this.TOKEN_GRACE_PERIOD_MS);
    } catch (error) {
      console.error('❌ Error verifying authentication:', error);
      return false;
    }
  }

  /**
   * Gets the current access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        return null;
      }
      return await AsyncStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('❌ Error getting token:', error);
      return null;
    }
  }

  /**
   * Gets the stored user information
   */
  async getUserInfo(): Promise<User | null> {
    try {
      const userInfoStr = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_INFO);
      if (!userInfoStr) {
        return null;
      }
      return JSON.parse(userInfoStr);
    } catch (error) {
      console.error('❌ Error getting user info:', error);
      return null;
    }
  }

  /**
   * Verifica si el usuario tiene un rol específico
   */
  async hasRole(role: string): Promise<boolean> {
    try {
      const userInfo = await this.getUserInfo();
      return userInfo?.roles.includes(role) || false;
    } catch (error) {
      console.error('❌ Error verifying role:', error);
      return false;
    }
  }

  /**
   * Cierra la sesión del usuario
   */
  async logout(): Promise<void> {
    try {
      console.log('👋 Logging out...');
      
      // Limpiar AsyncStorage
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.removeItem(this.STORAGE_KEYS.USER_INFO),
        AsyncStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXPIRY),
      ]);

      console.log('✅ Session closed successfully');
    } catch (error) {
      console.error('❌ Error logging out:', error);
      throw error;
    }
  }

  /**
   * Refresca el token de acceso usando el refresh token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await AsyncStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        return false;
      }

      // Aquí puedes implementar el endpoint de refresh si tu API lo tiene
      // Por ahora, retornamos false para forzar re-login
      console.log('⚠️ Refresh token not implemented, re-login required');
      return false;
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      return false;
    }
  }

  async getTokenExpiry(): Promise<number | null> {
    try {
      const expiryTimeStr = await AsyncStorage.getItem(this.STORAGE_KEYS.TOKEN_EXPIRY);
      if (!expiryTimeStr) {
        return null;
      }

      const expiryTime = parseInt(expiryTimeStr, 10);
      return Number.isNaN(expiryTime) ? null : expiryTime;
    } catch (error) {
      console.error('❌ Error getting token expiry:', error);
      return null;
    }
  }

  getTokenGracePeriod(): number {
    return this.TOKEN_GRACE_PERIOD_MS;
  }

  /**
   * Crea headers de autorización para requests autenticados
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('No hay token de acceso disponible');
    }

    return {
      'Authorization': `Bearer ${token}`,
      ...API_CONFIG.DEFAULT_HEADERS,
    };
  }

  /**
   * Hace un request autenticado a la API
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });

    // Si el token ha expirado, intentar refrescar
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        await this.logout();
        throw new Error('Session expired. Please log in again.');
      }
      
      // Reintentar con el nuevo token
      const newHeaders = await this.getAuthHeaders();
      return fetch(url, {
        ...options,
        headers: {
          ...newHeaders,
          ...(options.headers || {}),
        },
      });
    }

    return response;
  }
}

// Exportar una instancia singleton
export const authService = new AuthService();
export default authService;