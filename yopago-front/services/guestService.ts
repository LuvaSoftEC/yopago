import { readAsStringAsync } from 'expo-file-system/legacy';
import { API_CONFIG } from './config';
import {
  GuestAccessResponse,
  GuestGroupExpensesResponse,
  GuestGroupInfoResponse,
  GuestSessionInfoResponse,
  GuestCreateExpenseRequest,
  GuestCreateExpenseResponse,
  GuestPaymentsResponse,
  GuestRegisterPaymentRequest,
  GuestRegisterPaymentResponse,
  GuestConfirmPaymentResponse,
  ProcessReceiptResponse,
} from './types';

const buildHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const withDefaults = (init: RequestInit = {}): RequestInit => ({
  credentials: 'include',
  ...init,
  headers: {
    ...buildHeaders(),
    ...(init.headers || {}),
  },
});

const convertFileToBase64 = async (fileUri: string): Promise<string> => {
  if (!fileUri) {
    throw new Error('URI de archivo inválida');
  }

  if (fileUri.startsWith('data:')) {
    const [, base64Data] = fileUri.split(',');
    return base64Data ?? fileUri;
  }

  if (fileUri.startsWith('http') || fileUri.startsWith('blob:')) {
    const response = await fetch(fileUri);
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
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
};

async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  console.log(`[guestService] request → ${url}`, init);

  try {
    const response = await fetch(url, withDefaults(init));

    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : ({} as T);

    if (!response.ok) {
      const message = (data as any)?.message || response.statusText;
      throw new Error(message || `Error ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[guestService] error for ${endpoint}`, error);
    throw error;
  }
}

export const guestService = {
  redeemInvitation: (token: string, payload: { guestName: string; email: string }) =>
    request<GuestAccessResponse>(`/guest/invitations/${token}/redeem`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  accessWithCode: (payload: { groupCode: string; guestName: string; email: string; phoneNumber?: string }) =>
    request<GuestAccessResponse>('/guest/access', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSessionInfo: () => request<GuestSessionInfoResponse>('/guest/info'),

  getGroupInfo: () => request<GuestGroupInfoResponse>('/guest/group'),

  getGroupExpenses: () => request<GuestGroupExpensesResponse>('/guest/expenses'),

  createExpense: (payload: GuestCreateExpenseRequest) =>
    request<GuestCreateExpenseResponse>('/guest/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  processReceipt: async (
    fileUri: string,
    groupId: number,
    options: {
      fileName?: string;
      currency?: string;
      note?: string;
      payerId?: number;
    } = {},
  ): Promise<ProcessReceiptResponse> => {
    if (typeof groupId !== 'number' || Number.isNaN(groupId)) {
      throw new Error('Grupo no válido para procesar el recibo.');
    }

    const fileBase64 = await convertFileToBase64(fileUri);
    const {
      fileName = 'receipt.jpg',
      currency,
      note,
      payerId,
    } = options;

    const normalizedCurrency = currency?.trim().toUpperCase();
    const normalizedNote = note?.trim();

    const payload = {
      groupId,
      fileBase64,
      fileName,
      ...(normalizedCurrency ? { currency: normalizedCurrency } : {}),
      ...(normalizedNote ? { note: normalizedNote } : {}),
      ...(typeof payerId === 'number' ? { payerId } : {}),
    };

    return request<ProcessReceiptResponse>('/guest/expenses/process-receipt', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getPayments: () => request<GuestPaymentsResponse>('/guest/payments'),

  registerPayment: (payload: GuestRegisterPaymentRequest) =>
    request<GuestRegisterPaymentResponse>('/guest/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirmPayment: (paymentId: number) =>
    request<GuestConfirmPaymentResponse>(`/guest/payments/${paymentId}/confirm`, {
      method: 'PUT',
    }),

  logout: () => request<{ success: boolean; message?: string }>('/guest/logout', { method: 'POST' }),
};

export type GuestService = typeof guestService;
