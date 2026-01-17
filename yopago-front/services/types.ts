// Interfaces para las respuestas de la API de YoPago

export interface CreateGroupRequest {
  name: string;
  description?: string;
  code?: string;
  members?: GroupMember[];
}

export interface CreateGroupResponse {
  groupId: number;
  joinCode: string;
  qrCodeBase64: string;
  name: string;
  description?: string;
  createdAt: string;
  isActive: boolean;
}

export interface GroupMember {
  id: number;
  name: string;
  email: string;
  joinedAt?: string;
  isAdmin?: boolean;
  isGuest?: boolean;
}

export interface GroupSummary {
  groupId: number;
  name: string;
  memberCount: number;
  totalExpenses: number;
  totalAmount?: number;
  lastActivity?: string;
  userRole: 'admin' | 'member';
  canDelete?: boolean;
  showActions?: boolean;
}

export interface GroupDetails {
  groupId?: number;
  id?: number;
  name: string;
  joinCode?: string;
  code?: string;
  qrCodeBase64?: string;
  members: GroupMember[];
  createdAt?: string;
  totalExpenses?: number;
  description?: string;
  isActive?: boolean;
  expenses?: any[];
  totalMembers?: number;
}

export interface JoinGroupRequest {
  code: string;
  memberId: number;
}

export interface JoinGroupResponse {
  id: number;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
  isActive: boolean;
  members: GroupMember[];
  expenses: any[];
  totalMembers: number;
  totalExpenses: number;
  alreadyMember?: boolean;
}

export interface Group {
  groupId: number;
  name: string;
  code: string;
  joinCode: string;
  qrCodeBase64?: string;
  members: GroupMember[];
  createdAt?: string;
}

export interface ProcessReceiptRequest {
  groupId: number;
  fileBase64: string;
  fileName?: string;
  currency?: string;
  note?: string;
  payerId?: number;
}

export interface ProcessReceiptResponse {
  expense: ProcessedExpense;
  ocrText?: string;
}

export interface ProcessedExpense {
  id: number;
  amount: number;
  note?: string;
  tag?: string;
  currency?: string;
  payer?: ProcessedExpenseMember;
  group?: ProcessedExpenseGroup;
  items?: ProcessedExpenseItem[];
  shares?: ProcessedExpenseShare[];
}

export interface ProcessedExpenseMember {
  id: number;
  name?: string;
  isGuest?: boolean;
}

export interface ProcessedExpenseGroup {
  id: number;
  name?: string;
  groupCode?: string;
}

export interface ProcessedExpenseItem {
  id: number;
  description?: string;
  amount: number;
  quantity?: number;
}

export interface ProcessedExpenseShare {
  id: number;
  amount?: number;
  percentage?: number;
  member?: ProcessedExpenseMember;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
}

// Enum para estados de procesamiento
export enum ProcessingStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  PROCESSING = 'processing'
}

// Tipos para detalles del grupo
export interface GroupDetailsResponse {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  totalMembers: number;
  totalExpenses: number;
  totalAmount: number;
  averagePerMember: number;
  createdBy: GroupMember;
  members: GroupMember[];
  expenses: GroupExpense[];
  aggregatedShares: AggregatedShare[];
  qrCodeBase64?: string;
  balanceOriginal?: Record<string, number>;
  balanceAdjusted?: Record<string, number>;
  confirmedPayments?: PaymentResponse[];
  pendingPayments?: PaymentResponse[];
}

export interface GroupExpenseShare {
  id?: number;
  memberId?: number;
  memberName?: string;
  memberEmail?: string;
  amount?: number;
  percentage?: number;
}

export interface GroupExpenseItemShare {
  id?: number;
  memberId?: number;
  memberName?: string;
  memberEmail?: string;
  amount?: number;
  percentage?: number;
  shareType?: 'SPECIFIC' | 'SHARED';
}

export interface GroupExpenseItem {
  id: number;
  description?: string;
  amount: number;
  quantity?: number;
  shares?: GroupExpenseItemShare[];
}

