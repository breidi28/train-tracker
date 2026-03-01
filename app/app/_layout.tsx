import "../global.css";
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';

// Web-only styles (pseudo-elements, -webkit-*, ::selection, @media hover)
// These MUST NOT be processed by NativeWind on native, so we import them
// conditionally. Metro's dead-code elimination ensures they're excluded from
// the native bundle.
if (Platform.OS === 'web') {
  require('../global.web.css');
}

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import { setupNotificationChannel, pollWatchedTrains, registerBackgroundFetchAsync } from '../src/notifications';
import { ThemeProvider, useTheme } from '../src/ThemeContext';
import i18n, { initI18n } from '../src/i18n';

function AppShell() {
  const { dark } = useTheme();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setupNotificationChannel();
      pollWatchedTrains();
      registerBackgroundFetchAsync().catch((err) => {
        console.warn("Background fetch registration failed (expected in Expo Go iOS):", err.message);
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        pollWatchedTrains();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  // On web we suppress the Stack header for detail screens and let the
  // WebLayout sidebar stay visible.  The Tabs group already wraps itself
  // in WebLayout via its own _layout.tsx.
  const webDetailScreenOptions = {
    headerShown: false,
  };

  return (
    <>
      <StatusBar style={dark ? 'light' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0066CC' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Acasă' }} />
        <Stack.Screen
          name="train/[id]"
          options={Platform.OS === 'web' ? webDetailScreenOptions : { title: 'Detalii Tren', headerBackTitle: 'Acasă' }}
        />
        <Stack.Screen
          name="station/[id]"
          options={Platform.OS === 'web' ? webDetailScreenOptions : { title: 'Orar Stație', headerBackTitle: 'Acasă' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    // Show a minimal splash while i18n loads (< 100ms typically)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0066CC' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
