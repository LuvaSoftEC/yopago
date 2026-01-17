import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from '../locales/en.json';
import es from '../locales/es.json';

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
    lng: deviceLanguage, // Idioma inicial basado en el dispositivo
    fallbackLng: 'es', // Idioma de respaldo
    compatibilityJSON: 'v3',
    interpolation: {
      escapeValue: false, // React ya hace el escape
    },
  });

export default i18n;
