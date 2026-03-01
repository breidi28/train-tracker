import { useEffect, useState, useRef, memo } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, FlatList, Share, Platform
} from 'react-native';
import WebDetailWrapper from '../../src/WebDetailWrapper';
import { useLocalSearchParams, Stack, Link, useRouter } from 'expo-router';
import { fetchStationTimetable } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getFavoriteStations, toggleFavoriteStation } from '../../src/storage';
import { categoryColor } from '../../src/trainColors';


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
  arrival_timestamp?: string;
  departure_timestamp?: string;
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
  IC: '#15803D', ICN: '#166534',
  IR: '#B91C1C', IRN: '#991B1B',
  R: '#1D4ED8', 'R-E': '#4338CA', RE: '#4338CA',
};
function rankBadge(rank?: string): string {
  return RANK_COLORS[rank?.toUpperCase() ?? ''] ?? '#4B5563';
}

function formatTrainId(trainId: string | undefined): string {
  if (!trainId) return '—';
  // If it already has a space, return as is
  if (trainId.includes(' ')) return trainId;
  // Otherwise, insert space between rank and numbers (e.g. IR1575 -> IR 1575)
  return trainId.replace(/^([a-zA-Z-]+)(\d+)$/, '$1 $2');
}

function isTimePast(timestamp: string | undefined): boolean {
  if (!timestamp) return false;
  const now = new Date();
  const trainTime = new Date(timestamp);
  return trainTime < now;
}

