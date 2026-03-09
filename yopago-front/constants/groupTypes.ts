import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type GroupTypeId = 'general' | 'empresa' | 'propiedad' | 'evento';

export interface GroupType {
  id: GroupTypeId;
  label: string;
  labelKey: string;
  descriptionKey: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
}

export const GROUP_TYPES: GroupType[] = [
  {
    id: 'general',
    label: 'General',
    labelKey: 'groupTypes.general',
    descriptionKey: 'groupTypes.generalDesc',
    icon: 'people',
    color: '#6B7280',
  },
  {
    id: 'empresa',
    label: 'Empresa',
    labelKey: 'groupTypes.empresa',
    descriptionKey: 'groupTypes.empresaDesc',
    icon: 'briefcase',
    color: '#3B82F6',
  },
  {
    id: 'propiedad',
    label: 'Propiedad',
    labelKey: 'groupTypes.propiedad',
    descriptionKey: 'groupTypes.propiedadDesc',
    icon: 'home',
    color: '#10B981',
  },
  {
    id: 'evento',
    label: 'Evento',
    labelKey: 'groupTypes.evento',
    descriptionKey: 'groupTypes.eventoDesc',
    icon: 'calendar',
    color: '#F59E0B',
  },
];

export const GROUP_TYPE_MAP: Record<GroupTypeId, GroupType> = Object.fromEntries(
  GROUP_TYPES.map((t) => [t.id, t])
) as Record<GroupTypeId, GroupType>;

export const STORAGE_KEY_GROUP_TYPES = 'yopago_group_types';
