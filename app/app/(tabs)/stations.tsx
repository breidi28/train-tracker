import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchStations } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';

interface Station {
  name: string;
  station_id: number;
  region?: string;
}

export default function StationsScreen() {
  const router = useRouter();
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

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className="text-gray-500 mt-3">Se încarcă stațiile…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 px-6">
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
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-3 bg-white border-b border-gray-200">
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
          placeholder="Filtrează stații..."
          placeholderTextColor="#9CA3AF"
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
            className="bg-white border-b border-gray-100 px-4 py-4 flex-row justify-between items-center"
            activeOpacity={0.6}
            onPress={() =>
              router.push({
                pathname: '/station/[id]',
                params: { id: String(item.station_id), name: item.name },
              })
            }
          >
            <Text className="text-base font-semibold text-gray-900 flex-1">{item.name}</Text>
            {item.region ? <Text className="text-xs text-gray-400 ml-2">{item.region}</Text> : null}
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text className="text-center text-gray-500 mt-8">Nicio stație găsită</Text>
        }
      />
    </View>
  );
}
