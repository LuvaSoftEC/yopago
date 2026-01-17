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
  // Claves para AsyncStorage
  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: '@yopago/access_token',
    REFRESH_TOKEN: '@yopago/refresh_token',
    USER_INFO: '@yopago/user_info',
    TOKEN_EXPIRY: '@yopago/token_expiry',
  };
  private readonly TOKEN_GRACE_PERIOD_MS = 5 * 60 * 1000;

  /**
   * Registra un nuevo usuario usando tu API backend
   */
  async register(credentials: RegisterCredentials): Promise<RegisterResponse> {
    try {
      console.log('🚀 Registrando nuevo usuario...');
      
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
          console.warn('⚠️ No se pudo parsear la respuesta de registro como JSON:', parseError);
        }
      }

      const result: RegisterResponse = parsed ?? {
        success: response.ok,
        message: response.ok
          ? 'Registro completado exitosamente.'
          : `Error en el registro (código ${response.status})`,
      };

      console.log('📝 Respuesta del registro:', result.success ? 'Exitoso' : 'Falló');

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Error en el registro');
      }

      console.log('✅ Usuario registrado exitosamente:', result.data?.username ?? credentials.username);
      return result;
    } catch (error) {
      console.error('❌ Error en registro:', error);
      throw error;
    }
  }

  /**
   * Realiza el login usando tu API backend
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens | null> {
    try {
      console.log('🚀 Iniciando login con API backend...');
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result: LoginResponse = await response.json();
      
      console.log('📝 Respuesta del servidor:', result.success ? 'Exitosa' : 'Falló');

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Error en el login');
      }

      if (result.data) {
        await this.storeTokens(result.data);
        
        // Obtener información del usuario del token
        const userInfo = await this.getUserInfoFromToken(result.data.access_token);
        if (userInfo) {
          await this.storeUserInfo(userInfo);
        }
        
        console.log('✅ Login exitoso y tokens almacenados');
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('❌ Error en login:', error);
      throw error;
    }
  }

  /**
   * Extrae información del usuario del JWT token
   */
  private async getUserInfoFromToken(accessToken: string): Promise<User | null> {
    try {
      // Decodificar el JWT (parte del payload está en base64)
      const tokenParts = accessToken.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Token JWT inválido');
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

      console.log('👤 Información del usuario extraída:', userInfo.username);
      return userInfo;
    } catch (error) {
      console.error('❌ Error extrayendo info del usuario:', error);
      return null;
    }
  }

  /**
   * Almacena los tokens en AsyncStorage
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
      console.error('❌ Error almacenando tokens:', error);
      throw error;
    }
  }

  /**
   * Almacena la información del usuario
   */
  private async storeUserInfo(userInfo: User): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
    } catch (error) {
      console.error('❌ Error almacenando info del usuario:', error);
    }
  }

  /**
   * Verifica si hay un token válido almacenado
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

      // Verificar si el token no ha expirado (con margen)
      return now < (expiryTime - this.TOKEN_GRACE_PERIOD_MS);
    } catch (error) {
      console.error('❌ Error verificando autenticación:', error);
      return false;
    }
  }

  /**
   * Obtiene el token de acceso actual
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        return null;
      }
      return await AsyncStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('❌ Error obteniendo token:', error);
      return null;
    }
  }

  /**
   * Obtiene la información del usuario almacenada
   */
  async getUserInfo(): Promise<User | null> {
    try {
      const userInfoStr = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_INFO);
      if (!userInfoStr) {
        return null;
      }
      return JSON.parse(userInfoStr);
    } catch (error) {
      console.error('❌ Error obteniendo info del usuario:', error);
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
      console.error('❌ Error verificando rol:', error);
      return false;
    }
  }

  /**
   * Cierra la sesión del usuario
   */
  async logout(): Promise<void> {
    try {
      console.log('👋 Cerrando sesión...');
      
      // Limpiar AsyncStorage
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.removeItem(this.STORAGE_KEYS.USER_INFO),
        AsyncStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXPIRY),
      ]);

      console.log('✅ Sesión cerrada exitosamente');
    } catch (error) {
      console.error('❌ Error cerrando sesión:', error);
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
      console.log('⚠️ Refresh token no implementado, se requiere re-login');
      return false;
    } catch (error) {
      console.error('❌ Error refrescando token:', error);
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
      console.error('❌ Error obteniendo expiración del token:', error);
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
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
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