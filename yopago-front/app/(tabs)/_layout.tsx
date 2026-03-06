import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TabBarBlurWrapper } from '@/components/ui/TabBarBlurWrapper';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? 'light';
  const { isAuthenticated, isLoading } = useAuth();
  const shouldShowTabs = isAuthenticated && !isLoading;
  const palette = Colors[colorScheme];
    const tabBarBg = colorScheme === 'dark'
      ? 'rgba(60,72,90,0.75)'
      : palette.surface;
  const renderLabel = React.useCallback((label: string) => {
    const LabelComponent = ({ color }: { color: string }) => (
      <Text
        style={{
          color,
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.25,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    );
    LabelComponent.displayName = `TabLabel_${label}`;
    return LabelComponent;
  }, []);

  return (
    <TabBarBlurWrapper>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: shouldShowTabs ? HapticTab : () => null,
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarStyle: shouldShowTabs 
            ? {
                backgroundColor: tabBarBg,
                left: 0,
                right: 0,
                borderTopColor: palette.divider,
                borderTopWidth: StyleSheet.hairlineWidth,
                paddingTop: 2,
                paddingBottom: Platform.OS === 'ios' ? 10 : 8,
                height: Platform.OS === 'ios' ? 64 : 62,
                ...(Platform.OS === 'web' && colorScheme === 'dark' ? {
                  backdropFilter: 'blur(64px)',
                  WebkitBackdropFilter: 'blur(64px)',
                } : {}),
              }
            : { display: 'none' },
        }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: renderLabel(t('tabs.home')),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-groups"
        options={{
          title: t('tabs.groups'),
          tabBarLabel: renderLabel(t('tabs.groups')),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.3.fill" color={color} />,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: t('tabs.balance'),
          tabBarLabel: renderLabel(t('tabs.balance')),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="chart.pie.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.account'),
          tabBarLabel: renderLabel(t('tabs.account')),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.crop.circle" color={color} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="group-details"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      </Tabs>
    </TabBarBlurWrapper>
  );
}
