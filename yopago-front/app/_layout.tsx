import {
  Mulish_400Regular,
  Mulish_500Medium,
  Mulish_600SemiBold,
  Mulish_700Bold,
} from '@expo-google-fonts/mulish';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { cloneElement, useEffect } from 'react';
import { Platform, StyleSheet, Text, TextInput, type StyleProp, type TextStyle } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { GuestSessionProvider } from '@/contexts/GuestSessionContext';
import { RealTimeProvider } from '@/contexts/RealTimeContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { configureLinking } from '@/services/linkingConfig';
import { Colors, TYPOGRAPHY } from '@/constants/theme';
import '@/i18n/config'; // Importar configuración de i18n

export const unstable_settings = {
  anchor: '(tabs)',
};

void SplashScreen.preventAutoHideAsync();

const DEFAULT_FONT_FAMILY = 'Mulish-Regular';
const FONT_WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': DEFAULT_FONT_FAMILY,
  '200': DEFAULT_FONT_FAMILY,
  '300': DEFAULT_FONT_FAMILY,
  '400': 'Mulish-Regular',
  '500': 'Mulish-Medium',
  '600': 'Mulish-SemiBold',
  '700': 'Mulish-Bold',
  '800': 'Mulish-Bold',
  '900': 'Mulish-Bold',
  normal: 'Mulish-Regular',
  bold: 'Mulish-Bold',
};

const mapFontStyle = (style?: StyleProp<TextStyle>): TextStyle => {
  const flattened = StyleSheet.flatten(style) ?? {};
  const mapped: TextStyle = { ...flattened };

  if (!mapped.fontFamily) {
    const weight = mapped.fontWeight;
    if (weight) {
      const weightKey = typeof weight === 'string' ? weight.toLowerCase() : String(weight);
      const resolved = FONT_WEIGHT_TO_FAMILY[weightKey];
      if (resolved) {
        mapped.fontFamily = resolved;
        delete mapped.fontWeight;
      }
    }
  }

  if (!mapped.fontFamily) {
    mapped.fontFamily = DEFAULT_FONT_FAMILY;
  }

  if (!mapped.fontSize) {
    mapped.fontSize = TYPOGRAPHY.body.fontSize;
  }

  if (!mapped.lineHeight) {
    mapped.lineHeight = TYPOGRAPHY.body.lineHeight;
  }

  return mapped;
};

let fontsConfigured = false;
const configureGlobalTypography = () => {
  if (fontsConfigured) {
    return;
  }

  fontsConfigured = true;

  const TextWithDefaults = Text as typeof Text & { defaultProps?: any };
  const TextInputWithDefaults = TextInput as typeof TextInput & { defaultProps?: any };

  TextWithDefaults.defaultProps = {
    ...(TextWithDefaults.defaultProps ?? {}),
    style: mapFontStyle(TextWithDefaults.defaultProps?.style),
  };

  TextInputWithDefaults.defaultProps = {
    ...(TextInputWithDefaults.defaultProps ?? {}),
    style: mapFontStyle(TextInputWithDefaults.defaultProps?.style),
  };

  // @ts-expect-error React Native host components expose render for overriding default props.
  const originalTextRender = Text.render;
  if (originalTextRender) {
    // @ts-expect-error Overriding native render for typography normalization.
    Text.render = function (...args: any[]) {
      const element = originalTextRender.apply(this, args);
      return element ? cloneElement(element, { style: mapFontStyle(element.props.style) }) : element;
    };
  }
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Mulish-Regular': Mulish_400Regular,
    'Mulish-Medium': Mulish_500Medium,
    'Mulish-SemiBold': Mulish_600SemiBold,
    'Mulish-Bold': Mulish_700Bold,
  });

  useEffect(() => {
    // Configurar deep linking para OAuth
    const subscription = configureLinking();
    
    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      configureGlobalTypography();
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppThemeProvider>
      <AuthProvider>
        <GuestSessionProvider>
          <RealTimeProvider>
            <AutofillStyle />
            <RootNavigator />
          </RealTimeProvider>
        </GuestSessionProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}

function AutofillStyle() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const autofillOverlay = 'transparent';

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const styleId = 'yopago-autofill-style';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      textarea:-webkit-autofill,
      textarea:-webkit-autofill:hover,
      textarea:-webkit-autofill:focus,
      select:-webkit-autofill,
      select:-webkit-autofill:hover,
      select:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0px 1000px ${autofillOverlay} inset !important;
        box-shadow: 0 0 0px 1000px ${autofillOverlay} inset !important;
        background-color: ${autofillOverlay} !important;
        -webkit-text-fill-color: ${palette.text} !important;
        caret-color: ${palette.text} !important;
        transition: background-color 5000s ease-in-out 0s;
      }
    `;

    return () => {
      if (styleElement?.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [autofillOverlay, palette.text]);

  return null;
}

function RootNavigator() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="create-group" options={{ headerShown: false }} />
        <Stack.Screen name="join-group" options={{ headerShown: false }} />
        <Stack.Screen name="invite/[token]" options={{ headerShown: false }} />
        <Stack.Screen name="guest" options={{ headerShown: false }} />
        <Stack.Screen name="capture-receipt" options={{ headerShown: false }} />
        <Stack.Screen
          name="my-groups"
          options={{
            title: 'Mis Grupos',
            headerBackTitle: 'Atrás',
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
