import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type PropertyTypeId = 'apartamento' | 'casa' | 'finca';

export interface PropertyMeta {
  propertyType?: PropertyTypeId;
  address?: string;
}

const STORAGE_KEY = 'yopago_property_meta';

export function usePropertyMeta(groupId: number | string | undefined) {
  const [meta, setMeta] = useState<PropertyMeta | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const all: Record<string, PropertyMeta> = JSON.parse(raw);
        setMeta(all[String(groupId)] ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [groupId]);

  const saveMeta = useCallback(async (newMeta: PropertyMeta) => {
    if (!groupId) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: Record<string, PropertyMeta> = raw ? JSON.parse(raw) : {};
      all[String(groupId)] = newMeta;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setMeta(newMeta);
    } catch {
      // non-critical
    }
  }, [groupId]);

  return { meta, saveMeta };
}
