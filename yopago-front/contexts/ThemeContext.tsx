import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  systemColorScheme: 'light' | 'dark';
  isDarkMode: boolean;
  isLoading: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
}

const STORAGE_KEY = '@yopago/theme_preference';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const AppThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemColorScheme, setSystemColorScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );
  const [isLoading, setIsLoading] = useState(true);

  const updateSystemScheme = useCallback((scheme: ColorSchemeName) => {
    setSystemColorScheme(scheme === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);

        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        } else {
          setPreferenceState('system');
        }
      } catch (error) {
        console.warn('No se pudo cargar la preferencia de tema:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPreference();
  }, []);

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      updateSystemScheme(colorScheme);
    });

    return () => {
      listener.remove();
    };
  }, [updateSystemScheme]);

  const persistPreference = useCallback(async (value: ThemePreference) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      console.warn('No se pudo guardar la preferencia de tema:', error);
    }
  }, []);

  const setPreference = useCallback(
    async (value: ThemePreference) => {
      setPreferenceState(value);
      await persistPreference(value);
    },
    [persistPreference],
  );

  const colorScheme: 'light' | 'dark' = preference === 'system' ? systemColorScheme : preference;

  const toggleDarkMode = useCallback(async () => {
    const nextPreference: ThemePreference = preference === 'system'
      ? (systemColorScheme === 'dark' ? 'light' : 'dark')
      : preference === 'dark'
        ? 'light'
        : 'dark';

    await setPreference(nextPreference);
  }, [preference, setPreference, systemColorScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      preference,
      systemColorScheme,
      isDarkMode: colorScheme === 'dark',
      isLoading,
      setPreference,
      toggleDarkMode,
    }),
    [colorScheme, preference, systemColorScheme, isLoading, setPreference, toggleDarkMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme debe usarse dentro de un AppThemeProvider');
  }

  return context;
};