const TrainCard = memo(({ item, tab, dark, headTxt, subTxt, t, isCurrent, onPress }: {
  item: TimetableItem;
  tab: Tab;
  dark: boolean;
  headTxt: string;
  subTxt: string;
  t: any;
  isCurrent: boolean;
  onPress: (id: string) => void;
}) => {
  const rawId = item.train_id ?? item.train_number ?? '—';
  const trainLabel = formatTrainId(rawId);
  const rank = item.rank ?? rawId.split(/[\s\d]/)[0] ?? '';
  const time = tab === 'departures' ? item.departure_time : item.arrival_time;
  const ts = tab === 'departures' ? item.departure_timestamp : item.arrival_timestamp;
  const delay = item.delay ?? 0;
  const isPast = isTimePast(ts);

  // Use train_number (which has the space, e.g. "IC 534") for navigation.
  // Falling back to rawId only if train_number isn't separately available.
  const navId = item.train_number ?? rawId;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(navId)}
      className={`mx-4 my-1.5 rounded-2xl border overflow-hidden`}
      style={{
        opacity: isPast ? 0.5 : 1,
        borderColor: isCurrent ? '#0066CC' : (dark ? '#1F2937' : '#F3F4F6'),
        borderWidth: isCurrent ? 1.5 : 1,
        backgroundColor: isCurrent ? (dark ? '#0F172A' : '#F0F7FF') : (dark ? '#111827' : '#FFFFFF'),
        minHeight: 100
      }}
    >
      {isCurrent && (
        <View className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r" />
      )}

      {/* Departed badge */}
      {isPast && (
        <View style={{
          position: 'absolute', top: 8, right: 8,
          backgroundColor: dark ? '#374151' : '#F3F4F6',
          borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
        }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: dark ? '#9CA3AF' : '#6B7280', letterSpacing: 0.5 }}>
            PLECAT
          </Text>
        </View>
      )}

      <View className="px-4 py-4">
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
                <Text className="text-xs" style={{ color: delayColor(0, dark) }}>{t('station.onTime')}</Text>
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
                <Text className={`text-xs font-medium ${subTxt}`}>{t('station.platformLabel', { platform: item.platform })}</Text>
              </View>
            )}
            {item.operator && <Text className={`text-xs ${subTxt}`}>{item.operator}</Text>}
            {item.mentions && <Text className="text-xs text-yellow-500 ml-auto italic" numberOfLines={1}>{item.mentions}</Text>}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function StationDetailScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { dark } = useTheme();
  const { t, i18n } = useTranslation();

  const [tab, setTab] = useState<Tab>('departures');
  const [showRetro, setShowRetro] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [departures, setDepartures] = useState<TimetableItem[]>([]);
  const [arrivals, setArrivals] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDateExpanded, setIsDateExpanded] = useState(false);

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const formatDateForApi = (date: Date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  };

  const flatListRef = useRef<FlatList>(null);

  const stationName = name ?? id;

  const load = async () => {
    try {
      const apiDate = formatDateForApi(selectedDate);
      setError('');
      const data = await fetchStationTimetable(stationName, apiDate);

      const deps = data.filter((item: any) => item.is_origin || (item.is_stop && item.departure_time));
      const arrs = data.filter((item: any) => item.is_destination || (item.is_stop && item.arrival_time));

      setDepartures(deps);
      setArrivals(arrs);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? t('station.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    getFavoriteStations().then(favs => {
      setIsFavorite(!!favs.find(f => f.id === id));
    });
  }, [id, selectedDate]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleToggleFavorite = async () => {
    const isNowFav = await toggleFavoriteStation({ id, label: name ?? t('station.stationTitle', { id }) });
    setIsFavorite(isNowFav);
  };

  const handleShare = async () => {
    try {
      const msg = `${t('station.shareMsg', { name: name ?? id, id: encodeURIComponent(String(id)) })}`;
      await Share.share({ message: msg });
    } catch { }
  };

  const data = tab === 'departures' ? departures : arrivals;
  const hasLiveData = data.some(item => item.data_source === 'iris_live');

  // Find the index of the first upcoming train
  const upcomingIndex = data.findIndex(item => {
    const ts = tab === 'departures' ? item.departure_timestamp : item.arrival_timestamp;
    return !isTimePast(ts);
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
    <WebDetailWrapper>
      <Stack.Screen
        options={{
          title: name ?? t('station.stationTitle', { id }),
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
      {/* Web-only back button + page title bar */}
      {Platform.OS === 'web' && (
        <View style={{ backgroundColor: '#0066CC', paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17, flex: 1 }} numberOfLines={1}>
            {name ?? t('station.stationTitle', { id })}
          </Text>
          <TouchableOpacity onPress={handleToggleFavorite} activeOpacity={0.7} style={{ marginLeft: 12 }}>
            <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={20} color={isFavorite ? '#F59E0B' : '#fff'} />
          </TouchableOpacity>
        </View>
      )}
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

        {/* ── Date Selector ───────────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setIsDateExpanded(!isDateExpanded)}
          className={`mx-4 mt-2 px-4 py-3 rounded-xl flex-row items-center border ${dark ? 'bg-[#111827] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
        >
          <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${dark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
            <Ionicons name="calendar-outline" size={18} color="#0066CC" />
          </View>
          <View className="flex-1">
            <Text className={`text-xs ${subTxt}`}>{t('station.selectDate')}</Text>
            <Text className={`text-sm font-bold ${headTxt}`}>
              {selectedDate.toDateString() === new Date().toDateString() ? t('common.today') : selectedDate.toDateString() === new Date(new Date().setDate(new Date().getDate() + 1)).toDateString() ? t('common.tomorrow') : selectedDate.toLocaleDateString(i18n.language || 'ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <Ionicons name={isDateExpanded ? "chevron-up" : "chevron-down"} size={20} color={dark ? '#4B5563' : '#9CA3AF'} />
        </TouchableOpacity>

        {isDateExpanded && (
          <View className="mb-1 mt-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2 px-2">
              {dateOptions.map((date, idx) => {
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const dayName = date.toLocaleDateString(i18n.language || 'ro-RO', { weekday: 'short' });
                const dayNum = date.getDate();
                const monthName = date.toLocaleDateString(i18n.language || 'ro-RO', { month: 'short' });

                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setSelectedDate(date);
                      setIsDateExpanded(false);
                    }}
                    activeOpacity={0.7}
                    className={`mx-1.5 px-3 py-2 rounded-2xl items-center border min-w-[70px] ${isSelected
                      ? 'bg-primary border-primary shadow-blue-500/20 shadow-md'
                      : dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
                      }`}
                  >
                    <Text className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                      {idx === 0 ? t('common.today') : idx === 1 ? t('common.tomorrow') : dayName}
                    </Text>
                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : headTxt}`}>
                      {dayNum} {monthName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Mode bar (retro toggle) ───────────────────────────────── */}
        <View className={`flex-row justify-between items-center px-4 py-2 mt-4 border-b ${modBar}`}>
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
              {t('station.retroMode')}
            </Text>
          </TouchableOpacity>
        </View>

        {!showRetro ? (
          <FlatList
            ref={flatListRef}
            data={data}
            className="flex-1"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
            keyExtractor={(item, index) => `${item.train_id ?? item.train_number ?? '—'}-${index}`}
            getItemLayout={(data, index) => ({
              length: 110, // estimated item height
              offset: 110 * index,
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
            renderItem={({ item, index }) => (
              <TrainCard
                item={item}
                tab={tab}
                dark={dark}
                headTxt={headTxt}
                subTxt={subTxt}
                t={t}
                isCurrent={index === upcomingIndex}
                onPress={(trainId) => router.push({ pathname: '/train/[id]', params: { id: trainId } })}
              />
            )}
          />
        ) : (
          <ScrollView
            className="flex-1"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />}
          >
            <View style={{ height: 8 }} />
            {data.length === 0 ? (
              <View className="items-center mt-20">
                <Ionicons name={tab === 'departures' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'} size={64} color={dark ? '#374151' : '#D1D5DB'} />
                <Text className={`text-sm mt-4 ${subTxt}`}>{tab === 'departures' ? t('station.noDepartures') : t('station.noArrivals')}</Text>
              </View>
            ) : (
              <View className="mx-4 mt-3 rounded-xl overflow-hidden" style={{ backgroundColor: '#0A0A0A', borderWidth: 3, borderColor: '#27272A' }}>
                <View className="flex-row px-3 pt-3 pb-2 border-b border-gray-800">
                  <Text style={styles.retroHeader} className="w-14 flex-shrink-0">{t('station.retroTrain')}</Text>
                  <Text style={styles.retroHeader} className="flex-1">{t('station.retroRoute')}</Text>
                  <Text style={styles.retroHeader} className="w-12 text-right">{t('station.retroTime')}</Text>
                  <Text style={styles.retroHeader} className="w-14 text-right">{t('station.retroDelay')}</Text>
                  <Text style={styles.retroHeader} className="w-8 text-right ml-1">{t('station.retroPlatform')}</Text>
                </View>
                {data.filter(d => !isTimePast(tab === 'departures' ? d.departure_timestamp : d.arrival_timestamp)).slice(0, 18).map((item, i) => {
                  const trainLabel = item.train_id ?? item.train_number ?? '—';
                  const time = tab === 'departures' ? item.departure_time : item.arrival_time;
                  const dest = tab === 'departures' ? item.destination : item.origin;
                  const delay = item.delay ?? 0;
                  return (
                    <View key={i} className="flex-row px-3 py-2 items-center" style={{ borderBottomWidth: 1, borderBottomColor: '#1C1C1E' }}>
                      <Text style={[styles.retroCell, { color: '#FCD34D' }]} className="w-14 flex-shrink-0" numberOfLines={1}>{item.train_number ?? trainLabel}</Text>
                      <Text style={[styles.retroCell, { color: '#FCD34D' }]} className="flex-1" numberOfLines={1}>{dest?.toUpperCase() ?? t('station.unknown')}</Text>
                      <Text style={[styles.retroCell, { color: '#FCD34D' }]} className="w-12 text-right">{time}</Text>
                      <Text style={[styles.retroCell, { color: delay > 0 ? '#EF4444' : '#4ADE80' }]} className="w-14 text-right">{delay > 0 ? `+${delay}` : t('station.onTimShort')}</Text>
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
      </View >
    </WebDetailWrapper>
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
