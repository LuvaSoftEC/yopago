import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      await SecureStore.deleteItemAsync('accessToken');
    }
    return Promise.reject(error);
  }
);

export const expenseService = {
  getAllExpenses: () => apiClient.get('/api/expenses'),
  getExpenseById: (id) => apiClient.get(`/api/expenses/${id}`),
  getMyExpenses: () => apiClient.get('/api/expenses/my'),
  getExpensesByGroup: (groupId) => apiClient.get(`/api/expenses/group/${groupId}`),
  createExpense: (expense) => apiClient.post('/api/expenses', expense),
  updateExpense: (id, expense) => apiClient.put(`/api/expenses/${id}`, expense),
  deleteExpense: (id) => apiClient.delete(`/api/expenses/${id}`),
};

export default apiClient;
