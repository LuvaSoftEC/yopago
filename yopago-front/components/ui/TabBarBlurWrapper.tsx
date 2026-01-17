import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export function TabBarBlurWrapper({ children }: { children: React.ReactNode }) {
  // Solo aplica blur en iOS y Android
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return (
      <BlurView intensity={32} style={StyleSheet.absoluteFill} tint="dark">
        {children}
      </BlurView>
    );
  }
  // En web, solo renderiza los hijos
  return <>{children}</>;
}
