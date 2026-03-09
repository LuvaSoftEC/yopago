import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export interface PropertyCategory {
  id: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
}

export const PROPERTY_CATEGORIES: PropertyCategory[] = [
  { id: 'mantenimiento', label: 'Mantenimiento', icon: 'construct',           color: '#F59E0B' },
  { id: 'servicios',     label: 'Servicios',     icon: 'flash',               color: '#3B82F6' },
  { id: 'reparacion',    label: 'Reparación',    icon: 'hammer',              color: '#EF4444' },
  { id: 'cuota',         label: 'Cuota',         icon: 'cash',                color: '#10B981' },
  { id: 'seguros',       label: 'Seguros',       icon: 'shield',              color: '#8B5CF6' },
  { id: 'otros',         label: 'Otros',         icon: 'ellipsis-horizontal', color: '#6B7280' },
];

export const PROPERTY_CATEGORY_MAP: Record<string, PropertyCategory> = Object.fromEntries(
  PROPERTY_CATEGORIES.map((c) => [c.id, c]),
);
