import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE, fetchApiStatus } from '../../src/api';
import { useTheme, type ThemeChoice } from '../../src/ThemeContext';

export default function SettingsScreen() {
  const { dark, themeChoice, setTheme } = useTheme();

  const [status, setStatus] = useState('Se verifică…');
  const [statusOk, setStatusOk] = useState<boolean | null>(null);

  const checkConnection = async () => {
    setStatus('Se verifică…');
    setStatusOk(null);
    try {
      const data = await fetchApiStatus();
      setStatus(data.status ?? 'Conectat');
      setStatusOk(true);
    } catch {
      setStatus('Nu se poate conecta');
      setStatusOk(false);
    }
  };

  useEffect(() => { checkConnection(); }, []);

  const dotColor = statusOk === true ? '#16A34A' : statusOk === false ? '#DC2626' : '#D97706';

  // Theme shortcuts
  const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
  const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const headTxt = dark ? 'text-white' : 'text-gray-900';
  const subTxt = dark ? 'text-gray-400' : 'text-gray-500';
  const divider = dark ? 'border-gray-800' : 'border-gray-100';

  const themeOptions: { key: ThemeChoice; label: string; icon: string; desc: string }[] = [
    { key: 'light', label: 'Luminos', icon: 'sunny', desc: 'Fundal alb mereu' },
    { key: 'dark', label: 'Întunecat', icon: 'moon', desc: 'Fundal gri-negru' },
    { key: 'system', label: 'Automat', icon: 'phone-portrait', desc: 'Urmează telefonul' },
  ];

  return (
    <ScrollView className={`flex-1 ${bg}`}>
      <View className="pb-8 px-4 pt-4 gap-3">

        {/* ── Dark mode selector ───────────────────────────────────────── */}
        <View className={`border rounded-2xl overflow-hidden ${card}`}>
          <View className="px-4 pt-4 pb-2">
            <Text className={`text-xs font-bold tracking-widest ${subTxt}`}>MOD VIZUAL</Text>
          </View>
          {themeOptions.map(({ key, label, icon, desc }, i) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTheme(key)}
              activeOpacity={0.7}
              className={`px-4 py-3 flex-row items-center ${i < themeOptions.length - 1 ? `border-b ${divider}` : ''}`}
            >
              {/* Icon */}
              <View
                className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                style={{
                  backgroundColor: themeChoice === key
                    ? '#0066CC22'
                    : dark ? '#1F2937' : '#F3F4F6',
                }}
              >
                <Ionicons
                  name={icon as any}
                  size={18}
                  color={themeChoice === key ? '#0066CC' : dark ? '#6B7280' : '#9CA3AF'}
                />
              </View>

              <View className="flex-1">
                <Text
                  className={`text-sm font-semibold ${themeChoice === key ? 'text-primary' : headTxt}`}
                >
                  {label}
                </Text>
                <Text className={`text-xs mt-0.5 ${subTxt}`}>{desc}</Text>
              </View>

              {/* Radio dot */}
              <View
                className="w-5 h-5 rounded-full border-2 items-center justify-center"
                style={{
                  borderColor: themeChoice === key
                    ? '#0066CC'
                    : dark ? '#4B5563' : '#D1D5DB',
                }}
              >
                {themeChoice === key && (
                  <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Connection status ─────────────────────────────────────────── */}
        <View className={`border rounded-2xl p-4 ${card}`}>
          <Text className={`text-xs font-bold tracking-widest mb-3 ${subTxt}`}>CONEXIUNE BACKEND</Text>
          <Text className={`text-sm mb-3 font-mono ${subTxt}`}>{API_BASE}</Text>
          <View className="flex-row items-center mb-4">
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor, marginRight: 8 }}
            />
            <Text className={`text-sm ${headTxt}`}>{status}</Text>
          </View>
          <TouchableOpacity
            className="bg-primary rounded-xl py-3 items-center"
            onPress={checkConnection}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-sm">VERIFICĂ DIN NOU</Text>
          </TouchableOpacity>
        </View>

        {/* ── About ────────────────────────────────────────────────────── */}
        <View className={`border rounded-2xl p-4 ${card}`}>
          <Text className={`text-xs font-bold tracking-widest mb-3 ${subTxt}`}>DESPRE</Text>
          <Text className={`text-sm font-semibold mb-1 ${headTxt}`}>Trenul Meu v1.1</Text>
          <Text className={`text-xs leading-5 ${subTxt}`}>
            Aplicație pentru urmărirea trenurilor CFR Călători în timp real.
            Datele provin din surse oficiale (data.gov.ro).
          </Text>
          <View className="flex-row gap-2 mt-3 flex-wrap">
            {['Timp real', 'Alerte întârzieri', 'Mod întunecat', 'Istoric'].map(badge => (
              <View key={badge} className="bg-primary-light rounded-full px-3 py-1">
                <Text style={{ color: '#0066CC', fontSize: 11, fontWeight: '700' }}>{badge}</Text>
              </View>
            ))}
          </View>
        </View>

      </View>
    </ScrollView>
  );
}
