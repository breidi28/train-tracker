import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { searchTrains, searchStations } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useTranslation } from 'react-i18next';

const CATEGORY_COLORS: Record<string, string> = {
  IC: '#008000', IR: '#f00', IRN: '#f00', R: '#000', 'R-E': '#000',
};
function categoryColor(trainNumber: string) {
  const p = trainNumber.split(/[\s\d]/)[0]?.toUpperCase() ?? '';
  return CATEGORY_COLORS[p] ?? '#4B5563';
}

export interface UnifiedResult {
  type: 'train' | 'station';
  id: string; // train_number or station_id
  title: string;
  subtitle?: string;
  category?: string;
  departure_time?: string;
  arrival_time?: string;
}

// Module-level cache to prevent redudant API fetches while typing/backspacing
const queryCache: Record<string, UnifiedResult[]> = {};

export default function SearchScreen() {
  const router = useRouter();
  const { dark } = useTheme();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [suggestions, setSuggestions] = useState<UnifiedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = query.trim();
      const cacheKey = q.toLowerCase();

      if (q.length >= 2) {
        if (queryCache[cacheKey]) {
          setSuggestions(queryCache[cacheKey]);
          setShowSuggestions(true);
          return;
        }

        try {
          const [trainData, stationData] = await Promise.all([
            searchTrains(q).catch(() => ({ results: [] })),
            searchStations(q).catch(() => [])
          ]);

          const unified: UnifiedResult[] = [
            ...(trainData.results?.slice(0, 3) || []).map((tr: any) => ({
              type: 'train' as const,
              id: tr.train_number,
              title: tr.train_number,
              subtitle: tr.route,
              category: tr.category,
              departure_time: tr.departure_time,
              arrival_time: tr.arrival_time,
            })),
            ...(stationData?.slice(0, 3) || []).map((st: any) => ({
              type: 'station' as const,
              id: String(st.station_id),
              title: st.name,
              subtitle: st.region,
            }))
          ];
          setSuggestions(unified);
          queryCache[cacheKey] = unified;
          setShowSuggestions(true);
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setShowSuggestions(false);
    setLoading(true);
    setError('');
    setSearched(true);
    Keyboard.dismiss();
    try {
      const [trainData, stationData] = await Promise.all([
        searchTrains(q).catch(() => ({ results: [] })),
        searchStations(q).catch(() => [])
      ]);

      const unified: UnifiedResult[] = [
        ...(trainData.results || []).map((tr: any) => ({
          type: 'train' as const,
          id: tr.train_number,
          title: tr.train_number,
          subtitle: tr.route,
          category: tr.category,
          departure_time: tr.departure_time,
          arrival_time: tr.arrival_time,
        })),
        ...(stationData || []).map((st: any) => ({
          type: 'station' as const,
          id: String(st.station_id),
          title: st.name,
          subtitle: st.region,
        }))
      ];
      setResults(unified);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t('search.searchError'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionTap = (item: UnifiedResult) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    if (item.type === 'train') {
      router.push(`/train/${encodeURIComponent(item.id)}`);
    } else {
      router.push({ pathname: '/station/[id]', params: { id: item.id, name: item.title } });
    }
  };

  // Theme
  const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
  const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const inputBg = dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900';
  const headText = dark ? 'text-white' : 'text-gray-900';
  const subText = dark ? 'text-gray-400' : 'text-gray-500';
  const divider = dark ? 'border-gray-800' : 'border-gray-100';

  return (
    <ScrollView className={`flex-1 ${bg}`}>
      <View>
        {/* Search bar */}
        <View className={`border-b px-4 pt-4 pb-3 ${card}`}>
          <Text className={`font-bold mb-3 text-xs tracking-widest ${subText}`}>{t('search.header')}</Text>
          <View className="flex-row gap-3">
            <TextInput
              className={`flex-1 border rounded-xl px-4 py-3 text-base ${inputBg}`}
              placeholder={t('search.inputPlaceholder')}
              placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              onFocus={() => {
                if (query.trim().length >= 2 && suggestions.length > 0) setShowSuggestions(true);
              }}
            />
            <TouchableOpacity
              className="bg-primary rounded-xl px-5 justify-center items-center"
              onPress={handleSearch}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Autocomplete */}
        {showSuggestions && suggestions.length > 0 && (
          <View className={`border-b ${card}`}>
            <View className={`px-4 py-2 border-b ${divider}`}>
              <Text className={`text-xs uppercase ${subText}`}>{t('search.suggestions')}</Text>
            </View>
            {suggestions.map((item, i) => (
              <TouchableOpacity
                key={`${item.id}-${i}`}
                className={`px-4 py-3 flex-row items-center border-b ${divider}`}
                onPress={() => handleSuggestionTap(item)}
                activeOpacity={0.6}
              >
                {item.type === 'train' ? (
                  <View
                    className="w-2 h-2 rounded-full mr-3"
                    style={{ backgroundColor: categoryColor(item.id) }}
                  />
                ) : (
                  <Ionicons name="location-outline" size={14} color="#0066CC" style={{ marginRight: 12, marginLeft: -2 }} />
                )}
                <View className="flex-1">
                  <Text className={`text-sm font-bold ${headText}`}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text className={`text-xs mt-0.5 ${subText}`}>{item.subtitle}</Text>
                  ) : null}
                </View>
                <Ionicons name="arrow-forward" size={14} color={dark ? '#4B5563' : '#D1D5DB'} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#0066CC" />
            <Text className={`mt-3 ${subText}`}>{t('search.searching')}</Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View className="bg-red-50 border border-red-100 mx-4 mt-4 rounded-2xl p-4">
            <Text className="text-red-600 text-center text-sm">{error}</Text>
          </View>
        ) : null}

        {/* Results */}
        {!loading && results.map((item, i) => (
          <TouchableOpacity
            key={`${item.id}-${i}`}
            className={`border-b px-4 py-4 flex-row items-center ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
            onPress={() => item.type === 'train' ? router.push(`/train/${encodeURIComponent(item.id)}`) : router.push({ pathname: '/station/[id]', params: { id: item.id, name: item.title } })}
            activeOpacity={0.6}
          >
            {item.type === 'train' ? (
              <View
                className="rounded-lg px-2.5 py-1 mr-3"
                style={{ backgroundColor: categoryColor(item.id) }}
              >
                <Text className="text-white font-bold text-xs">{item.id}</Text>
              </View>
            ) : (
              <View className="bg-blue-50 dark:bg-blue-900/30 rounded-lg px-2.5 py-1 mr-3">
                <Ionicons name="location" size={16} color="#0066CC" />
              </View>
            )}
            <View className="flex-1">
              <Text className={`text-sm font-bold flex-1 ${headText}`}>
                {item.type === 'train' && item.subtitle ? `${item.subtitle}` : item.title}
              </Text>

              {item.type === 'train' ? (
                <View className="flex-row gap-4 mt-1">
                  {item.departure_time ? (
                    <Text className={`text-xs ${subText}`}>{t('search.departure')}: {item.departure_time}</Text>
                  ) : null}
                  {item.arrival_time ? (
                    <Text className={`text-xs ${subText}`}>{t('search.arrival')}: {item.arrival_time}</Text>
                  ) : null}
                </View>
              ) : item.subtitle ? (
                <Text className={`text-xs mt-0.5 ${subText}`}>{item.subtitle}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={dark ? '#4B5563' : '#D1D5DB'} />
          </TouchableOpacity>
        ))}

        {/* Empty state */}
        {!loading && searched && results.length === 0 && !error && (
          <View className="items-center py-12">
            <Ionicons name="search" size={48} color={dark ? '#374151' : '#E5E7EB'} />
            <Text className={`mt-3 ${subText}`}>{t('search.noResultFound')}</Text>
          </View>
        )}

        {/* Initial state */}
        {!searched && !loading && (
          <View className="items-center py-12">
            <Ionicons name="train" size={48} color={dark ? '#374151' : '#E5E7EB'} />
            <Text className={`text-center mt-3 ${subText}`}>
              {t('search.hint')}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
