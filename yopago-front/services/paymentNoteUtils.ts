export type PaymentNoteMetadata = {
  type?: string;
  expenseId?: number;
  expenseDescription?: string;
  shareAmount?: number;
  memo?: string;
  paymentMethod?: string;
  attachmentFileName?: string;
  targetMemberId?: number;
  fromReminder?: boolean;
};

export const PAYMENT_NOTE_TYPE = 'expense_share_payment';
export const MANUAL_PAYMENT_NOTE_TYPE = 'manual_payment';

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const normalizeMetadata = (metadata: PaymentNoteMetadata): PaymentNoteMetadata => {
  const normalized: PaymentNoteMetadata = { ...metadata };

  const numericExpenseId = toNumber(normalized.expenseId);
  if (typeof numericExpenseId === 'number') {
    normalized.expenseId = numericExpenseId;
  }

  const numericShareAmount = toNumber(normalized.shareAmount);
  if (typeof numericShareAmount === 'number') {
    normalized.shareAmount = numericShareAmount;
  }

  if (normalized.memo != null && typeof normalized.memo !== 'string') {
    normalized.memo = String(normalized.memo);
  }

  if (normalized.paymentMethod != null && typeof normalized.paymentMethod !== 'string') {
    normalized.paymentMethod = String(normalized.paymentMethod);
  }

  if (normalized.attachmentFileName != null && typeof normalized.attachmentFileName !== 'string') {
    normalized.attachmentFileName = String(normalized.attachmentFileName);
  }

  const numericTargetId = toNumber(normalized.targetMemberId);
  if (typeof numericTargetId === 'number') {
    normalized.targetMemberId = numericTargetId;
  }

  return normalized;
};

export const parsePaymentNoteMetadata = (raw?: string | null): PaymentNoteMetadata | null => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      return normalizeMetadata(parsed as PaymentNoteMetadata);
    }
  } catch (error) {
    console.warn('[paymentNoteUtils] No se pudo parsear metadata del pago', error);
  }

  return null;
};

export const describePaymentMethod = (method?: string | null) => {
  if (!method) {
    return null;
  }

  const normalized = method.toString().trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if ([
    'transfer',
    'transferencia',
    'bank_transfer',
    'transferencia_bancaria',
    'transferencia-bancaria',
    'transferencia bancaria',
    'transferencia-banco',
  ].includes(normalized)) {
    return 'transferencia';
  }

  if (['cash', 'efectivo', 'cash_payment', 'pago_efectivo', 'pago-efectivo', 'pago efectivo', 'efectivo_pesos'].includes(normalized)) {
    return 'efectivo';
  }

  if (['other', 'otro', 'otros'].includes(normalized)) {
    return 'otro';
  }

  return normalized;
};

const formatShareAmount = (amount?: number) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return null;
  }

  return `$${amount.toFixed(2)}`;
};

export const formatPaymentNote = (raw?: string | null): string | null => {
  const fallback = typeof raw === 'string' ? raw.trim() : null;
  const metadata = parsePaymentNoteMetadata(raw);

  if (!metadata) {
    return fallback;
  }

  const memo = metadata.memo?.toString().trim();
  if (memo) {
    return memo;
  }

  if (metadata.type === PAYMENT_NOTE_TYPE) {
    const description = metadata.expenseDescription?.toString().trim();
    const amountLabel = formatShareAmount(metadata.shareAmount);
    const methodLabel = describePaymentMethod(metadata.paymentMethod);

    const parts: string[] = [];
    parts.push(description ? `Pago de ${description}` : 'Pago registrado');
    if (amountLabel) {
      parts.push(`por ${amountLabel}`);
    }

    let message = parts.join(' ');
    if (methodLabel) {
      message = `${message} (${methodLabel})`;
    }

    return message;
  }

  if (metadata.type === MANUAL_PAYMENT_NOTE_TYPE) {
    const methodLabel = describePaymentMethod(metadata.paymentMethod);
    const amountLabel = formatShareAmount(metadata.shareAmount);
    let message = amountLabel ? `Pago registrado por ${amountLabel}` : 'Pago registrado';
    if (methodLabel) {
      message = `${message} (${methodLabel})`;
    }
    return message;
  }

  const fallbackMethod = describePaymentMethod(metadata.paymentMethod);
  if (fallbackMethod) {
    return `Pago registrado (${fallbackMethod})`;
  }

  return fallback;
};
