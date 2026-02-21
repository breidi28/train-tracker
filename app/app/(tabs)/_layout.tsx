import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useTranslation } from 'react-i18next';


export default function TabLayout() {
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
          tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} />,
          headerTitle: 'CFR Train Tracker',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color }) => <Ionicons name="search" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mytrains"
        options={{
          title: t('tabs.trains'),
          headerTitle: t('tabs.trains'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: t('tabs.stations'),
          tabBarIcon: ({ color }) => <Ionicons name="train" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
