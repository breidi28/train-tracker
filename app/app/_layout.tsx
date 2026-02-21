import "../global.css";
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupNotificationChannel, pollWatchedTrains } from '../src/notifications';
import { ThemeProvider, useTheme } from '../src/ThemeContext';

function AppShell() {
  const { dark } = useTheme();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    setupNotificationChannel();
    pollWatchedTrains();
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="train/[id]" options={{ title: 'Detalii Tren', headerBackTitle: '' }} />
        <Stack.Screen name="station/[id]" options={{ title: 'Orar Stație', headerBackTitle: '' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
