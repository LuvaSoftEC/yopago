import { readAsStringAsync } from 'expo-file-system/legacy';
import { authService } from './authService';
import { API_CONFIG } from './config';
import {
    CreateGroupRequest,
    CreateGroupResponse,
    GroupDetailsResponse,
    JoinGroupResponse,
    PaymentResponse,
    ProcessReceiptRequest,
    ProcessReceiptResponse,
} from './types';

// Types for backend responses
export interface ExpenseResponse {
  id: number;
  amount: number;
  description: string;
  category: string;
  paidBy: number;
  groupId: number;
  createdAt: string;
  divisionType: 'EQUAL' | 'CUSTOM';
  items?: ExpenseItemResponse[];
  shares?: ExpenseShareResponse[];
}

export interface ExpenseItemResponse {
  id: number;
  itemName: string;
  amount: number;
  shares?: ExpenseItemShareResponse[];
}

export interface ExpenseItemShareResponse {
  id: number;
  memberId: number;
  percentage: number;
  amount: number;
}

export interface ExpenseShareResponse {
  id: number;
  memberId: number;
  amount: number;
  percentage: number;
}

export interface ExpenseItemShareInput {
  memberId: number;
  shareType?: 'SPECIFIC' | 'SHARED';
  percentage?: number;
  amount?: number;
}

export interface ExpenseItemInput {
  description: string;
  amount: number;
  quantity?: number;
  itemShares?: ExpenseItemShareInput[];
}

export interface ExpenseShare {
  memberId: number;
  percentage: number;
}

export interface CreateExpenseRequest {
  note: string;
  amount: number;
  tag: string;
  payerId: number;
  groupId: number;
  shares?: ExpenseShare[];
  items?: ExpenseItemInput[];
}
export interface CreatePaymentRequest {
  amount: number;
  fromMemberId: number;
  toMemberId: number;
  groupId: number;
  note?: string;
  paymentMethod?: string;
  attachmentBase64?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
}

export interface JoinGroupInviteRequest {
  memberName: string;
  email: string;
  phoneNumber?: string;
}

export interface JoinGroupRegisteredRequest {
  memberId: number;
}

export interface JoinGroupMemberResponse {
  member: {
    id: number;
    name: string;
    keycloakUserId: string | null;
    email: string;
    username: string | null;
    isRegistered: boolean;
    createdAt: string;
    lastLogin: string | null;
    guest: boolean;
  };
  message: string;
  success: boolean;
}

export interface RegisteredUserSummary {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  createdAt?: string;
  lastLogin?: string | null;
  roles?: string[];
}

export interface RemoveMemberResponse {
  removedMemberName: string;
  groupName: string;
  removedMemberEmail: string;
  success: boolean;
  message: string;
}

export interface CurrentMemberResponse {
  member_id?: number;
  name?: string;
  email?: string;
  preferred_username?: string;
  username?: string;
  [key: string]: unknown;
}

class AuthenticatedApiService {
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    console.log('🔐 Making authenticated request to:', url);
    
    try {
      // Get the access token
      const accessToken = await authService.getAccessToken();
      
      if (!accessToken) {
        throw new Error('Could not obtain access token. Please log in again.');
      }

      const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };

      // Create AbortController to handle timeout
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
      
      console.log('📡 Authenticated response status:', response.status);

