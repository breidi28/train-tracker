import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, FlatList, Share
} from 'react-native';
import { useLocalSearchParams, Stack, Link } from 'expo-router';
import { fetchStationDepartures, fetchStationArrivals } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getFavoriteStations, toggleFavoriteStation } from '../../src/storage';


interface TimetableItem {
  train_id?: string;
  train_number?: string;
  rank?: string;
  origin?: string;
  destination?: string;
  arrival_time?: string;
  departure_time?: string;
  delay?: number;
  platform?: string;
  operator?: string;
  mentions?: string;
  data_source?: string;
}

type Tab = 'departures' | 'arrivals';

function formatDelay(min: number | null | undefined): string {
  if (!min || min === 0) return '';
  return min > 0 ? `+${min} min` : `${min} min`;
}

function delayColor(min: number | null | undefined, dark: boolean) {
  if (!min || min === 0) return dark ? '#4ADE80' : '#16A34A';
  if (min <= 5) return '#D97706';
  return '#EF4444';
}

const RANK_COLORS: Record<string, string> = {
  IC: '#DC2626', IR: '#2563EB', R: '#16A34A',
  'R-E': '#7C3AED', RE: '#7C3AED', IRN: '#1E40AF',
};
function rankBadge(rank?: string): string {
  return RANK_COLORS[rank?.toUpperCase() ?? ''] ?? '#4B5563';
}

function isTimePast(timeStr: string | undefined): boolean {
  if (!timeStr) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes < currentMinutes;
}

