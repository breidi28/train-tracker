import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { searchTrains } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';

const CATEGORY_COLORS: Record<string, string> = {
  IC: '#DC2626', IR: '#2563EB', R: '#16A34A', 'R-E': '#7C3AED',
};
function categoryColor(trainNumber: string) {
  const p = trainNumber.split(/[\s\d]/)[0]?.toUpperCase() ?? '';
  return CATEGORY_COLORS[p] ?? '#4B5563';
}

interface TrainResult {
  train_number: string;
  route?: string;
  category?: string;
  departure_time?: string;
  arrival_time?: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const { dark } = useTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrainResult[]>([]);
  const [suggestions, setSuggestions] = useState<TrainResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = query.trim();
      if (q.length >= 2) {
        try {
          const data = await searchTrains(q);
          setSuggestions(data.results?.slice(0, 5) ?? []);
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
      const data = await searchTrains(q);
      setResults(data.results ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Eroare la căutare');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionTap = (trainNumber: string) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    router.push(`/train/${encodeURIComponent(trainNumber)}`);
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
          <Text className={`font-bold mb-3 text-xs tracking-widest ${subText}`}>CAUTĂ TRENURI</Text>
          <View className="flex-row gap-3">
            <TextInput
              className={`flex-1 border rounded-xl px-4 py-3 text-base ${inputBg}`}
              placeholder="Ex: IR, IC 536, Brașov…"
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
              <Text className={`text-xs uppercase ${subText}`}>Sugestii</Text>
            </View>
            {suggestions.map((train, i) => (
              <TouchableOpacity
                key={`${train.train_number}-${i}`}
                className={`px-4 py-3 flex-row items-center border-b ${divider}`}
                onPress={() => handleSuggestionTap(train.train_number)}
                activeOpacity={0.6}
              >
                <View
                  className="w-2 h-2 rounded-full mr-3"
                  style={{ backgroundColor: categoryColor(train.train_number) }}
                />
                <View className="flex-1">
                  <Text className={`text-sm font-bold ${headText}`}>{train.train_number}</Text>
                  {train.route ? (
                    <Text className={`text-xs mt-0.5 ${subText}`}>{train.route}</Text>
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
            <Text className={`mt-3 ${subText}`}>Se caută…</Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View className="bg-red-50 border border-red-100 mx-4 mt-4 rounded-2xl p-4">
            <Text className="text-red-600 text-center text-sm">{error}</Text>
          </View>
        ) : null}

        {/* Results */}
        {!loading && results.map((train, i) => (
          <TouchableOpacity
            key={`${train.train_number}-${i}`}
            className={`border-b px-4 py-4 flex-row items-center ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
            onPress={() => router.push(`/train/${encodeURIComponent(train.train_number)}`)}
            activeOpacity={0.6}
          >
            <View
              className="rounded-lg px-2.5 py-1 mr-3"
              style={{ backgroundColor: categoryColor(train.train_number) }}
            >
              <Text className="text-white font-bold text-xs">{train.train_number}</Text>
            </View>
            <View className="flex-1">
              {train.route ? (
                <Text className={`text-sm font-semibold ${headText}`}>{train.route}</Text>
              ) : null}
              <View className="flex-row gap-4 mt-1">
                {train.departure_time ? (
                  <Text className={`text-xs ${subText}`}>Plecare: {train.departure_time}</Text>
                ) : null}
                {train.arrival_time ? (
                  <Text className={`text-xs ${subText}`}>Sosire: {train.arrival_time}</Text>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={dark ? '#4B5563' : '#D1D5DB'} />
          </TouchableOpacity>
        ))}

        {/* Empty state */}
        {!loading && searched && results.length === 0 && !error && (
          <View className="items-center py-12">
            <Ionicons name="search" size={48} color={dark ? '#374151' : '#E5E7EB'} />
            <Text className={`mt-3 ${subText}`}>Niciun rezultat găsit</Text>
          </View>
        )}

        {/* Initial state */}
        {!searched && !loading && (
          <View className="items-center py-12">
            <Ionicons name="train" size={48} color={dark ? '#374151' : '#E5E7EB'} />
            <Text className={`text-center mt-3 ${subText}`}>
              Caută după număr tren, categorie{'\n'}(IR, IC, R) sau numele stației
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
