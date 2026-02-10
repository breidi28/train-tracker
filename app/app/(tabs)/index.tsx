import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchTrains } from '../../src/api';

export default function HomeScreen() {
  const router = useRouter();
  const [trainNumber, setTrainNumber] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Autocomplete search as user types
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = trainNumber.trim();
      if (q.length >= 2) {
        try {
          const data = await searchTrains(q);
          setSuggestions(data.results?.slice(0, 3) ?? []); // Show top 3 suggestions
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
  }, [trainNumber]);

  const handleSearch = () => {
    const q = trainNumber.trim();
    if (!q) { setError('Introduceți numărul trenului'); return; }
    setError('');
    setShowSuggestions(false);
    Keyboard.dismiss();
    router.push(`/train/${encodeURIComponent(q)}`);
  };

  const handleSuggestionTap = (trainNum: string) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    router.push(`/train/${encodeURIComponent(trainNum)}`);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="pb-8">
        {/* Hero */}
        <View className="bg-primary px-6 pt-8 pb-12">
          <Text className="text-white text-3xl font-bold mb-2">Trenul Meu</Text>
          <Text className="text-blue-100 text-sm">Urmărește trenul în timp real</Text>
        </View>

        {/* Search card */}
        <View className="px-6 -mt-6">
          <View className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <View className="p-4">
              <Text className="text-gray-900 font-semibold mb-3 text-sm">CAUTĂ TREN</Text>
              <View className="flex-row gap-3">
                <TextInput
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                  placeholder="Ex: IR 1732"
                  placeholderTextColor="#9CA3AF"
                  value={trainNumber}
                  onChangeText={setTrainNumber}
                  autoCapitalize="characters"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                  onFocus={() => {
                    if (trainNumber.trim().length >= 2 && suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                <TouchableOpacity
                  className="bg-primary rounded-lg px-5 justify-center items-center"
                  onPress={handleSearch}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-sm">Caută</Text>
                </TouchableOpacity>
              </View>
              {error ? <Text className="text-red-500 mt-2 text-sm">{error}</Text> : null}
            </View>
            
            {/* Autocomplete suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <View className="border-t border-gray-100">
                {suggestions.map((train, i) => (
                  <TouchableOpacity
                    key={`${train.train_number}-${i}`}
                    className="px-4 py-3 border-b border-gray-50 flex-row items-center active:bg-gray-50"
                    onPress={() => handleSuggestionTap(train.train_number)}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="search" size={14} color="#9CA3AF" />
                    <View className="flex-1 ml-3">
                      <Text className="text-sm font-semibold text-gray-900">{train.train_number}</Text>
                      {train.route ? (
                        <Text className="text-xs text-gray-400 mt-0.5">{train.route}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="arrow-forward" size={14} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Info cards */}
        <View className="px-6 mt-6">
          <View className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <Ionicons name="train" size={28} color="#0066CC" style={{ marginBottom: 8 }} />
            <Text className="text-base font-semibold text-gray-900 mb-1">Urmărire în timp real</Text>
            <Text className="text-sm text-gray-500">Verifică locația și întârzierile trenului tău</Text>
          </View>
          <View className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <Ionicons name="location" size={28} color="#0066CC" style={{ marginBottom: 8 }} />
            <Text className="text-base font-semibold text-gray-900 mb-1">Stații și orar</Text>
            <Text className="text-sm text-gray-500">Vezi orarul complet și stațiile de oprire</Text>
          </View>
          <View className="bg-white border border-gray-200 rounded-lg p-4">
            <Ionicons name="time" size={28} color="#0066CC" style={{ marginBottom: 8 }} />
            <Text className="text-base font-semibold text-gray-900 mb-1">Întârzieri actualizate</Text>
            <Text className="text-sm text-gray-500">Informații în timp real despre întârzieri</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
