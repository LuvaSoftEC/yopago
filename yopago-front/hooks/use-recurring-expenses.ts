import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export interface RecurringTemplate {
  id: string;
  note: string;
  amount: number;
  tag: string;
  payerId: number;
  dayOfMonth: number;
  lastCreated: string; // 'YYYY-MM'
  active: boolean;
}

const STORAGE_KEY = 'yopago_recurring_expenses';

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function useRecurringExpenses(groupId: number | string | undefined) {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const all: Record<string, RecurringTemplate[]> = JSON.parse(raw);
      setTemplates(all[String(groupId)] ?? []);
    } catch {
      // best-effort
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (updated: RecurringTemplate[]) => {
    if (!groupId) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: Record<string, RecurringTemplate[]> = raw ? JSON.parse(raw) : {};
      all[String(groupId)] = updated;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setTemplates(updated);
    } catch {
      // best-effort
    }
  }, [groupId]);

  const addTemplate = useCallback(async (template: Omit<RecurringTemplate, 'id' | 'lastCreated' | 'active'>) => {
    const newTemplate: RecurringTemplate = {
      ...template,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      lastCreated: '',
      active: true,
    };
    const updated = [...templates, newTemplate];
    await save(updated);
  }, [templates, save]);

  const removeTemplate = useCallback(async (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    await save(updated);
  }, [templates, save]);

  const markCreated = useCallback(async (ids: string[]) => {
    const month = currentYearMonth();
    const updated = templates.map((t) =>
      ids.includes(t.id) ? { ...t, lastCreated: month } : t,
    );
    await save(updated);
  }, [templates, save]);

  const pendingTemplates = templates.filter(
    (t) => t.active && t.lastCreated !== currentYearMonth(),
  );

  return { templates, pendingTemplates, addTemplate, removeTemplate, markCreated };
}
