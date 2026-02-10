import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack, Link } from 'expo-router';
import { fetchStationDepartures, fetchStationArrivals } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';

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
  data_source?: string;  // 'iris_live' or 'government_xml'
}

type Tab = 'departures' | 'arrivals';

function formatDelay(min: number | null | undefined): string {
  if (!min || min === 0) return '';
  return min > 0 ? `+${min} min` : `${min} min`;
}

function delayClass(min: number | null | undefined): string {
  if (!min || min === 0) return 'text-green-600';
  if (min <= 5) return 'text-yellow-600';
  return 'text-red-600';
}

const RANK_COLORS: Record<string, string> = {
  IC: 'bg-red-600', IR: 'bg-blue-600', R: 'bg-green-600',
  'R-E': 'bg-purple-600', RE: 'bg-purple-600',
  IRN: 'bg-blue-800',
};
function rankBadge(rank?: string): string {
  return RANK_COLORS[rank?.toUpperCase() ?? ''] ?? 'bg-gray-600';
}

// Helper function to compare times
function isTimePast(timeStr: string | undefined): boolean {
  if (!timeStr) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  const itemMinutes = hours * 60 + minutes;
  
  return itemMinutes < currentMinutes;
}

export default function StationDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [tab, setTab] = useState<Tab>('departures');
  const [departures, setDepartures] = useState<TimetableItem[]>([]);
  const [arrivals, setArrivals] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const itemLayouts = useRef<{ [key: number]: number }>({});

  const stationId = Number(id);

  const load = async () => {
    try {
      setError('');
      const [deps, arrs] = await Promise.all([
        fetchStationDepartures(stationId),
        fetchStationArrivals(stationId),
      ]);
      console.log(`[Station ${stationId}] Departures count: ${deps.length}, Arrivals count: ${arrs.length}`);
      setDepartures(deps);
      setArrivals(arrs);
    } catch (e: any) {
      console.error(`[Station ${stationId}] Error loading data:`, e);
      setError(e?.response?.data?.error ?? e.message ?? 'Eroare la încărcare');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [id]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const data = tab === 'departures' ? departures : arrivals;

  // Check if we have live data
  const hasLiveData = data.length > 0 && data.some(item => item.data_source === 'iris_live');

  // Find first upcoming train index
  const upcomingIndex = data.findIndex(item => {
    const time = tab === 'departures' ? item.departure_time : item.arrival_time;
    return !isTimePast(time);
  });

  // Scroll to upcoming trains when layouts are ready
  useEffect(() => {
    if (upcomingIndex <= 0 || !scrollViewRef.current) return;

    // Wait for layouts to be measured
    const scrollTimeout = setTimeout(() => {
      const targetLayout = itemLayouts.current[upcomingIndex - 1];
      if (targetLayout !== undefined) {
        scrollViewRef.current?.scrollTo({ y: targetLayout, animated: true });
      }
    }, 300);

    return () => clearTimeout(scrollTimeout);
  }, [upcomingIndex, tab]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className="text-gray-500 mt-3">Se încarcă orarul…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 px-6">
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text className="text-red-500 text-base mt-3 text-center">{error}</Text>
        <TouchableOpacity className="bg-blue-600 rounded-xl px-6 py-3 mt-4" onPress={load}>
          <Text className="text-white font-bold">Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: name ?? `Stația ${id}` }} />
      <View className="flex-1 bg-gray-50">
        {/* Tab switcher */}
        <View className="flex-row mx-4 mt-3 border-b border-gray-200">
          <TouchableOpacity
            className={`flex-1 py-3 items-center flex-row justify-center ${tab === 'departures' ? 'border-b-2 border-blue-600' : ''}`}
            onPress={() => setTab('departures')}
          >
            <Ionicons name="arrow-up-circle" size={18} color={tab === 'departures' ? '#0066CC' : '#9CA3AF'} />
            <Text className={`font-semibold text-sm ml-2 ${tab === 'departures' ? 'text-blue-600' : 'text-gray-400'}`}>
              PLECĂRI ({departures.length})
            </Text>
            {tab === 'departures' && hasLiveData && (
              <View className="ml-2 bg-red-500 w-2 h-2 rounded-full" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 items-center flex-row justify-center ${tab === 'arrivals' ? 'border-b-2 border-blue-600' : ''}`}
            onPress={() => setTab('arrivals')}
          >
            <Ionicons name="arrow-down-circle" size={18} color={tab === 'arrivals' ? '#0066CC' : '#9CA3AF'} />
            <Text className={`font-semibold text-sm ml-2 ${tab === 'arrivals' ? 'text-blue-600' : 'text-gray-400'}`}>
              SOSIRI ({arrivals.length})
            </Text>
            {tab === 'arrivals' && hasLiveData && (
              <View className="ml-2 bg-red-500 w-2 h-2 rounded-full" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          className="flex-1 mt-3"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />}
        >
          {data.length === 0 ? (
            <View className="items-center mt-20">
              <Ionicons 
                name={tab === 'departures' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'} 
                size={64} 
                color="#D1D5DB" 
              />
              <Text className="text-gray-400 text-sm mt-4">
                Nu sunt {tab === 'departures' ? 'plecări' : 'sosiri'} disponibile
              </Text>
            </View>
          ) : (
            data.map((item, i) => {
              const trainLabel = item.train_id ?? item.train_number ?? '—';
              const rank = item.rank ?? trainLabel.split(/[\s\d]/)[0] ?? '';
              const time = tab === 'departures'
                ? item.departure_time
                : item.arrival_time;
              const delay = item.delay ?? 0;
              const isPast = isTimePast(time);

              return (
                <View
                  key={`${trainLabel}-${i}`}
                  onLayout={(event) => {
                    itemLayouts.current[i] = event.nativeEvent.layout.y;
                  }}
                >
                  <Link
                    href={{ pathname: '/train/[id]', params: { id: trainLabel.replace(/\s/g, '') } }}
                    asChild
                  >
                  <TouchableOpacity
                    className="bg-white border-b border-gray-100 px-4 py-4"
                    activeOpacity={0.6}
                    style={{ opacity: isPast ? 0.5 : 1 }}
                  >
                    <View className="flex-row items-center">
                    {/* Rank badge */}
                    <View className={`${rankBadge(rank)} rounded px-2.5 py-1`}>
                      <Text className="text-white font-bold text-xs">{rank || '?'}</Text>
                    </View>

                    {/* Train number & route */}
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-semibold text-gray-900">{trainLabel}</Text>
                      <Text className="text-xs text-gray-400 mt-1" numberOfLines={1}>
                        {tab === 'departures'
                          ? `→ ${item.destination ?? '—'}`
                          : `← ${item.origin ?? '—'}`}
                      </Text>
                    </View>

                    {/* Time + delay */}
                    <View className="items-end ml-2">
                      <Text className="text-lg font-semibold text-gray-900">{time || '—'}</Text>
                      {delay !== 0 ? (
                        <View className="flex-row items-center">
                          <Text className={`text-xs font-bold ${delayClass(delay)}`}>
                            {formatDelay(delay)}
                          </Text>
                          {item.data_source === 'iris_live' && delay > 0 && (
                            <View className="ml-1 bg-red-500 rounded-full px-1.5 py-0.5">
                              <Text className="text-white text-[9px] font-bold">LIVE</Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View className="flex-row items-center">
                          <Text className="text-xs text-green-600">La timp</Text>
                          {item.data_source === 'iris_live' && (
                            <View className="ml-1 bg-green-500 rounded-full px-1.5 py-0.5">
                              <Text className="text-white text-[9px] font-bold">LIVE</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Bottom row: platform + operator */}
                  <View className="flex-row mt-3 items-center">
                    {item.platform ? (
                      <View className="bg-gray-50 rounded px-2 py-1 mr-2">
                        <Text className="text-xs text-gray-500 font-medium">Linia {item.platform}</Text>
                      </View>
                    ) : null}
                    {item.operator ? (
                      <Text className="text-xs text-gray-400 font-medium">{item.operator}</Text>
                    ) : null}
                    {item.mentions ? (
                      <Text className="text-xs text-yellow-600 ml-auto italic" numberOfLines={1}>
                        {item.mentions}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
                </Link>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
}
