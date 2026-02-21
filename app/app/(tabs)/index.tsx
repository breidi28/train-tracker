import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Keyboard, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchTrains } from '../../src/api';
import {
  getRecentSearches, clearRecentSearches, type RecentTrain,
  getFavoriteTrains, getFavoriteStations, type FavoriteItem
} from '../../src/storage';
import { useTheme } from '../../src/ThemeContext';

// Badge colours per train category
const CATEGORY_COLORS: Record<string, string> = {
  IC: '#DC2626', IR: '#2563EB', R: '#16A34A', 'R-E': '#7C3AED',
};
function categoryColor(trainNumber: string): string {
  const prefix = trainNumber.split(/[\s\d]/)[0]?.toUpperCase() ?? '';
  return CATEGORY_COLORS[prefix] ?? '#4B5563';
}

export default function HomeScreen() {
  const router = useRouter();
  const { dark } = useTheme();

  const [trainNumber, setTrainNumber] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recents, setRecents] = useState<RecentTrain[]>([]);
  const [favTrains, setFavTrains] = useState<FavoriteItem[]>([]);
  const [favStations, setFavStations] = useState<FavoriteItem[]>([]);

  // Load recents and favs whenever this tab gains focus
  useFocusEffect(
    useCallback(() => {
      getRecentSearches().then(setRecents);
      getFavoriteTrains().then(setFavTrains);
      getFavoriteStations().then(setFavStations);
    }, [])
  );

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = trainNumber.trim();
      if (q.length >= 2) {
        try {
          const data = await searchTrains(q);
          setSuggestions(data.results?.slice(0, 4) ?? []);
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
  }, [trainNumber]);

  const handleSearch = () => {
    const q = trainNumber.trim();
    if (!q) { setError('Introduceți numărul trenului'); return; }
    setError('');
    setShowSuggestions(false);
    Keyboard.dismiss();
    router.push(`/train/${encodeURIComponent(q)}`);
  };

  const handleSuggestionTap = (train: any) => {
    setShowSuggestions(false);
    Keyboard.dismiss();
    router.push(`/train/${encodeURIComponent(train.train_number)}`);
  };

  const handleRecentTap = (t: RecentTrain) => {
    router.push(`/train/${encodeURIComponent(t.trainNumber)}`);
  };

  const handleClearRecents = async () => {
    await clearRecentSearches();
    setRecents([]);
  };

  // ── Theming shortcuts ───────────────────────────────────────────────────────
  const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
  const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const inputBg = dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900';
  const labelText = dark ? 'text-gray-400' : 'text-gray-500';
  const headingText = dark ? 'text-white' : 'text-gray-900';

  return (
    <ScrollView className={`flex-1 ${bg}`}>
      <View className="pb-8">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View className="bg-primary px-6 pt-8 pb-14">
          <Text className="text-white text-3xl font-bold mb-1">Caută trenul tău</Text>
          <Text className="text-blue-100 text-sm">Urmărește trenul în timp real</Text>
        </View>

        {/* ── Search card ──────────────────────────────────────────────── */}
        <View className="px-4 -mt-8">
          <View className={`border rounded-2xl overflow-hidden shadow-sm ${card}`}>
            <View className="p-4">
              <Text className={`font-bold mb-3 text-xs tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                CAUTĂ TREN
              </Text>
              <View className="flex-row gap-3">
                <TextInput
                  className={`flex-1 border rounded-xl px-4 ${inputBg}`}
                  style={{
                    height: 48,
                    paddingVertical: 0,
                    textAlignVertical: 'center',
                    fontSize: 16,
                    // iOS renders text slightly lower without this:
                    paddingTop: Platform.OS === 'ios' ? 0 : undefined,
                    paddingBottom: Platform.OS === 'ios' ? 0 : undefined,
                    includeFontPadding: false,
                  } as any}
                  placeholder="Ex: IR 1732"
                  placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
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
                  className="bg-primary rounded-xl px-5 justify-center items-center"
                  onPress={handleSearch}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              {error ? <Text className="text-red-500 mt-2 text-sm">{error}</Text> : null}
            </View>

            {/* Autocomplete suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <View className={`border-t ${dark ? 'border-gray-800' : 'border-gray-100'}`}>
                {suggestions.map((train, i) => (
                  <TouchableOpacity
                    key={`${train.train_number}-${i}`}
                    className={`px-4 py-3 flex-row items-center border-b ${dark ? 'border-gray-800 active:bg-gray-800' : 'border-gray-50 active:bg-gray-50'}`}
                    onPress={() => handleSuggestionTap(train)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={{ backgroundColor: categoryColor(train.train_number) }}
                      className="w-2 h-2 rounded-full mr-3"
                    />
                    <View className="flex-1">
                      <Text className={`text-sm font-bold ${headingText}`}>{train.train_number}</Text>
                      {train.route ? (
                        <Text className={`text-xs mt-0.5 ${labelText}`}>{train.route}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={dark ? '#4B5563' : '#D1D5DB'} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Recent searches ───────────────────────────────────────────── */}
        {recents.length > 0 && (
          <View className="px-4 mt-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className={`text-xs font-bold tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                CĂUTĂRI RECENTE
              </Text>
              <TouchableOpacity onPress={handleClearRecents} activeOpacity={0.7}>
                <Text className="text-primary text-xs font-semibold">Șterge tot</Text>
              </TouchableOpacity>
            </View>
            <View className={`border rounded-2xl overflow-hidden ${card}`}>
              {recents.map((t, i) => (
                <TouchableOpacity
                  key={`${t.trainNumber}-${i}`}
                  className={`px-4 py-3 flex-row items-center ${i < recents.length - 1
                    ? `border-b ${dark ? 'border-gray-800' : 'border-gray-100'}`
                    : ''
                    }`}
                  onPress={() => handleRecentTap(t)}
                  activeOpacity={0.6}
                >
                  <View className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: categoryColor(t.trainNumber) + '22' }}>
                    <Ionicons name="time-outline" size={15} color={categoryColor(t.trainNumber)} />
                  </View>
                  <View className="flex-1">
                    <Text className={`text-sm font-bold ${headingText}`}>{t.trainNumber}</Text>
                    {t.routeLabel ? (
                      <Text className={`text-xs mt-0.5 ${labelText}`} numberOfLines={1}>{t.routeLabel}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={dark ? '#4B5563' : '#D1D5DB'} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Favorite Trains ───────────────────────────────────────────── */}
        {favTrains.length > 0 && (
          <View className="px-4 mt-5">
            <View className="flex-row items-center mb-3">
              <Text className={`text-xs font-bold tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>TRENURI FAVORITE</Text>
            </View>
            <View className={`border rounded-2xl overflow-hidden ${card}`}>
              {favTrains.map((t, i) => (
                <TouchableOpacity
                  key={`${t.id}-${i}`}
                  className={`px-4 py-3 flex-row items-center ${i < favTrains.length - 1 ? `border-b ${dark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                  onPress={() => router.push(`/train/${encodeURIComponent(t.id)}`)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="star" size={16} color="#F59E0B" className="mr-3" />
                  <View className="flex-1 ml-3">
                    <Text className={`text-sm font-bold ${headingText}`}>{t.id}</Text>
                    {t.label ? <Text className={`text-xs mt-0.5 ${labelText}`} numberOfLines={1}>{t.label}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={dark ? '#4B5563' : '#D1D5DB'} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Favorite Stations ───────────────────────────────────────────── */}
        {favStations.length > 0 && (
          <View className="px-4 mt-5">
            <View className="flex-row items-center mb-3">
              <Text className={`text-xs font-bold tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>STAȚII FAVORITE</Text>
            </View>
            <View className={`border rounded-2xl overflow-hidden ${card}`}>
              {favStations.map((s, i) => (
                <TouchableOpacity
                  key={`${s.id}-${i}`}
                  className={`px-4 py-3 flex-row items-center ${i < favStations.length - 1 ? `border-b ${dark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                  onPress={() => router.push(`/station/${encodeURIComponent(s.id)}?name=${encodeURIComponent(s.label)}`)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="train" size={16} color="#0066CC" className="mr-3" />
                  <View className="flex-1 ml-3">
                    <Text className={`text-sm font-bold ${headingText}`}>{s.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={dark ? '#4B5563' : '#D1D5DB'} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Info cards ────────────────────────────────────────────────── */}
        <View className="px-4 mt-5 gap-3">
          {[
            { icon: 'train' as const, title: 'Urmărire în timp real', body: 'Verifică locația și întârzierile trenului tău' },
            { icon: 'location' as const, title: 'Stații și orar', body: 'Vezi orarul complet și stațiile de oprire' },
            { icon: 'time' as const, title: 'Întârzieri actualizate', body: 'Informații în timp real despre întârzieri' },
          ].map(({ icon, title, body }) => (
            <View key={title} className={`border rounded-2xl p-4 ${card}`}>
              <Ionicons name={icon} size={26} color="#0066CC" style={{ marginBottom: 6 }} />
              <Text className={`text-sm font-bold mb-1 ${headingText}`}>{title}</Text>
              <Text className={`text-xs leading-5 ${labelText}`}>{body}</Text>
            </View>
          ))}
        </View>

      </View>
    </ScrollView>
  );
}
