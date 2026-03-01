import React, { useEffect, useState, memo } from 'react';
import {
  View, Text, FlatList, TextInput,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchStations } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useTranslation } from 'react-i18next';


interface Station {
  name: string;
  station_id: number;
  region?: string;
}

const StationItem = memo(({ item, dark, headTxt, subTxt, onPress }: {
  item: Station, dark: boolean, headTxt: string, subTxt: string, onPress: () => void
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`mx-4 my-1.5 px-4 py-5 rounded-2xl border flex-row items-center ${dark ? 'bg-[#111827] border-gray-800' : 'bg-white border-gray-100 shadow-sm'
        }`}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${dark ? 'bg-gray-800' : 'bg-blue-50'}`}>
        <Ionicons name="location" size={20} color="#0066CC" />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-bold ${headTxt}`}>{item.name}</Text>
        {item.region ? (
          <Text className={`text-xs mt-0.5 ${subTxt}`}>{item.region}</Text>
        ) : (
          <Text className={`text-xs mt-0.5 ${subTxt}`}>Stație CFR</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={dark ? '#4B5563' : '#D1D5DB'} />
    </TouchableOpacity>
  );
});

export default function StationsScreen() {
  const router = useRouter();
  const { dark } = useTheme();
  const { t } = useTranslation();

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
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setFiltered(stations); return; }

    const normalize = (str: string) =>
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const q = normalize(query);
    setFiltered(stations.filter(s => normalize(s.name).includes(q)));
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
        <Text className={`mt-3 ${subTxt}`}>{t('common.loading')}</Text>
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
          <Text className="text-white font-bold">{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${bg}`}>
      <View className={`px-4 pt-4 pb-3 border-b ${card}`}>
        <View className={`flex-row items-center border rounded-xl px-3 ${inputBg}`}>
          <Ionicons name="search" size={18} color={dark ? '#6B7280' : '#9CA3AF'} />
          <TextInput
            className={`flex-1 py-3 px-2 text-base ${dark ? 'text-white' : 'text-gray-900'}`}
            placeholder={t('station.searchPlaceholder')}
            placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={dark ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item.station_id}-${index}`}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={11}
        removeClippedSubviews={true}
        renderItem={({ item }) => (
          <StationItem
            item={item}
            dark={dark}
            headTxt={headTxt}
            subTxt={subTxt}
            onPress={() =>
              router.push({
                pathname: '/station/[id]',
                params: { id: String(item.station_id), name: item.name },
              })
            }
          />
        )}
        ListEmptyComponent={
          <Text className={`text-center mt-8 ${subTxt}`}>{t('search.noResults')}</Text>
        }
      />
    </View>
  );
}
