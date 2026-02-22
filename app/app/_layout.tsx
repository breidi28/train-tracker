import "../global.css";
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
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
    setupNotificationChannel();
    pollWatchedTrains();
    // Catch BackgroundFetch info.plist error in Expo Go
    registerBackgroundFetchAsync().catch((err) => {
      console.warn("Background fetch registration failed (expected in Expo Go iOS):", err.message);
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        pollWatchedTrains();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

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
        <Stack.Screen name="train/[id]" options={{ title: 'Detalii Tren', headerBackTitle: 'Acasă' }} />
        <Stack.Screen name="station/[id]" options={{ title: 'Orar Stație', headerBackTitle: 'Acasă' }} />
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
