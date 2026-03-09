import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { GROUP_TYPE_MAP, STORAGE_KEY_GROUP_TYPES, type GroupType, type GroupTypeId } from '@/constants/groupTypes';

/**
 * Returns a map of groupId (string) → GroupType.
 * Reads once from AsyncStorage and refreshes when `deps` change.
 */
export function useGroupTypesMap(deps: unknown[] = []): Record<string, GroupType> {
  const [typesMap, setTypesMap] = useState<Record<string, GroupType>>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY_GROUP_TYPES)
      .then((raw) => {
        if (cancelled) return;
        if (!raw) return;
        const stored: Record<string, GroupTypeId> = JSON.parse(raw);
        const resolved: Record<string, GroupType> = {};
        for (const [id, typeId] of Object.entries(stored)) {
          const t = GROUP_TYPE_MAP[typeId];
          if (t) resolved[id] = t;
        }
        setTypesMap(resolved);
      })
      .catch(() => {/* best-effort */});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return typesMap;
}
