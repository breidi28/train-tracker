import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { searchTrains } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';

interface TrainResult {
  train_number: string;
  route?: string;
  category?: string;
  departure_time?: string;
  arrival_time?: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrainResult[]>([]);
  const [suggestions, setSuggestions] = useState<TrainResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Autocomplete search as user types
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = query.trim();
      if (q.length >= 2) {
        try {
          const data = await searchTrains(q);
          setSuggestions(data.results?.slice(0, 5) ?? []); // Show top 5 suggestions
          setShowSuggestions(true);
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // Debounce 300ms

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

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View>
        {/* Search bar */}
        <View className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
          <Text className="text-gray-900 font-semibold mb-3 text-sm">CAUTĂ TRENURI</Text>
          <View className="flex-row gap-3">
            <TextInput
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Ex: IR, IC 536, Brașov…"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              onFocus={() => {
                if (query.trim().length >= 2 && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            />
            <TouchableOpacity
              className="bg-primary rounded-lg px-5 justify-center"
              onPress={handleSearch}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold text-sm">Caută</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <View className="bg-white border-b border-gray-200">
            <View className="px-4 py-2 border-b border-gray-100">
              <Text className="text-xs text-gray-400 uppercase">Sugestii</Text>
            </View>
            {suggestions.map((train, i) => (
              <TouchableOpacity
                key={`${train.train_number}-${i}`}
                className="px-4 py-3 border-b border-gray-50 flex-row items-center active:bg-gray-50"
                onPress={() => handleSuggestionTap(train.train_number)}
                activeOpacity={0.6}
              >
                <Ionicons name="search" size={16} color="#9CA3AF" />
                <View className="flex-1 ml-3">
                  <Text className="text-sm font-semibold text-gray-900">{train.train_number}</Text>
                  {train.route ? (
                    <Text className="text-xs text-gray-400 mt-0.5">{train.route}</Text>
                  ) : null}
                </View>
                <Ionicons name="arrow-forward" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#0066CC" />
            <Text className="text-gray-500 mt-3">Se caută…</Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View className="bg-red-50 border border-red-100 mx-4 mt-4 rounded-lg p-4">
            <Text className="text-red-600 text-center text-sm">{error}</Text>
          </View>
        ) : null}

        {/* Results */}
        {!loading && results.map((train, i) => (
          <TouchableOpacity
            key={`${train.train_number}-${i}`}
            className="bg-white border-b border-gray-100 px-4 py-4 flex-row items-center"
            onPress={() => router.push(`/train/${encodeURIComponent(train.train_number)}`)}
            activeOpacity={0.6}
          >
            <View className="bg-primary rounded px-2.5 py-1 mr-3">
              <Text className="text-white font-bold text-xs">{train.train_number}</Text>
            </View>
            <View className="flex-1">
              {train.route ? <Text className="text-sm text-gray-900 font-semibold">{train.route}</Text> : null}
              <View className="flex-row gap-4 mt-1">
                {train.departure_time ? <Text className="text-xs text-gray-400">Plecare: {train.departure_time}</Text> : null}
                {train.arrival_time ? <Text className="text-xs text-gray-400">Sosire: {train.arrival_time}</Text> : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        ))}

        {/* Empty state */}
        {!loading && searched && results.length === 0 && !error && (
          <View className="items-center py-8">
            <Ionicons name="search" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 mt-2">Niciun rezultat găsit</Text>
          </View>
        )}

        {/* Initial state */}
        {!searched && !loading && (
          <View className="items-center py-8">
            <Ionicons name="train" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 text-center mt-2">
              Caută după număr tren, categorie{'\n'}(IR, IC, R) sau numele stației
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
