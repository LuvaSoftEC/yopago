import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { authService, User, LoginCredentials, RegisterCredentials, RegisterResponse } from '../services/authService';

interface AuthContextType {
  // Estado
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Acciones
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  clearError: () => void;
  hasRole: (role: string) => boolean;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const navigateToLogin = useCallback(() => {
    try {
      router.replace('/login' as Href);
    } catch (navigationError) {
      console.error('❌ Error redirigiendo al login:', navigationError);
    }
  }, [router]);

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, []);

  const performLogout = useCallback(
    async (reason: 'manual' | 'expired') => {
      const isManual = reason === 'manual';

      if (isManual) {
        setIsLoading(true);
      }

      setError(null);
      clearSessionTimer();

      try {
        if (isManual) {
          console.log('🚪 Cerrando sesión...');
        } else {
          console.log('⌛ Sesión expirada, cerrando sesión automáticamente...');
        }

        await authService.logout();
      } catch (err: any) {
        console.error('❌ Error cerrando sesión:', err);

        if (isManual) {
          setError('Error al cerrar sesión, pero se ha cerrado localmente');
        }
      } finally {
        setUser(null);
        setIsAuthenticated(false);

        if (isManual) {
          setIsLoading(false);
        }

        const alertTitle = isManual ? 'Sesión Cerrada' : 'Sesión expirada';
        const alertMessage = isManual
          ? 'Has cerrado sesión exitosamente'
          : 'Tu sesión ha caducado. Inicia sesión nuevamente.';

        Alert.alert(alertTitle, alertMessage, [
          {
            text: 'Ir al inicio de sesión',
            onPress: navigateToLogin,
          },
        ]);

        navigateToLogin();
      }
    },
    [clearSessionTimer, navigateToLogin],
  );

  const scheduleSessionExpiryCheck = useCallback(async () => {
    clearSessionTimer();

    const expiryTime = await authService.getTokenExpiry();
    if (!expiryTime) {
      return;
    }

    const gracePeriod = authService.getTokenGracePeriod();
    const triggerTime = expiryTime - gracePeriod;
    const delay = triggerTime - Date.now();

    if (delay <= 0) {
      performLogout('expired');
      return;
    }

    sessionTimerRef.current = setTimeout(() => {
      performLogout('expired').catch((err) =>
        console.error('❌ Error al manejar expiración automática:', err),
      );
    }, delay);
  }, [clearSessionTimer, performLogout]);

  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔧 Inicializando autenticación...');
      
      // Verificar si ya hay una sesión activa
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        const currentUser = await authService.getUserInfo();
        setUser(currentUser);
        setIsAuthenticated(true);
        console.log('✅ Usuario ya autenticado:', currentUser?.username);
        await scheduleSessionExpiryCheck();
      } else {
        console.log('ℹ️ No hay sesión activa');
        setUser(null);
        setIsAuthenticated(false);
        clearSessionTimer();
        navigateToLogin();
      }
    } catch (err) {
      console.error('❌ Error inicializando autenticación:', err);
      setError('Error al verificar el estado de autenticación');
      setUser(null);
      setIsAuthenticated(false);
      clearSessionTimer();
      navigateToLogin();
    } finally {
      setIsLoading(false);
    }
  }, [clearSessionTimer, navigateToLogin, scheduleSessionExpiryCheck]);

  /**
   * Inicializa el contexto verificando si el usuario ya está autenticado
   */
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => () => {
    clearSessionTimer();
  }, [clearSessionTimer]);

  /**
   * Registra un nuevo usuario
   */
  const register = async (credentials: RegisterCredentials): Promise<RegisterResponse> => {
    try {
      setError(null);
      
      console.log('🚀 Registrando usuario:', credentials.username);
      
      const result = await authService.register(credentials);
      
      console.log('✅ Registro exitoso');
      return result;
    } catch (err) {
      console.error('❌ Error en registro:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error en el registro';
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Inicia el proceso de login con credenciales
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 Iniciando proceso de login...');
      
      const tokens = await authService.login(credentials);
      
      if (tokens) {
        const currentUser = await authService.getUserInfo();
        setUser(currentUser);
        setIsAuthenticated(true);
        
        console.log('✅ Login exitoso:', currentUser?.username);

        await scheduleSessionExpiryCheck();
        
        // Mostrar mensaje de bienvenida
        Alert.alert(
          '¡Bienvenido!',
          `Hola ${currentUser?.firstName || currentUser?.username}`,
          [{ text: 'OK' }]
        );
        
        return true;
      } else {
        setError('Credenciales inválidas');
        return false;
      }
    } catch (err: any) {
      console.error('❌ Error en login:', err);
      
      let errorMessage = 'Error al iniciar sesión';
      
      if (err.message?.includes('conectar con Keycloak')) {
        errorMessage = 'No se puede conectar con el servidor de autenticación. Verifica que Keycloak esté funcionando.';
      } else if (err.message?.includes('cancelado')) {
        errorMessage = 'Login cancelado por el usuario';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      Alert.alert(
        'Error de Autenticación',
        errorMessage,
        [{ text: 'OK' }]
      );
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Cierra la sesión del usuario
   */
  const logout = useCallback(async (): Promise<void> => {
    await performLogout('manual');
  }, [performLogout]);

  /**
   * Refresca el estado de autenticación
   */
  const refreshAuth = async (): Promise<boolean> => {
    try {
      setError(null);
      
      console.log('🔄 Refrescando autenticación...');
      
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        const currentUser = await authService.getUserInfo();
        setUser(currentUser);
        setIsAuthenticated(true);
        await scheduleSessionExpiryCheck();
        return true;
      } else {
        setUser(null);
        setIsAuthenticated(false);
        clearSessionTimer();
        navigateToLogin();
        return false;
      }
    } catch (err: any) {
      console.error('❌ Error refrescando autenticación:', err);
      setError('Error al refrescar la autenticación');
      setUser(null);
      setIsAuthenticated(false);
      clearSessionTimer();
      navigateToLogin();
      return false;
    }
  };

  /**
   * Limpia el estado de error
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Verifica si el usuario tiene un rol específico
   */
  const hasRole = (role: string): boolean => {
    return user?.roles.includes(role) || false;
  };

  /**
   * Obtiene el access token actual
   */
  const getAccessToken = async (): Promise<string | null> => {
    try {
      return await authService.getAccessToken();
    } catch (err) {
      console.error('❌ Error obteniendo access token:', err);
      return null;
    }
  };

  const contextValue: AuthContextType = {
    // Estado
    user,
    isAuthenticated,
    isLoading,
    error,

    // Acciones
    login,
    register,
    logout,
    refreshAuth,
    clearError,
    hasRole,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para usar el contexto de autenticación
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  
  return context;
};

/**
 * Hook para verificar si el usuario está autenticado (con loading)
 */
export const useAuthRequired = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  return {
    isAuthenticated,
    isLoading,
    requiresAuth: !isAuthenticated && !isLoading,
  };
};

/**
 * Hook para proteger componentes que requieren roles específicos
 */
export const useRoleGuard = (requiredRoles: string[]) => {
  const { user, hasRole, isAuthenticated } = useAuth();
  
  const hasRequiredRole = requiredRoles.some(role => hasRole(role));
  const canAccess = isAuthenticated && hasRequiredRole;
  
  return {
    canAccess,
    userRoles: user?.roles || [],
    requiredRoles,
    hasRequiredRole,
  };
};

export default AuthProvider;