export default function StationDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { dark } = useTheme();
  const { t } = useTranslation();

  const [tab, setTab] = useState<Tab>('departures');
  const [showRetro, setShowRetro] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [departures, setDepartures] = useState<TimetableItem[]>([]);
  const [arrivals, setArrivals] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const stationId = Number(id);

  const load = async () => {
    try {
      setError('');
      const [deps, arrs] = await Promise.all([
        fetchStationDepartures(stationId),
        fetchStationArrivals(stationId),
      ]);
      setDepartures(deps);
      setArrivals(arrs);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? 'Eroare la încărcare');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    getFavoriteStations().then(favs => {
      setIsFavorite(!!favs.find(f => f.id === String(stationId)));
    });
  }, [id]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleToggleFavorite = async () => {
    const isNowFav = await toggleFavoriteStation({
      id: String(stationId),
      label: name ?? `Stația ${id}`,
    });
    setIsFavorite(isNowFav);
  };

  const handleShare = async () => {
    try {
      const msg = `Vezi orarul LIVE pentru Stația ${name ?? id} pe Train Tracker!\nhttps://cfr.ro/station/${encodeURIComponent(String(id))}`;
      await Share.share({ message: msg });
    } catch { }
  };

  const data = tab === 'departures' ? departures : arrivals;
  const hasLiveData = data.some(item => item.data_source === 'iris_live');

  // Find the index of the first upcoming train
  const upcomingIndex = data.findIndex(item => {
    const time = tab === 'departures' ? item.departure_time : item.arrival_time;
    return !isTimePast(time);
  });
  const targetIndex = upcomingIndex === -1 ? Math.max(0, data.length - 1) : Math.max(0, upcomingIndex - 1);

  // Auto scroll when data loads or tab changes
  useEffect(() => {
    if (data.length > 0 && !showRetro && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
      }, 500); // 500ms safety buffer
    }
  }, [data, tab, showRetro]);

  // ── Theme shortcuts ──────────────────────────────────────────────────────
  const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
  const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100';
  const headTxt = dark ? 'text-white' : 'text-gray-900';
  const subTxt = dark ? 'text-gray-400' : 'text-gray-500';
  const divider = dark ? 'border-gray-800' : 'border-gray-100';
  const rowBg = dark ? 'bg-gray-900' : 'bg-white';
  const tabBar = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const modBar = dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200';

  if (loading) {
    return (
      <View className={`flex-1 justify-center items-center ${bg}`}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className={`mt-3 text-sm ${subTxt}`}>{t('common.loading')}</Text>
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
          onPress={load}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold">{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: name ?? `Stația ${id}`,
          headerRight: () => (
            <View className="flex-row items-center gap-4 pr-1">
              <TouchableOpacity onPress={handleToggleFavorite} activeOpacity={0.7}>
                <Ionicons name={isFavorite ? "star" : "star-outline"} size={22} color={isFavorite ? '#F59E0B' : '#0066CC'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} activeOpacity={0.7}>
                <Ionicons name="share-outline" size={22} color="#0066CC" />
              </TouchableOpacity>
            </View>
          )
        }}
      />
      <View className={`flex-1 ${bg}`}>

        {/* ── Tab switcher ─────────────────────────────────────────────── */}
        <View className={`flex-row mx-4 mt-3 border-b ${tabBar} rounded-t-xl`}>
          {(['departures', 'arrivals'] as Tab[]).map(tabKey => {
            const active = tab === tabKey;
            return (
              <TouchableOpacity
                key={tabKey}
                activeOpacity={1}
                className={`flex-1 py-3 items-center flex-row justify-center ${active ? `border-b-2 border-primary` : ''
                  }`}
                onPress={() => setTab(tabKey)}
              >
                <Ionicons
                  name={tabKey === 'departures' ? 'arrow-up-circle' : 'arrow-down-circle'}
                  size={18}
                  color={active ? '#0066CC' : dark ? '#6B7280' : '#9CA3AF'}
                />
                <Text
                  className={`font-semibold text-sm ml-2 ${active ? 'text-primary' : subTxt
                    }`}
                >
                  {tabKey === 'departures' ? `${t('station.departures')} (${departures.length})` : `${t('station.arrivals')} (${arrivals.length})`}
                </Text>
                {active && hasLiveData && (
                  <View className="ml-2 bg-red-500 w-2 h-2 rounded-full" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Mode bar (retro toggle) ───────────────────────────────── */}
        <View className={`flex-row justify-between items-center px-4 py-2 border-b ${modBar}`}>
          <Text className={`text-xs font-bold tracking-widest uppercase ${subTxt}`}>
            {tab === 'departures' ? t('station.departureTable') : t('station.arrivalTable')}
          </Text>
          <TouchableOpacity
            onPress={() => setShowRetro(!showRetro)}
            activeOpacity={0.7}
            className={`px-3 py-1 rounded-lg border flex-row gap-1.5 items-center ${showRetro
              ? 'bg-amber-100 border-amber-300'
              : dark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
              }`}
          >
            <Ionicons name="apps" size={12} color={showRetro ? '#D97706' : dark ? '#9CA3AF' : '#6B7280'} />
            <Text
              className={`text-[10px] font-black uppercase ${showRetro ? 'text-amber-700' : subTxt
                }`}
            >
              Tabel Mecanic
            </Text>
          </TouchableOpacity>
        </View>

        {!showRetro ? (
          <FlatList
            ref={flatListRef}
            data={data}
            className="flex-1"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />
            }
            contentContainerStyle={{ paddingBottom: 32 }}
            keyExtractor={(item, index) => `${item.train_id ?? item.train_number ?? '—'}-${index}`}
            getItemLayout={(data, index) => ({
              length: 85, // estimated item height
              offset: 85 * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
              });
            }}
            ListEmptyComponent={
              <View className="items-center mt-20">
                <Ionicons
                  name={tab === 'departures' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  size={64}
                  color={dark ? '#374151' : '#D1D5DB'}
                />
                <Text className={`text-sm mt-4 ${subTxt}`}>
                  {tab === 'departures' ? t('station.noDepartures') : t('station.noArrivals')}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const trainLabel = item.train_id ?? item.train_number ?? '—';
              const rank = item.rank ?? trainLabel.split(/[\s\d]/)[0] ?? '';
              const time = tab === 'departures' ? item.departure_time : item.arrival_time;
              const delay = item.delay ?? 0;
              const isPast = isTimePast(time);

              return (
                <View>
                  <Link
                    href={{ pathname: '/train/[id]', params: { id: trainLabel.replace(/\s/g, '') } }}
                    asChild
                  >
                    <TouchableOpacity
                      className={`border-b px-4 py-4 ${rowBg} ${divider}`}
                      activeOpacity={0.6}
                      style={{ opacity: isPast ? 0.45 : 1 }}
                    >
                      <View className="flex-row items-center">
                        <View className="rounded px-2.5 py-1 mr-3" style={{ backgroundColor: rankBadge(rank) }}>
                          <Text className="text-white font-bold text-xs">{rank || '?'}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className={`text-base font-semibold ${headTxt}`}>{trainLabel}</Text>
                          <Text className={`text-xs mt-0.5 ${subTxt}`} numberOfLines={1}>
                            {tab === 'departures' ? `${t('station.to')} ${item.destination ?? '—'}` : `${t('station.from')} ${item.origin ?? '—'}`}
                          </Text>
                        </View>
                        <View className="items-end ml-2">
                          <Text className={`text-lg font-semibold ${headTxt}`}>{time || '—'}</Text>
                          {delay !== 0 ? (
                            <View className="flex-row items-center gap-1">
                              <Text className="text-xs font-bold" style={{ color: delayColor(delay, dark) }}>{formatDelay(delay)}</Text>
                              {item.data_source === 'iris_live' && delay > 0 && (
                                <View className="bg-red-500 rounded-full px-1.5 py-0.5"><Text className="text-white text-[9px] font-bold">LIVE</Text></View>
                              )}
                            </View>
                          ) : (
                            <View className="flex-row items-center gap-1">
                              <Text className="text-xs" style={{ color: delayColor(0, dark) }}>La timp</Text>
                              {item.data_source === 'iris_live' && (
                                <View className="bg-green-500 rounded-full px-1.5 py-0.5"><Text className="text-white text-[9px] font-bold">LIVE</Text></View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                      {(item.platform || item.operator || item.mentions) && (
                        <View className="flex-row mt-2.5 items-center">
                          {item.platform && (
                            <View className="rounded px-2 py-0.5 mr-2" style={{ backgroundColor: dark ? '#1F2937' : '#F3F4F6' }}>
                              <Text className={`text-xs font-medium ${subTxt}`}>Linia {item.platform}</Text>
                            </View>
                          )}
                          {item.operator && <Text className={`text-xs ${subTxt}`}>{item.operator}</Text>}
                          {item.mentions && <Text className="text-xs text-yellow-500 ml-auto italic" numberOfLines={1}>{item.mentions}</Text>}
                        </View>
                      )}
                    </TouchableOpacity>
                  </Link>
                </View>
              );
            }}
          />
        ) : (
          <ScrollView
            className="flex-1"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />}
          >
            {data.length === 0 ? (
              <View className="items-center mt-20">
                <Ionicons name={tab === 'departures' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'} size={64} color={dark ? '#374151' : '#D1D5DB'} />
                <Text className={`text-sm mt-4 ${subTxt}`}>{tab === 'departures' ? t('station.noDepartures') : t('station.noArrivals')}</Text>
              </View>
            ) : (
              <View className="mx-4 mt-3 rounded-xl overflow-hidden" style={{ backgroundColor: '#0A0A0A', borderWidth: 3, borderColor: '#27272A' }}>
                <View className="flex-row px-3 pt-3 pb-2 border-b border-gray-800">
                  <Text style={styles.retroHeader} className="w-14 flex-shrink-0">TREN</Text>
                  <Text style={styles.retroHeader} className="flex-1">RUTA</Text>
                  <Text style={styles.retroHeader} className="w-12 text-right">ORA</Text>
                  <Text style={styles.retroHeader} className="w-14 text-right">ÎNT.</Text>
                  <Text style={styles.retroHeader} className="w-8 text-right ml-1">LINIA</Text>
                </View>
                {data.filter(d => !isTimePast(tab === 'departures' ? d.departure_time : d.arrival_time)).slice(0, 18).map((item, i) => {
                  const trainLabel = item.train_id ?? item.train_number ?? '—';
                  const time = tab === 'departures' ? item.departure_time : item.arrival_time;
                  const dest = tab === 'departures' ? item.destination : item.origin;
                  const delay = item.delay ?? 0;
                  return (
                    <View key={i} className="flex-row px-3 py-2 items-center" style={{ borderBottomWidth: 1, borderBottomColor: '#1C1C1E' }}>
                      <Text style={[styles.retroCell, { color: '#FCD34D' }]} className="w-14 flex-shrink-0" numberOfLines={1}>{trainLabel.replace(' ', '')}</Text>
                      <Text style={[styles.retroCell, { color: '#FCD34D' }]} className="flex-1" numberOfLines={1}>{dest?.toUpperCase() ?? 'NECUNOSCUT'}</Text>
                      <Text style={[styles.retroCell, { color: '#FCD34D' }]} className="w-12 text-right">{time}</Text>
                      <Text style={[styles.retroCell, { color: delay > 0 ? '#EF4444' : '#4ADE80' }]} className="w-14 text-right">{delay > 0 ? `+${delay}` : 'LA TMP'}</Text>
                      <Text style={[styles.retroCell, { color: '#FCD34D' }]} className="w-8 text-right ml-1">{item.platform ?? '-'}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}

        {/* Floating "Jump to Now" button */}
        {!showRetro && data.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true })}
            className="absolute bottom-6 right-6 bg-primary w-14 h-14 rounded-full justify-center items-center shadow-lg shadow-blue-900/40"
            style={{ elevation: 5 }}
          >
            <Ionicons name="time" size={26} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = {
  retroHeader: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#78716C',
    letterSpacing: 1,
  },
  retroCell: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
};