export interface GroupExpense {
  id: number;
  amount: number;
  description?: string;
  note?: string;
  tag?: string;
  category?: string;
  currency?: string;
  date?: string;
  createdAt?: string;
  paidBy?: GroupMember;
  payer?: Partial<GroupMember> & { id?: number; name?: string };
  splitAmong?: GroupMember[];
  items?: GroupExpenseItem[];
  shares?: GroupExpenseShare[];
}

export interface AggregatedShare {
  memberId: number | null;
  memberName: string | null;
  totalPaid?: number;
  totalOwed?: number;
  balance?: number;
  balanceBeforePayments?: number;
  balanceAdjustment?: number;
  totalAmount?: number;
}

export interface PaymentMemberSummary {
  id: number;
  name?: string;
  email?: string;
  registered?: boolean;
  guest?: boolean;
}

export interface PaymentResponse {
  id: number;
  amount: number;
  fromMember: PaymentMemberSummary | number;
  toMember: PaymentMemberSummary | number;
  groupId: number;
  confirmed: boolean;
  note?: string;
  createdAt: string;
  paymentMethod?: string;
  attachmentUrl?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
}

// Tipos para gastos
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
}

export interface CreateExpenseResponse {
  id: number;
  note: string;
  amount: number;
  tag: string;
  payerId: number;
  groupId: number;
  createdAt: string;
  shares: ExpenseShare[];
}

// --- Invitados ---
export interface GuestMemberSummary {
  id: number;
  name: string;
  email?: string;
  isRegistered?: boolean;
  isGuest?: boolean;
}

export interface GuestGroupSummary {
  id: number;
  name: string;
  description?: string;
  shareCode?: string;
}

export interface GuestAccessResponse {
  success: boolean;
  message?: string;
  group: GuestGroupSummary;
  member: GuestMemberSummary;
}

export interface GuestSessionInfoResponse {
  success: boolean;
  isGuest: boolean;
  guestName?: string;
  groupId?: number;
  memberId?: number;
  group?: GuestGroupSummary;
  member?: GuestMemberSummary;
}

export interface GuestGroupInfoResponse {
  success: boolean;
  group: GuestGroupSummary & {
    code?: string;
    totalMembers?: number;
    members?: GuestMemberSummary[];
  };
}

export interface GuestGroupExpensesResponse {
  success: boolean;
  expenses: GroupExpense[];
  totalExpenses: number;
}

export interface GuestExpenseItemPayload {
  description: string;
  amount: number;
  quantity?: number;
  onlyForMe?: boolean;
  participantMemberIds?: number[];
}

export interface GuestCreateExpenseRequest {
  description: string;
  amount: number;
  category?: string;
  participantMemberIds?: number[];
  items?: GuestExpenseItemPayload[];
}

export interface GuestCreateExpenseResponse {
  success: boolean;
  message?: string;
  expense: {
    id: number;
    amount: number;
    note?: string;
    tag?: string;
    currency?: string;
    payer?: {
      id?: number;
      name?: string;
    };
    items?: Array<{
      id: number;
      description?: string;
      amount: number;
      quantity?: number;
    }>;
  };
}

export interface GuestPaymentMember {
  id: number;
  name?: string;
  isGuest?: boolean;
}

export interface GuestPayment {
  id: number;
  amount: number;
  currency?: string;
  note?: string;
  confirmed?: boolean;
  createdAt?: string;
  fromMember: GuestPaymentMember;
  toMember: GuestPaymentMember;
}

export interface GuestPaymentsResponse {
  success: boolean;
  message?: string;
  payments: GuestPayment[];
  total: number;
}

export interface GuestRegisterPaymentRequest {
  toMemberId: number;
  amount: number;
  note?: string;
}

export interface GuestRegisterPaymentResponse {
  success: boolean;
  paymentId: number;
  message?: string;
}

export interface GuestConfirmPaymentResponse {
  success: boolean;
  paymentId?: number;
  message?: string;
}
