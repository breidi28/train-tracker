import "../global.css";
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
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
    </SafeAreaProvider>
  );
}
