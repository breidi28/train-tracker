import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useTranslation } from 'react-i18next';
import WebLayout from '../../src/WebLayout';

// ─── Web layout (sidebar + content area) ─────────────────────────────────────
// On web the Tabs component is still rendered, but we hide the tab bar entirely
// and replace navigation with a sidebar rendered inside WebLayout.
// The Tabs render their children (each tab screen) as regular React children,
// so wrapping them in WebLayout gives us the desktop shell for free.

function WebTabLayout() {
  const { t } = useTranslation();

  return (
    <WebLayout>
      {/* Tab bar is hidden; WebLayout's sidebar handles navigation */}
      <Tabs
        screenOptions={{
          headerShown: false,   // headers handled by WebLayout + Stack
          tabBarStyle: { display: 'none' },  // hide the native bottom tab bar
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="search" options={{ title: t('tabs.search') }} />
        <Tabs.Screen name="mytrains" options={{ title: t('tabs.trains') }} />
        <Tabs.Screen name="stations" options={{ title: t('tabs.stations') }} />
        <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
      </Tabs>
    </WebLayout>
  );
}

// ─── Native (iOS / Android) layout – unchanged ────────────────────────────────

function NativeTabLayout() {
  const insets = useSafeAreaInsets();
  const { dark } = useTheme();
  const { t } = useTranslation();

  const tabBar = dark ? '#111827' : '#ffffff';
  const border = dark ? '#1F2937' : '#E5E7EB';
  const header = '#0066CC';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: dark ? '#6B7280' : '#9CA3AF',
        tabBarStyle: {
          backgroundColor: tabBar,
          borderTopColor: border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: header },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          headerShown: false, // the custom blue hero banner replaces the native header
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mytrains"
        options={{
          title: t('tabs.trains'),
          headerTitle: t('tabs.trains'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'star' : 'star-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: t('tabs.stations'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return Platform.OS === 'web' ? <WebTabLayout /> : <NativeTabLayout />;
}
