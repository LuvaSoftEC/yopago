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

  // Fallback if EXPO_PUBLIC_BASE_URL is not defined (Ingress IP on DO/K8s)
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
    console.warn('⚠️ Could not automatically derive the WebSocket URL, using fallback:', error);
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
  // Base URL of your Java API
  // Local development:
  // BASE_URL: 'http://localhost:8080/api', // For local testing
  BASE_URL: baseUrl,
  WS_URL: resolveWebSocketUrl(),
  
  // To use your API in production, change to something like:
  // BASE_URL: 'https://your-server.com/api',

  // To use an Android emulator (use the host IP):
  // BASE_URL: 'http://10.0.2.2:8080/api',

  // For a physical device, use your computer's IP:
  // BASE_URL: 'http://192.168.1.100:8080/api',

  // Timeouts in milliseconds
  TIMEOUT: 30000, // 30 seconds for image processing
  SHORT_TIMEOUT: 10000, // 10 seconds for fast operations

  // Authentication configuration (optional)
  // If your API requires authentication, uncomment these lines:
  /*
  AUTH: {
    // For Bearer token:
    TOKEN_HEADER: 'Authorization',
    TOKEN_PREFIX: 'Bearer ',

    // For API Key:
    API_KEY_HEADER: 'X-API-Key',
  },
  */

  // Default headers configuration
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // Add additional headers if your API requires them:
    // 'X-App-Version': '1.0.0',
  },

  // Endpoints configuration
  ENDPOINTS: {
    // Receipt processing
    PROCESS_RECEIPT: '/receipts/process',

    // Groups management
    GROUPS: '/groups/create', // Updated to match your API
    USER_GROUPS: '/groups/user', // Get user groups
    JOIN_GROUP: '/groups/join', // Endpoint to join a group
    GROUP_BY_ID: '/groups/:id',
    GROUP_DETAILS: '/groups/:id/details', // Full group details

    // Health check
    HEALTH: '/health',

    // Authentication (if used)
    // LOGIN: '/auth/login',
    // LOGOUT: '/auth/logout',
  },
};

// Keycloak configuration
export const KEYCLOAK_CONFIG = {
  // URL of your Keycloak server (adjust according to your configuration)
  // ISSUER: 'http://localhost:8082/realms/yopago', // For local testing
  ISSUER: process.env.EXPO_PUBLIC_ISSUER || 'http://localhost:8082/realms/yopago',
  



  // Client configured in Keycloak
  CLIENT_ID: 'yopago-mobile', // Client for the mobile application

  // Redirect URLs - We use Expo's custom scheme
  REDIRECT_URI: 'yopago://auth', // Custom URL scheme

  // Requested scopes
  SCOPES: ['openid', 'profile', 'email'],

  // Additional configurations
  ADDITIONAL_PARAMETERS: {},

  // If using an Android emulator:
  // ISSUER: 'http://10.0.2.2:8082/realms/yopago',

  // If using a physical device (replace with your computer's IP):
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
 * Make sure your API:
 * - Accepts JSON in the Content-Type
 * - Returns JSON in responses
 * - ⚠️ HANDLES CORS CORRECTLY (see instructions below)
 * - Has appropriate error handling
 */

export default API_CONFIG;