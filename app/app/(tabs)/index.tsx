import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Keyboard, Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { searchTrains } from '../../src/api';
import {
  getRecentSearches, clearRecentSearches, type RecentTrain,
  getFavoriteTrains, getFavoriteStations, type FavoriteItem
} from '../../src/storage';
import { useTheme } from '../../src/ThemeContext';
import { categoryColor, categoryPrefix } from '../../src/trainColors';


// Badge colours per train category
// Color functions now imported from trainColors.ts

function formatTrainId(trainId: string | undefined): string {
  if (!trainId) return '—';
  // If it already has a space, return as is
  if (trainId.includes(' ')) return trainId;
  // Otherwise, insert space between rank and numbers (e.g. IR1575 -> IR 1575)
  return trainId.replace(/^([a-zA-Z-]+)(\d+)$/, '$1 $2');
}
// Module-level cache to prevent redundant API fetches while typing/backspacing
const queryCache: Record<string, any[]> = {};

export default function HomeScreen() {
  const router = useRouter();
  const { dark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [trainNumber, setTrainNumber] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');
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
    const q = trainNumber.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }

    // Use a longer delay for bare numbers since the backend does a live Infofer fetch
    const isPureNumber = /^\d+$/.test(q);
    const delay = isPureNumber ? 700 : 300;

    setSearching(true);
    setShowSuggestions(true);

    const timer = setTimeout(async () => {
      const cacheKey = q.toLowerCase();

      if (queryCache[cacheKey]) {
        setSuggestions(queryCache[cacheKey]);
        setSearchedQuery(q);
        setSearching(false);
        return;
      }

      try {
        const data = await searchTrains(q);
        const results = data.results?.slice(0, 4) ?? [];
        queryCache[cacheKey] = results;
        setSuggestions(results);
        setSearchedQuery(q);
      } catch {
        setSuggestions([]);
        setSearchedQuery(q);
      } finally {
        setSearching(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [trainNumber]);

  const handleSearch = () => {
    const q = trainNumber.trim();
    if (!q) { setError(t('home.placeholder')); return; }
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

  // ── Theming shortcuts (mobile) ────────────────────────────────────────────
  const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
  const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const inputBg = dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900';
  const labelText = dark ? 'text-gray-400' : 'text-gray-500';
  const headingText = dark ? 'text-white' : 'text-gray-900';

  // ── Brand tokens (web only) ─────────────────────────────────────────────
  const BRAND_BLUE = '#0066CC';
  const BRAND_HERO_BG = '#0066CC';
  const BRAND_BG = dark ? '#0D1117' : '#F5F6F8';
  const BRAND_CARD = dark ? '#111827' : '#FFFFFF';
  const BRAND_BORDER = dark ? '#1F2937' : '#E4E4E4';
  const BRAND_HEAD = dark ? '#F9FAFB' : '#111827';
  const BRAND_SUB = dark ? '#94A3B8' : '#475569';

  // ─────────────────────────────────────────────────────────────────────────
  // WEB RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    const webInputBg = dark
      ? { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }
      : { backgroundColor: '#FFFFFF', borderColor: 'rgba(0,102,204,0.25)', color: '#1E293B' };

    return (
      <ScrollView style={{ flex: 1, backgroundColor: BRAND_BG }}>

        {/* ── Hero band ────────────────────────────────────────── */}
        <View style={{
          backgroundColor: BRAND_HERO_BG,
          paddingVertical: 48,
          paddingHorizontal: 40,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0,0,0,0.06)',
        }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 4, letterSpacing: -0.5 }}>
            {t('home.searchTrain')}
          </Text>
          <Text style={{ fontSize: 14, color: '#BFDBFE', marginBottom: 24, opacity: 0.9 }}>
            Infofer · CFR Călători · date în timp real
          </Text>

          {/* Search row */}
          <View style={{ flexDirection: 'row', gap: 12, maxWidth: 560 }}>
            <TextInput
              style={[{
                flex: 1,
                height: 52,
                borderWidth: 1.5,
                borderRadius: 6,
                paddingHorizontal: 16,
                fontSize: 16,
                fontWeight: '600',
              }, webInputBg] as any}
              placeholder={t('home.placeholder')}
              placeholderTextColor={dark ? '#4B5563' : '#94A3B8'}
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
              onPress={handleSearch}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#004C99',
                borderRadius: 6,
                paddingHorizontal: 24,
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <Ionicons name="search" size={18} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                {t('home.searchTrain')}
              </Text>
            </TouchableOpacity>
          </View>
          {error ? (
            <Text style={{ color: '#FECACA', marginTop: 8, fontSize: 13, fontWeight: '600' }}>{error}</Text>
          ) : null}

          {/* Autocomplete suggestions */}
          {showSuggestions && (searching || suggestions.length > 0 || searchedQuery === trainNumber.trim()) && (
            <View style={{
              marginTop: 4,
              maxWidth: 560,
              backgroundColor: BRAND_CARD,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: BRAND_BORDER,
              overflow: 'hidden',
              ...({ boxShadow: '0 4px 20px rgba(0,48,130,0.12)' } as any),
            }}>
              {/* Loading state */}
              {searching && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator size="small" color="#0066CC" />
                  <Text style={{ fontSize: 13, color: BRAND_SUB }}>Căutare tren...</Text>
                </View>
              )}

              {/* No results state */}
              {!searching && suggestions.length === 0 && searchedQuery === trainNumber.trim() && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="alert-circle-outline" size={16} color="#94A3B8" />
                  <Text style={{ fontSize: 13, color: BRAND_SUB }}>Niciun tren găsit pentru "{trainNumber.trim()}"</Text>
                </View>
              )}

              {/* Results */}
              {!searching && suggestions.map((train, i) => (
                <TouchableOpacity
                  key={`${train.train_number}-${i}`}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                    borderBottomColor: BRAND_BORDER,
                  }}
                  onPress={() => handleSuggestionTap(train)}
                  activeOpacity={0.6}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: categoryColor(train.train_number), marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND_HEAD }}>{formatTrainId(train.train_number)}</Text>
                    {train.route ? <Text style={{ fontSize: 12, marginTop: 2, color: BRAND_SUB }}>{train.route}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={dark ? '#4B5563' : '#CBD5E1'} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Content area ────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 40, paddingVertical: 32 }}>

          {/* Recent searches */}
          {recents.length > 0 && (
            <View style={{ marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: BRAND_SUB }}>
                  {t('home.recentSearches')}
                </Text>
                <TouchableOpacity onPress={handleClearRecents} activeOpacity={0.7}>
                  <Text style={{ color: BRAND_BLUE, fontSize: 12, fontWeight: '600' }}>{t('home.clearAll')}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: BRAND_CARD, borderRadius: 6, borderWidth: 1, borderColor: BRAND_BORDER, overflow: 'hidden', ...({ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' } as any) }}>
                {recents.map((rec, i) => (
                  <TouchableOpacity
                    key={`${rec.trainNumber}-${i}`}
                    style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: i < recents.length - 1 ? 1 : 0, borderBottomColor: BRAND_BORDER }}
                    onPress={() => handleRecentTap(rec)}
                    activeOpacity={0.6}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: categoryColor(rec.trainNumber) + '18' }}>
                      <Ionicons name="time-outline" size={15} color={categoryColor(rec.trainNumber)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND_HEAD }}>{formatTrainId(rec.trainNumber)}</Text>
                      {rec.routeLabel ? <Text style={{ fontSize: 12, color: BRAND_SUB, marginTop: 2 }} numberOfLines={1}>{rec.routeLabel}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={dark ? '#374151' : '#CBD5E1'} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Favorites row: trains + stations side by side */}
          {(favTrains.length > 0 || favStations.length > 0) && (
            <View style={{ flexDirection: 'row', gap: 24, marginBottom: 32 }}>
              {favTrains.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: BRAND_SUB, marginBottom: 12 }}>{t('home.favorites')}</Text>
                  <View style={{ backgroundColor: BRAND_CARD, borderRadius: 6, borderWidth: 1, borderColor: BRAND_BORDER, overflow: 'hidden', ...({ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' } as any) }}>
                    {favTrains.map((fav, i) => (
                      <TouchableOpacity
                        key={`${fav.id}-${i}`}
                        style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: i < favTrains.length - 1 ? 1 : 0, borderBottomColor: BRAND_BORDER }}
                        onPress={() => router.push(`/train/${encodeURIComponent(fav.id)}`)}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="star" size={15} color="#F59E0B" style={{ marginRight: 14 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND_HEAD }}>{formatTrainId(fav.id)}</Text>
                          {fav.label ? <Text style={{ fontSize: 12, color: BRAND_SUB, marginTop: 2 }} numberOfLines={1}>{fav.label}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={dark ? '#374151' : '#CBD5E1'} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {favStations.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: BRAND_SUB, marginBottom: 12 }}>{t('myTrains.stations')}</Text>
                  <View style={{ backgroundColor: BRAND_CARD, borderRadius: 6, borderWidth: 1, borderColor: BRAND_BORDER, overflow: 'hidden', ...({ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' } as any) }}>
                    {favStations.map((st, i) => (
                      <TouchableOpacity
                        key={`${st.id}-${i}`}
                        style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: i < favStations.length - 1 ? 1 : 0, borderBottomColor: BRAND_BORDER }}
                        onPress={() => router.push(`/station/${encodeURIComponent(st.id)}?name=${encodeURIComponent(st.label)}`)}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="train" size={15} color={BRAND_BLUE} style={{ marginRight: 14 }} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND_HEAD, flex: 1 }}>{st.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color={dark ? '#374151' : '#CBD5E1'} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Info cards — 3-column grid */}
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: BRAND_SUB, marginBottom: 12 }}>
            {t('home.infoCard1Title') && 'Informații'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {[
              { icon: 'train' as const, titleKey: 'home.infoCard1Title', bodyKey: 'home.infoCard1Body', accent: BRAND_BLUE },
              { icon: 'location' as const, titleKey: 'home.infoCard2Title', bodyKey: 'home.infoCard2Body', accent: '#0066CC' },
              { icon: 'time' as const, titleKey: 'home.infoCard3Title', bodyKey: 'home.infoCard3Body', accent: '#5C3DAA' },
            ].map(({ icon, titleKey, bodyKey, accent }) => (
              <View
                key={titleKey}
                style={{
                  flex: 1,
                  backgroundColor: BRAND_CARD,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: BRAND_BORDER,
                  padding: 20,
                  ...({ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' } as any),
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: accent + '14', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name={icon} size={22} color={accent} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND_HEAD, marginBottom: 6 }}>{t(titleKey)}</Text>
                <Text style={{ fontSize: 13, lineHeight: 20, color: BRAND_SUB }}>{t(bodyKey)}</Text>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* White status bar icons on the blue hero */}
      <StatusBar barStyle="light-content" backgroundColor="#0066CC" translucent />
      <ScrollView
        className={`flex-1 ${bg}`}
        contentInsetAdjustmentBehavior="never"
      >
        <View className="pb-8">

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <View className="bg-primary px-6 pb-14" style={{ paddingTop: Math.max(insets.top + 16, 32) }}>
            <Text className="text-white text-3xl font-bold mb-1">{t('home.searchTrain')}</Text>
            <Text className="text-blue-100 text-sm">CFR Train Tracker</Text>
          </View>

          {/* ── Search card ──────────────────────────────────────────────── */}
          <View className="px-4 -mt-8">
            <View className={`border rounded-2xl overflow-hidden shadow-sm ${card}`}>
              <View className="p-4">
                <Text className={`font-bold mb-3 text-xs tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('home.searchTrain')}
                </Text>
                <View className="flex-row gap-3">
                  <TextInput
                    className={`flex-1 border rounded-xl px-4 ${inputBg}`}
                    style={{
                      height: 48,
                      paddingVertical: 0,
                      textAlignVertical: 'center',
                      fontSize: 16,
                      paddingTop: Platform.OS === 'ios' ? 0 : undefined,
                      paddingBottom: Platform.OS === 'ios' ? 0 : undefined,
                      includeFontPadding: false,
                    } as any}
                    placeholder={t('home.placeholder')}
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
              {showSuggestions && (searching || suggestions.length > 0 || searchedQuery === trainNumber.trim()) && (
                <View className={`border-t ${dark ? 'border-gray-800' : 'border-gray-100'}`}>

                  {/* Loading */}
                  {searching && (
                    <View className={`px-4 py-3 flex-row items-center gap-3`}>
                      <ActivityIndicator size="small" color="#0066CC" />
                      <Text className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Căutare tren...</Text>
                    </View>
                  )}

                  {/* No results */}
                  {!searching && suggestions.length === 0 && searchedQuery === trainNumber.trim() && (
                    <View className={`px-4 py-3 flex-row items-center gap-3`}>
                      <Ionicons name="alert-circle-outline" size={16} color={dark ? '#6B7280' : '#9CA3AF'} />
                      <Text className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Niciun tren găsit pentru "{trainNumber.trim()}"</Text>
                    </View>
                  )}

                  {/* Results */}
                  {!searching && suggestions.map((train, i) => (
                    <TouchableOpacity
                      key={`${train.train_number}-${i}`}
                      className={`px-4 py-3 flex-row items-center border-b ${dark ? 'border-gray-800 active:bg-gray-800' : 'border-gray-50 active:bg-gray-50'}`}
                      onPress={() => handleSuggestionTap(train)}
                      activeOpacity={0.6}
                    >
                      <View style={{ backgroundColor: categoryColor(train.train_number) }} className="w-2 h-2 rounded-full mr-3" />
                      <View className="flex-1">
                        <Text className={`text-sm font-bold ${headingText}`}>{formatTrainId(train.train_number)}</Text>
                        {train.route ? <Text className={`text-xs mt-0.5 ${labelText}`}>{train.route}</Text> : null}
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
                  {t('home.recentSearches')}
                </Text>
                <TouchableOpacity onPress={handleClearRecents} activeOpacity={0.7}>
                  <Text className="text-primary text-xs font-semibold">{t('home.clearAll')}</Text>
                </TouchableOpacity>
              </View>
              <View className={`border rounded-2xl overflow-hidden ${card}`}>
                {recents.map((rec, i) => (
                  <TouchableOpacity
                    key={`${rec.trainNumber}-${i}`}
                    className={`px-4 py-3 flex-row items-center ${i < recents.length - 1 ? `border-b ${dark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                    onPress={() => handleRecentTap(rec)}
                    activeOpacity={0.6}
                  >
                    <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: categoryColor(rec.trainNumber) + '22' }}>
                      <Ionicons name="time-outline" size={15} color={categoryColor(rec.trainNumber)} />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm font-bold ${headingText}`}>{formatTrainId(rec.trainNumber)}</Text>
                      {rec.routeLabel ? <Text className={`text-xs mt-0.5 ${labelText}`} numberOfLines={1}>{rec.routeLabel}</Text> : null}
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
                <Text className={`text-xs font-bold tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{t('home.favorites')}</Text>
              </View>
              <View className={`border rounded-2xl overflow-hidden ${card}`}>
                {favTrains.map((fav, i) => (
                  <TouchableOpacity
                    key={`${fav.id}-${i}`}
                    className={`px-4 py-3 flex-row items-center ${i < favTrains.length - 1 ? `border-b ${dark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                    onPress={() => router.push(`/train/${encodeURIComponent(fav.id)}`)}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="star" size={16} color="#F59E0B" className="mr-3" />
                    <View className="flex-1 ml-3">
                      <Text className={`text-sm font-bold ${headingText}`}>{formatTrainId(fav.id)}</Text>
                      {fav.label ? <Text className={`text-xs mt-0.5 ${labelText}`} numberOfLines={1}>{fav.label}</Text> : null}
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
                <Text className={`text-xs font-bold tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{t('myTrains.stations')}</Text>
              </View>
              <View className={`border rounded-2xl overflow-hidden ${card}`}>
                {favStations.map((st, i) => (
                  <TouchableOpacity
                    key={`${st.id}-${i}`}
                    className={`px-4 py-3 flex-row items-center ${i < favStations.length - 1 ? `border-b ${dark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                    onPress={() => router.push(`/station/${encodeURIComponent(st.id)}?name=${encodeURIComponent(st.label)}`)}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="train" size={16} color="#0066CC" className="mr-3" />
                    <View className="flex-1 ml-3">
                      <Text className={`text-sm font-bold ${headingText}`}>{st.label}</Text>
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
              { icon: 'train' as const, titleKey: 'home.infoCard1Title', bodyKey: 'home.infoCard1Body' },
              { icon: 'location' as const, titleKey: 'home.infoCard2Title', bodyKey: 'home.infoCard2Body' },
              { icon: 'time' as const, titleKey: 'home.infoCard3Title', bodyKey: 'home.infoCard3Body' },
            ].map(({ icon, titleKey, bodyKey }) => (
              <View key={titleKey} className={`border rounded-2xl p-4 ${card}`}>
                <Ionicons name={icon} size={26} color="#0066CC" style={{ marginBottom: 6 }} />
                <Text className={`text-sm font-bold mb-1 ${headingText}`}>{t(titleKey)}</Text>
                <Text className={`text-xs leading-5 ${labelText}`}>{t(bodyKey)}</Text>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    </>
  );
}
