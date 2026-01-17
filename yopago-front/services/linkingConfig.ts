import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Configurar WebBrowser para que termine la sesión correctamente
WebBrowser.maybeCompleteAuthSession();

/**
 * Configuración de Deep Linking para OAuth
 */
export const configureLinking = () => {
  // Manejar URLs entrantes
  const handleDeepLink = (url: string) => {
    console.log('🔗 Deep link recibido:', url);
    
    // Si es una URL de auth de OAuth, WebBrowser la manejará automáticamente
    if (url.includes('auth')) {
      console.log('🔐 URL de autenticación detectada');
      // WebBrowser.maybeCompleteAuthSession() ya debería haber manejado esto
    }
  };

  // Escuchar eventos de deep linking
  const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
    handleDeepLink(url);
  });

  return subscription;
};

/**
 * Obtener la URL inicial si la app se abrió desde un deep link
 */
export const getInitialURL = async (): Promise<string | null> => {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      console.log('🚀 URL inicial:', url);
    }
    return url;
  } catch (error) {
    console.error('❌ Error obteniendo URL inicial:', error);
    return null;
  }
};

/**
 * Verificar si se puede abrir una URL
 */
export const canOpenURL = async (url: string): Promise<boolean> => {
  try {
    return await Linking.canOpenURL(url);
  } catch (error) {
    console.error('❌ Error verificando URL:', error);
    return false;
  }
};

export default {
  configureLinking,
  getInitialURL,
  canOpenURL,
};