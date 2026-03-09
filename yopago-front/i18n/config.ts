import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../locales/en.json';
import es from '../locales/es.json';

export const LANGUAGE_STORAGE_KEY = '@yopago/language_preference';

const resources = {
  en: { translation: en },
  es: { translation: es },
};

// Detectar el idioma del dispositivo (con fallback para SSR/SSG)
const locales = getLocales();
const deviceLanguage = locales && locales.length > 0 ? locales[0].languageCode : 'es';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage,
    fallbackLng: 'es',
    compatibilityJSON: 'v3',
    interpolation: {
      escapeValue: false,
    },
  });

// Load saved language preference asynchronously and apply it
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((saved) => {
    if (saved && ['en', 'es'].includes(saved) && saved !== i18n.language) {
      void i18n.changeLanguage(saved);
    }
  })
  .catch(() => {
    // Best-effort: keep device language if AsyncStorage fails
  });

export const saveLanguagePreference = async (lng: string): Promise<void> => {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
};

export default i18n;
