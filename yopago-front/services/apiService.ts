import { readAsStringAsync } from 'expo-file-system/legacy';
import { API_CONFIG } from './config';
import {
    CreateGroupRequest,
    CreateGroupResponse,
    Group,
    GroupDetails,
    JoinGroupRequest,
    JoinGroupResponse,
    ProcessReceiptRequest,
} from './types';

class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    console.log('🌐 Making request to:', url);
    console.log('📋 Request options:', {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body ? 'Body present' : 'No body'
    });
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      // Crear un AbortController para manejar timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error Response:', errorText);
        throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }

  // Convertir imagen URI a Base64
  private async convertFileToBase64(fileUri: string): Promise<string> {
    try {
      if (!fileUri) {
        throw new Error('Invalid file URI');
      }

      if (fileUri.startsWith('data:')) {
        const [, base64Data] = fileUri.split(',');
        return base64Data ?? fileUri;
      }

      if (fileUri.startsWith('http') || fileUri.startsWith('blob:')) {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1] || base64String;
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const normalizedUri = fileUri.startsWith('file://') || fileUri.startsWith('content://')
        ? fileUri
        : `file://${fileUri}`;

  return await readAsStringAsync(normalizedUri, {
        encoding: 'base64',
      });
    } catch (error) {
      console.error('Error converting file to base64:', error);
      throw new Error('Could not process the attached file');
    }
  }

  // Procesar factura con tu API de Java
  async processReceipt(
    fileUri: string,
    groupId: number,
    options: {
      fileName?: string;
      currency?: string;
      note?: string;
      payerId?: number;
    } = {}
  ): Promise<any> {
    try {
      const fileBase64 = await this.convertFileToBase64(fileUri);
      const {
        fileName = 'receipt.jpg',
        currency,
        note,
        payerId,
      } = options;

      const normalizedCurrency = currency?.trim().toUpperCase();
      const normalizedNote = note?.trim();

      const request: ProcessReceiptRequest = {
        groupId,
        fileBase64,
        fileName,
        ...(normalizedCurrency ? { currency: normalizedCurrency } : {}),
        ...(normalizedNote ? { note: normalizedNote } : {}),
        ...(typeof payerId === 'number' ? { payerId } : {}),
      };

      const response = await this.makeRequest<any>(
        API_CONFIG.ENDPOINTS.PROCESS_RECEIPT,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      return response;
    } catch (error) {
      console.error('Error processing receipt:', error);
      throw new Error(error instanceof Error ? error.message : 'Error desconocido al procesar la factura');
    }
  }

  // Crear un nuevo grupo - usando la estructura real de tu API
  async createGroup(name: string, description?: string): Promise<CreateGroupResponse> {
    console.log('🔧 createGroup called with:', { name, description });
    
    try {
      // Preparar la request según la estructura que espera tu API
      const request: CreateGroupRequest = {
        name: name,
        code: this.generateGroupCode(), // Generar código único
        members: [] // Inicialmente sin miembros
      };

      console.log('📋 Request payload:', request);
      console.log('🌐 API URL:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GROUPS}`);

      const response = await this.makeRequest<CreateGroupResponse>(
        API_CONFIG.ENDPOINTS.GROUPS,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('✅ API Response:', response);
      return response;
    } catch (error) {
      console.error('❌ Error in createGroup:', error);
      throw new Error(error instanceof Error ? error.message : 'Error desconocido al crear el grupo');
    }
  }

  // Generar código único para el grupo
  private generateGroupCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  // Unirse a un grupo usando código de acceso
  async joinGroup(code: string, memberId: number): Promise<JoinGroupResponse> {
    try {
      console.log('🔗 Attempting to join group with code:', code, 'memberId:', memberId);
      
      const request: JoinGroupRequest = {
        code: code.trim(),
        memberId: memberId
      };

      console.log('📤 Sending request:', request);

      const response = await this.makeRequest<JoinGroupResponse>(
        API_CONFIG.ENDPOINTS.JOIN_GROUP,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('📥 Response received:', response);
      return response;
    } catch (error) {
      console.error('❌ Error joining group:', error);
      throw new Error(error instanceof Error ? error.message : 'Error desconocido al unirse al grupo');
    }
  }

  // Obtener todos los grupos del usuario
  async getUserGroups(): Promise<any[]> {
    try {
      console.log('📋 Fetching user groups...');
      console.log('🔗 Endpoint:', API_CONFIG.ENDPOINTS.USER_GROUPS);
      
      const response = await this.makeRequest<{ groups: any[] }>(API_CONFIG.ENDPOINTS.USER_GROUPS);
      console.log('✅ Groups fetched:', response);
      return response.groups || [];
    } catch (error) {
      console.error('❌ Error fetching user groups:', error);
      
      // Intentar con endpoint alternativo si el primero falla
      try {
        console.log('🔄 Trying alternative endpoint: /groups');
        const response = await this.makeRequest<any[]>('/groups');
        console.log('✅ Groups fetched (alternative):', response);
        return response || [];
      } catch (alternativeError) {
        console.error('❌ Error con endpoint alternativo:', alternativeError);
        throw new Error('No se pudieron cargar los grupos del usuario');
      }
    }
  }

  // Obtener detalles completos de un grupo específico
  async getGroupDetails(groupId: string): Promise<GroupDetails | null> {
    try {
      console.log('🔍 Fetching group details:', groupId);
      
      // Intentamos primero con el endpoint simple
      const response = await this.makeRequest<GroupDetails>(
        API_CONFIG.ENDPOINTS.GROUP_BY_ID.replace(':id', groupId)
      );
      console.log('✅ Group details fetched:', response);
      return response;
    } catch (error) {
      console.error('❌ Error fetching group details:', error);
      throw new Error('No se pudieron cargar los detalles del grupo');
    }
  }

  // Obtener detalles de un grupo específico
  async getGroup(groupId: string): Promise<Group | null> {
    try {
      const response = await this.makeRequest<{ group: Group }>(
        API_CONFIG.ENDPOINTS.GROUP_BY_ID.replace(':id', groupId)
      );
      return response.group || null;
    } catch (error) {
      console.error('Error fetching group:', error);
      return null;
    }
  }

  // Agregar un miembro a un grupo
  async addMember(groupId: string, memberName: string): Promise<any> {
    try {
      console.log('👥 Adding member to group:', { groupId, memberName });
      
      const request = {
        name: memberName
      };

      const response = await this.makeRequest<any>(
        `/groups/${groupId}/members`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('✅ Member added successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error adding member:', error);
      throw new Error(error instanceof Error ? error.message : 'Error desconocido al agregar miembro');
    }
  }

  // Verificar la conexión con la API
  async checkConnection(): Promise<boolean> {
    try {
      await this.makeRequest(API_CONFIG.ENDPOINTS.HEALTH, {
        method: 'GET',
      });
      return true;
    } catch (error) {
      console.error('API connection check failed:', error);
      return false;
    }
  }
}

// Instancia singleton del servicio
export const apiService = new ApiService();

// Hook para usar en React
export const useApiService = () => {
  return apiService;
};

// Funciones de utilidad para manejo de errores
export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ha ocurrido un error inesperado';
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('Network') || 
           error.message.includes('Failed to fetch') ||
           error.message.includes('timeout');
  }
  return false;
};