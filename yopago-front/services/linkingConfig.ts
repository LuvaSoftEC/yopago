import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Configure WebBrowser to properly complete the session
WebBrowser.maybeCompleteAuthSession();

/**
 * Deep Linking configuration for OAuth
 */
export const configureLinking = () => {
  // Handle incoming URLs
  const handleDeepLink = (url: string) => {
    console.log('🔗 Deep link received:', url);

    // If it is an OAuth auth URL, WebBrowser will handle it automatically
    if (url.includes('auth')) {
      console.log('🔐 Authentication URL detected');
      // WebBrowser.maybeCompleteAuthSession() should have already handled this
    }
  };

  // Listen for deep linking events
  const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
    handleDeepLink(url);
  });

  return subscription;
};

/**
 * Get the initial URL if the app was opened from a deep link
 */
export const getInitialURL = async (): Promise<string | null> => {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      console.log('🚀 Initial URL:', url);
    }
    return url;
  } catch (error) {
    console.error('❌ Error getting initial URL:', error);
    return null;
  }
};

/**
 * Check if a URL can be opened
 */
export const canOpenURL = async (url: string): Promise<boolean> => {
  try {
    return await Linking.canOpenURL(url);
  } catch (error) {
    console.error('❌ Error checking URL:', error);
    return false;
  }
};

export default {
  configureLinking,
  getInitialURL,
  canOpenURL,
};