      // If 401, attempt to refresh the token
      if (response.status === 401) {
        console.log('🔄 Token expired, attempting to refresh...');
        
        try {
          const refreshed = await authService.refreshToken();
          const newToken = await authService.getAccessToken();
          
          if (refreshed && newToken) {
            // Retry the request with the new token
            const retryResponse = await fetch(url, {
              ...options,
              headers: {
                ...defaultHeaders,
                'Authorization': `Bearer ${newToken}`,
                ...options.headers,
              },
            });

            if (!retryResponse.ok) {
              await retryResponse.text();
              throw new Error(`HTTP Error: ${retryResponse.status} - ${retryResponse.statusText}`);
            }

            return await retryResponse.json();
          }
        } catch (refreshError) {
          console.error('❌ Error refreshing token:', refreshError);
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error Response:', errorText);
        throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Authenticated API Error for ${endpoint}:`, error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }

  // Check if user is authenticated
  private async ensureAuthenticated(): Promise<void> {
    const isAuth = await authService.isAuthenticated();
    if (!isAuth) {
      throw new Error('User not authenticated. Please log in.');
    }
  }

  // === GROUP METHODS ===

  async getUserGroups(): Promise<any[]> {
    await this.ensureAuthenticated();
    
    try {
      console.log('📋 Fetching authenticated user groups...');

      const response = await this.makeAuthenticatedRequest<
        { groups?: any[]; createdGroups?: any[] } | any[]
      >('/groups/user');

      console.log('✅ Authenticated groups fetched:', response);

      if (Array.isArray(response)) {
        return response;
      }

      if (response && typeof response === 'object') {
        const groups = Array.isArray(response.groups) ? response.groups : [];
        const createdGroups = Array.isArray(response.createdGroups) ? response.createdGroups : [];

        if (groups.length > 0) {
          return groups;
        }

        if (createdGroups.length > 0) {
          return createdGroups;
        }
      }

      return [];
    } catch (error) {
      console.error('❌ Error fetching authenticated user groups:', error);
      throw new Error('No se pudieron cargar los grupos del usuario');
    }
  }

  /**
   * Obtener detalles de un grupo específico
   */
  async getGroupDetails(groupId: number): Promise<GroupDetailsResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('🔍 Fetching group details:', groupId);

      const response = await this.makeAuthenticatedRequest<GroupDetailsResponse>(
        `/groups/${groupId}/details`,
        {
          method: 'GET',
        }
      );

      console.log('✅ Group details fetched:', response);
      return response;
    } catch (error) {
      console.error('❌ Error fetching group details:', error);
      throw new Error(error instanceof Error ? error.message : 'Error al cargar los detalles del grupo');
    }
  }

  /**
   * Crear un nuevo grupo
   */
  async createGroup(groupData: CreateGroupRequest): Promise<CreateGroupResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('🔧 Creating group:', groupData);

      const response = await this.makeAuthenticatedRequest<CreateGroupResponse>(
        '/groups',
        {
          method: 'POST',
          body: JSON.stringify(groupData),
        }
      );

      console.log('✅ Group created successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error creating group:', error);
      throw new Error(error instanceof Error ? error.message : 'Error al crear el grupo');
    }
  }

  async joinGroup(code: string): Promise<JoinGroupResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('🔗 Joining group with code:', code);
      
      // memberId not needed — backend gets it from the JWT token
      const request = {
        code: code.trim()
      };

      const response = await this.makeAuthenticatedRequest<JoinGroupResponse>(
        '/groups/join',
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('✅ Joined group successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error joining authenticated group:', error);
      throw new Error(error instanceof Error ? error.message : 'Error al unirse al grupo');
    }
  }

  async joinGroupAsInvite(groupId: number, request: JoinGroupInviteRequest): Promise<JoinGroupMemberResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('👥 Adding guest member to group:', groupId, request);
      
      const response = await this.makeAuthenticatedRequest<JoinGroupMemberResponse>(
        `/groups/${groupId}/join`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('✅ Guest member added successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error joining group as invite:', error);
      throw new Error(error instanceof Error ? error.message : 'Error al unir miembro invitado');
    }
  }

  async joinGroupAsRegistered(groupId: number, request: JoinGroupRegisteredRequest): Promise<JoinGroupMemberResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('👤 Adding registered member to group:', groupId, request);
      
      const response = await this.makeAuthenticatedRequest<JoinGroupMemberResponse>(
        `/groups/${groupId}/join`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('✅ Registered member added successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error joining group as registered:', error);
      throw new Error(error instanceof Error ? error.message : 'Error al unir miembro registrado');
    }
  }

  async deleteGroup(groupId: number): Promise<void> {
    await this.ensureAuthenticated();

    try {
      console.log('🗑️ Deleting group:', groupId);

      await this.makeAuthenticatedRequest<void>(
        `/groups/${groupId}`,
        {
          method: 'DELETE',
        }
      );

      console.log('✅ Group deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting group:', error);
      throw new Error(error instanceof Error ? error.message : 'Error al eliminar el grupo');
    }
  }

  async getRegisteredUsers(search?: string): Promise<RegisteredUserSummary[]> {
    await this.ensureAuthenticated();

    const baseEndpoint = '/members/registered';
    const legacyEndpoint = '/users/registered';
    const query = search ? `?search=${encodeURIComponent(search)}` : '';

    const endpoints: string[] = [];

    if (query) {
      endpoints.push(`${baseEndpoint}${query}`, `${legacyEndpoint}${query}`);
    }

    endpoints.push(baseEndpoint, legacyEndpoint, '/users');

    for (const endpoint of endpoints) {
      try {
        console.log('📇 Fetching registered users from:', endpoint);
        const response = await this.makeAuthenticatedRequest<
          RegisteredUserSummary[] |
          {
            members?: RegisteredUserSummary[];
            users?: RegisteredUserSummary[];
            data?: RegisteredUserSummary[];
            results?: RegisteredUserSummary[];
            items?: RegisteredUserSummary[];
            content?: RegisteredUserSummary[];
            registeredUsers?: RegisteredUserSummary[];
          }
        >(endpoint);

        if (Array.isArray(response)) {
          return response;
        }

        if (response && typeof response === 'object') {
          const maybeUsers =
            (response as any).members ??
            (response as any).users ??
            (response as any).registeredUsers ??
            (response as any).data ??
            (response as any).results ??
            (response as any).content ??
            (response as any).items;

          if (Array.isArray(maybeUsers)) {
            return maybeUsers;
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching registered users from ${endpoint}:`, error);
        // Try next endpoint
      }
    }

    throw new Error('No se pudieron cargar los usuarios registrados');
  }

  async removeMemberFromGroup(groupId: number, memberId: number): Promise<RemoveMemberResponse> {
    await this.ensureAuthenticated();

    try {
      console.log('🗑️ Removing member from group:', { groupId, memberId });

      const response = await this.makeAuthenticatedRequest<RemoveMemberResponse>(
        `/groups/${groupId}/members/${memberId}`,
        {
          method: 'DELETE',
        }
      );

      console.log('✅ Member removed successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error removing member from group:', error);
      throw new Error(error instanceof Error ? error.message : 'Error removing member from group');
    }
  }

  // === EXPENSE METHODS ===

  async getGroupExpenses(groupId: string): Promise<ExpenseResponse[]> {
    await this.ensureAuthenticated();
    
    try {
      console.log('💰 Fetching group expenses:', groupId);
      
      const response = await this.makeAuthenticatedRequest<ExpenseResponse[]>(
        `/expenses/group/${groupId}`
      );
      console.log('✅ Expenses fetched:', response);
      return response || [];
    } catch (error) {
      console.error('❌ Error fetching group expenses:', error);
      throw new Error('Could not load group expenses');
    }
  }

  async createExpense(expense: CreateExpenseRequest): Promise<ExpenseResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('💰 Creating expense:', expense);
      
      const response = await this.makeAuthenticatedRequest<ExpenseResponse>(
        '/expenses',
        {
          method: 'POST',
          body: JSON.stringify(expense),
        }
      );

      console.log('✅ Expense created:', response);
      return response;
    } catch (error) {
      console.error('❌ Error creating expense:', error);
      throw new Error(error instanceof Error ? error.message : 'Error creating expense');
    }
  }

  async updateExpense(expenseId: string, expense: Partial<CreateExpenseRequest>): Promise<ExpenseResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('✏️ Updating expense:', expenseId, expense);
      
      const response = await this.makeAuthenticatedRequest<ExpenseResponse>(
        `/expenses/${expenseId}`,
        {
          method: 'PUT',
          body: JSON.stringify(expense),
        }
      );

      console.log('✅ Expense updated:', response);
      return response;
    } catch (error) {
      console.error('❌ Error updating expense:', error);
      throw new Error(error instanceof Error ? error.message : 'Error updating expense');
    }
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.ensureAuthenticated();
    
    try {
      console.log('🗑️ Deleting expense:', expenseId);
      
      await this.makeAuthenticatedRequest<void>(
        `/expenses/${expenseId}`,
        {
          method: 'DELETE',
        }
      );

      console.log('✅ Expense deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting expense:', error);
      throw new Error(error instanceof Error ? error.message : 'Error deleting expense');
    }
  }

  // === PAYMENT METHODS ===

  async getGroupPayments(groupId: string): Promise<PaymentResponse[]> {
    await this.ensureAuthenticated();
    
    try {
      console.log('💳 Fetching group payments:', groupId);
      
      const response = await this.makeAuthenticatedRequest<PaymentResponse[]>(
        `/payments/group/${groupId}`
      );
      console.log('✅ Payments fetched:', response);
      return response || [];
    } catch (error) {
      console.error('❌ Error fetching group payments:', error);
      throw new Error('Could not load group payments');
    }
  }

  async createPayment(payment: CreatePaymentRequest): Promise<PaymentResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('💳 Creating payment:', payment);
      
      const response = await this.makeAuthenticatedRequest<PaymentResponse>(
        '/payments/register',
        {
          method: 'POST',
          body: JSON.stringify(payment),
        }
      );

      console.log('✅ Payment created:', response);
      return response;
    } catch (error) {
      console.error('❌ Error creating payment:', error);
      throw new Error(error instanceof Error ? error.message : 'Error creating payment');
    }
  }

  async confirmPayment(paymentId: string | number, memberId: number): Promise<PaymentResponse> {
    await this.ensureAuthenticated();
    
    try {
      console.log('✅ Confirming payment:', paymentId, 'by member:', memberId);
      
      const response = await this.makeAuthenticatedRequest<PaymentResponse>(
        `/payments/${paymentId}/confirm`,
        {
          method: 'PUT',
          body: JSON.stringify({ memberId }),
        }
      );

      console.log('✅ Payment confirmed:', response);
      return response;
    } catch (error) {
      console.error('❌ Error confirming payment:', error);
      throw new Error(error instanceof Error ? error.message : 'Error confirming payment');
    }
  }

  // === UTILITY METHODS ===

  async getCurrentUserInfo(): Promise<any> {
    await this.ensureAuthenticated();
    
    try {
      return await authService.getUserInfo();
    } catch (error) {
      console.error('❌ Error getting current user info:', error);
      throw new Error('Could not retrieve user information');
    }
  }

  async getCurrentMember(): Promise<{ memberId: number; name?: string; email?: string; raw: CurrentMemberResponse }> {
    await this.ensureAuthenticated();

    try {
      const response = await this.makeAuthenticatedRequest<CurrentMemberResponse>('/auth/me');
      const memberId = typeof response?.member_id === 'number' ? response.member_id : Number(response?.member_id);

      if (!Number.isFinite(memberId)) {
        throw new Error('Could not determine the current member identifier');
      }

      return {
        memberId,
        name: typeof response?.name === 'string' && response.name.trim().length > 0
          ? response.name
          : typeof response?.preferred_username === 'string'
            ? response.preferred_username
            : undefined,
        email: typeof response?.email === 'string' ? response.email : undefined,
        raw: response,
      };
    } catch (error) {
      console.error('❌ Error getting current member info:', error);
      throw new Error(error instanceof Error ? error.message : 'Could not retrieve the authenticated member');
    }
  }

  async processReceipt(
    fileUri: string,
    groupId: number,
    options: {
      fileName?: string;
      currency?: string;
      note?: string;
      payerId?: number;
    } = {}
  ): Promise<ProcessReceiptResponse> {
    await this.ensureAuthenticated();
    
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

      const response = await this.makeAuthenticatedRequest<ProcessReceiptResponse>(
        '/expenses/process-receipt',
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      return response;
    } catch (error) {
      console.error('Error processing receipt:', error);
      throw new Error(error instanceof Error ? error.message : 'Error processing receipt');
    }
  }

  // Private methods
  private generateGroupCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

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

  async checkConnection(): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest('/health', {
        method: 'GET',
      });
      return true;
    } catch (error) {
      console.error('Authenticated API connection check failed:', error);
      return false;
    }
  }

}

// Singleton instance of the authenticated service
export const authenticatedApiService = new AuthenticatedApiService();

// Hook for use in React
export const useAuthenticatedApiService = () => {
  return authenticatedApiService;
};

export default authenticatedApiService;