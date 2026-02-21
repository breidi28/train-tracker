import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchStations } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';

interface Station {
  name: string;
  station_id: number;
  region?: string;
}

export default function StationsScreen() {
  const router = useRouter();
  const { dark } = useTheme();

  const [stations, setStations] = useState<Station[]>([]);
  const [filtered, setFiltered] = useState<Station[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchStations();
        setStations(data);
        setFiltered(data);
      } catch {
        setError('Nu s-au putut încărca stațiile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setFiltered(stations); return; }
    const q = query.toLowerCase();
    setFiltered(stations.filter(s => s.name.toLowerCase().includes(q)));
  }, [query, stations]);

  const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
  const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const inputBg = dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900';
  const headTxt = dark ? 'text-white' : 'text-gray-900';
  const subTxt = dark ? 'text-gray-400' : 'text-gray-500';
  const divider = dark ? 'border-gray-800' : 'border-gray-100';

  if (loading) {
    return (
      <View className={`flex-1 justify-center items-center ${bg}`}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className={`mt-3 ${subTxt}`}>Se încarcă stațiile…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 justify-center items-center ${bg} px-6`}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text className="text-red-500 text-base mt-3 text-center">{error}</Text>
        <TouchableOpacity
          className="bg-primary rounded-xl px-6 py-3 mt-4"
          onPress={() => { setLoading(true); setError(''); }}
        >
          <Text className="text-white font-bold">Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${bg}`}>
      <View className={`px-4 pt-4 pb-3 border-b ${card}`}>
        <TextInput
          className={`border rounded-xl px-4 py-3 text-base ${inputBg}`}
          placeholder="Filtrează stații…"
          placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item.station_id}-${index}`}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            className={`border-b px-4 py-4 flex-row items-center ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
            activeOpacity={0.6}
            onPress={() =>
              router.push({
                pathname: '/station/[id]',
                params: { id: String(item.station_id), name: item.name },
              })
            }
          >
            <Ionicons name="location-outline" size={18} color="#0066CC" style={{ marginRight: 10 }} />
            <Text className={`text-sm font-semibold flex-1 ${headTxt}`}>{item.name}</Text>
            {item.region ? (
              <Text className={`text-xs mr-2 ${subTxt}`}>{item.region}</Text>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={dark ? '#4B5563' : '#D1D5DB'} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text className={`text-center mt-8 ${subTxt}`}>Nicio stație găsită</Text>
        }
      />
    </View>
  );
}
