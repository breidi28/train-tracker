import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
        },
        headerStyle: { backgroundColor: '#0066CC' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Acasă',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
          headerTitle: 'Trenul Meu',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Căutare',
          tabBarIcon: ({ color }) => <Ionicons name="search" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: 'Stații',
          tabBarIcon: ({ color }) => <Ionicons name="train" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Setări',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
