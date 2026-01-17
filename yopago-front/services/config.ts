const resolveBaseUrl = () => {
  const envBaseUrl = process.env.EXPO_PUBLIC_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080/api';
    }
  }

  // Fallback si no hay EXPO_PUBLIC_BASE_URL definida (IP del Ingress en DO/K8s)
  return 'http://157.230.203.194/api';
};

const baseUrl = resolveBaseUrl();

const resolveWebSocketUrl = () => {
  const explicitWsUrl = process.env.EXPO_PUBLIC_WS_URL?.trim();
  if (explicitWsUrl) {
    return explicitWsUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : parsed.protocol === 'http:' ? 'ws:' : parsed.protocol;
    if (parsed.pathname.endsWith('/api') || parsed.pathname.endsWith('/api/')) {
      parsed.pathname = parsed.pathname.replace(/\/api\/?$/, '');
    }
    if (!parsed.pathname.endsWith('/ws')) {
      parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/ws`;
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    console.warn('⚠️ No se pudo derivar automáticamente la URL de WebSocket, usando fallback:', error);
    const sanitized = baseUrl.replace(/\/api\/?$/, '');
    const normalized = sanitized.endsWith('/ws') ? sanitized : `${sanitized.replace(/\/$/, '')}/ws`;
    if (normalized.startsWith('https://')) {
      return normalized.replace('https://', 'wss://');
    }
    if (normalized.startsWith('http://')) {
      return normalized.replace('http://', 'ws://');
    }
    return normalized;
  }
};

export const API_CONFIG = {
  // URL base de tu API de Java
  // Desarrollo local:
  // BASE_URL: 'http://localhost:8080/api', // Para pruebas locales
  BASE_URL: baseUrl,
  WS_URL: resolveWebSocketUrl(),
  
  // Para usar tu API en producción, cambia por algo como:
  // BASE_URL: 'https://tu-servidor.com/api',
  
  // Para usar un emulador de Android (usa la IP del host):
  // BASE_URL: 'http://10.0.2.2:8080/api',
  
  // Para dispositivo físico, usa la IP de tu computadora:
  // BASE_URL: 'http://192.168.1.100:8080/api',

  // Timeouts en milisegundos
  TIMEOUT: 30000, // 30 segundos para procesamiento de imágenes
  SHORT_TIMEOUT: 10000, // 10 segundos para operaciones rápidas

  // Configuración de autenticación (opcional)
  // Si tu API requiere autenticación, descomenta estas líneas:
  /*
  AUTH: {
    // Para Bearer token:
    TOKEN_HEADER: 'Authorization',
    TOKEN_PREFIX: 'Bearer ',
    
    // Para API Key:
    API_KEY_HEADER: 'X-API-Key',
  },
  */

  // Configuración de headers por defecto
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // Agrega headers adicionales si tu API los requiere:
    // 'X-App-Version': '1.0.0',
  },

  // Configuración de endpoints
  ENDPOINTS: {
    // Procesamiento de facturas
    PROCESS_RECEIPT: '/receipts/process',
    
    // Gestión de grupos
    GROUPS: '/groups/create', // Actualizado para coincidir con tu API
    USER_GROUPS: '/groups/user', // Obtener grupos del usuario
    JOIN_GROUP: '/groups/join', // Endpoint para unirse a un grupo
    GROUP_BY_ID: '/groups/:id',
    GROUP_DETAILS: '/groups/:id/details', // Detalles completos del grupo
    
    // Health check
    HEALTH: '/health',
    
    // Autenticación (si la usas)
    // LOGIN: '/auth/login',
    // LOGOUT: '/auth/logout',
  },
};

// Configuración de Keycloak
export const KEYCLOAK_CONFIG = {
  // URL de tu servidor Keycloak (ajusta según tu configuración)
  // ISSUER: 'http://localhost:8082/realms/yopago', // Para pruebas locales
  ISSUER: process.env.EXPO_PUBLIC_ISSUER || 'http://localhost:8082/realms/yopago',
  



  // Cliente configurado en Keycloak
  CLIENT_ID: 'yopago-mobile', // Cliente para la aplicación móvil
  
  // URLs de redirección - Usamos el scheme personalizado de Expo
  REDIRECT_URI: 'yopago://auth', // URL scheme personalizado
  
  // Scopes solicitados
  SCOPES: ['openid', 'profile', 'email'],
  
  // Configuraciones adicionales
  ADDITIONAL_PARAMETERS: {},
  
  // Si usas un emulador de Android:
  // ISSUER: 'http://10.0.2.2:8082/realms/yopago',
  
  // Si usas un dispositivo físico (cambia por la IP de tu computadora):
  // ISSUER: 'http://192.168.1.100:8082/realms/yopago',
};

/**
 * Instrucciones para configurar tu API de Java:
 * 
 * Tu API de Java debe tener los siguientes endpoints:
 * 
 * 1. POST /api/receipts/process
 *    Body: { imageBase64: string, fileName: string, groupId?: string }
 *    Response: { success: boolean, receiptId: string, vendor: string, date: string, total: number, items: Array, error?: string }
 * 
 * 2. POST /api/groups
 *    Body: { name: string, description?: string }
 *    Response: { success: boolean, group?: Group, error?: string }
 * 
 * 3. GET /api/groups
 *    Response: { groups: Array<Group> }
 * 
 * 4. GET /api/groups/:id
 *    Response: { group: Group }
 * 
 * 5. GET /api/health
 *    Response: { status: "ok" }
 * 
 * Asegúrate de que tu API:
 * - Acepte JSON en el Content-Type
 * - Retorne JSON en las respuestas
 * - ⚠️ MANEJE CORS CORRECTAMENTE (ver instrucciones abajo)
 * - Tenga manejo de errores apropiado
 */

export default API_CONFIG;