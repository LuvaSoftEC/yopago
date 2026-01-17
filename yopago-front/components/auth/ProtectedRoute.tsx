import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRoles?: string[];
  showLoginButton?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback, 
  requiredRoles = [],
  showLoginButton = true
}) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Verificando autenticación...</Text>
      </View>
    );
  }

  // Si no está autenticado, mostrar pantalla de login
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Acceso Restringido</Text>
        <Text style={styles.message}>
          Necesitas iniciar sesión para acceder a esta sección
        </Text>
        
        {showLoginButton && (
          <Text style={styles.message}>
            Por favor, ve a la pantalla de inicio de sesión para autenticarte.
          </Text>
        )}
      </View>
    );
  }

  // Verificar roles si se especificaron
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => hasRole(role));
    
    if (!hasRequiredRole) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Acceso Denegado</Text>
          <Text style={styles.message}>
            No tienes permisos suficientes para acceder a esta sección
          </Text>
          <Text style={styles.roleInfo}>
            Roles requeridos: {requiredRoles.join(', ')}
          </Text>
          <Text style={styles.roleInfo}>
            Tus roles: {user?.roles.join(', ') || 'Sin roles'}
          </Text>
        </View>
      );
    }
  }

  // Si todo está bien, mostrar el contenido protegido
  return <>{children}</>;
};

interface AuthButtonProps {
  style?: any;
  textStyle?: any;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ style, textStyle }) => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  if (isLoading) {
    return (
      <View style={[styles.authButton, style]}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  if (isAuthenticated) {
    return (
      <TouchableOpacity 
        style={[styles.authButton, styles.logoutButton, style]} 
        onPress={logout}
      >
        <Text style={[styles.authButtonText, textStyle]}>
          Cerrar Sesión ({user?.username})
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.authButton, styles.loginButton, style]}>
      <Text style={[styles.authButtonText, textStyle]}>
        No autenticado
      </Text>
    </View>
  );
};

interface UserInfoProps {
  style?: any;
}

export const UserInfo: React.FC<UserInfoProps> = ({ style }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <View style={[styles.userInfo, style]}>
      <Text style={styles.userName}>
        {user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.username
        }
      </Text>
      <Text style={styles.userEmail}>{user.email}</Text>
      {user.roles.length > 0 && (
        <Text style={styles.userRoles}>
          Roles: {user.roles.join(', ')}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  roleInfo: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  authButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#0066CC',
  },
  logoutButton: {
    backgroundColor: '#CC3300',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  userRoles: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});

export default ProtectedRoute;