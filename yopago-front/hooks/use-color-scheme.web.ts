import { useTheme } from '@/contexts/ThemeContext';

// Hook específico para web que respeta la preferencia almacenada en ThemeContext.
export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useTheme();
  return colorScheme;
}
