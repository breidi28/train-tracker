import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Modal, Alert, TextInput, Share
} from 'react-native';
import CrossPlatformMapView, { type MapViewHandle } from '../../src/CrossPlatformMapView';
import * as Location from 'expo-location';

import { buildLeafletHtml } from '../../src/leafletMap';
import { useLocalSearchParams, Stack } from 'expo-router';
import { fetchTrain, fetchTrainReports, fetchTrainComposition, submitTrainReport } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  isTrainWatched, addWatchedTrain, removeWatchedTrain, requestNotificationPermission,
} from '../../src/notifications';
import {
  recordRecentSearch, getDelayHistory, type DelaySnapshot,
  getFavoriteTrains, toggleFavoriteTrain,
  getMapRouteCache, saveMapRouteCache,
  saveTrainCache, getTrainCache,
} from '../../src/storage';
import { useTheme } from '../../src/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stop {
  station_name?: string; stationName?: string;
  arrival_time?: string; arrivalTime?: string;
  departure_time?: string; departureTime?: string;
  delay?: number; delay_minutes?: number;
  platform?: string; km?: number; observations?: string;
  dwell_minutes?: number;
}

interface Report {
  id?: number;
  report_type: string;
  message: string;
  reported_at?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isTimePast(timeStr: string | undefined): boolean {
  if (!timeStr) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [hours, minutes] = timeStr.split(':').map(Number);
  const itemMinutes = hours * 60 + minutes;
  return itemMinutes < currentMinutes;
}

/** Like isTimePast but accounts for the train's current delay.
 *  A stop is only "passed" when scheduled_time + delay_minutes < now.
 *  This prevents showing a 70-min-late train as having already passed
 *  future stations that it physically cannot have reached yet. */
function isTimePastWithDelay(timeStr: string | undefined, delayMin: number): boolean {
  if (!timeStr) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return false;
  const scheduledMinutes = hours * 60 + minutes;
  const actualMinutes = scheduledMinutes + (delayMin ?? 0);
  return actualMinutes < currentMinutes;
}

/** Parse "HH:MM" into total minutes from midnight */
function timeToMinutes(t: string | undefined): number | null {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

/** Add delayMin minutes to a "HH:MM" string and return the new "HH:MM" */
function addMinutesToTime(timeStr: string | undefined, delayMin: number): string | null {
  if (!timeStr || !delayMin) return null;
  const base = timeToMinutes(timeStr);
  if (base === null) return null;
  const total = (base + delayMin) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Compute dwell time in minutes between arrival and departure */
function calcDwell(arr: string | undefined, dep: string | undefined): number {
  const a = timeToMinutes(arr);
  const d = timeToMinutes(dep);
  if (a === null || d === null) return 0;
  let diff = d - a;
  if (diff < 0) diff += 24 * 60; // midnight crossing
  return diff;
}
function formatDelay(min: number | null | undefined, t: (key: string) => string): string {
  if (!min || min === 0) return t('common.onTime');
  return min > 0 ? `+${min} min` : `${min} min`;
}
function delayColor(min: number | null | undefined): string {
  if (!min || min === 0) return '#16A34A';
  if (min <= 5) return '#D97706';
  return '#DC2626';
}
const CATEGORY_COLORS: Record<string, string> = {
  IC: '#008000', IR: '#f00', IRN: '#f00', R: '#000', 'R-E': '#000',
};
function badgeBg(num: string): string {
  const p = num.split(/[\s\d]/)[0]?.toUpperCase() ?? '';
  return CATEGORY_COLORS[p] ?? '#4B5563';
}

// ─── Delay History Mini Chart ─────────────────────────────────────────────────
function DelayChart({ history, dark, t }: { history: DelaySnapshot[]; dark: boolean; t: (key: string, opts?: any) => string }) {
  if (!history.length) return null;

  const maxDelay = Math.max(...history.map(s => s.delay), 1);

  return (
    <View className={`rounded-2xl p-4 mt-1 border ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
      <View className="flex-row items-center mb-3">
        <Ionicons name="stats-chart" size={16} color="#0066CC" />
        <Text className={`text-xs font-bold ml-2 tracking-widest ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          {t('trainDetail.delayHistory')}
        </Text>
      </View>

      {/* Bar chart */}
      <View className="flex-row items-end gap-1" style={{ height: 60 }}>
        {history.map((snap, i) => {
          const heightPct = maxDelay > 0 ? snap.delay / maxDelay : 0;
          const barH = Math.max(heightPct * 52, snap.delay > 0 ? 4 : 2);
          const color = snap.delay === 0 ? '#16A34A' : snap.delay <= 5 ? '#D97706' : '#DC2626';
          const time = snap.ts.slice(11, 16); // HH:MM
          return (
            <View key={i} className="flex-1 items-center justify-end">
              <View
                style={{
                  width: '70%',
                  height: barH,
                  backgroundColor: color,
                  borderRadius: 3,
                  opacity: 0.85,
                }}
              />
              {i % Math.max(1, Math.floor(history.length / 4)) === 0 && (
                <Text style={{ fontSize: 8, color: dark ? '#6B7280' : '#9CA3AF', marginTop: 3 }}>
                  {time}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View className="flex-row justify-between mt-3">
        {
          [
            { color: '#16A34A', label: t('common.onTime') },
            { color: '#D97706', label: '1–5 min' },
            { color: '#DC2626', label: '>5 min' },
          ].map(({ color, label }) => (
            <View key={label} className="flex-row items-center gap-1">
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
              <Text style={{ fontSize: 10, color: dark ? '#6B7280' : '#9CA3AF' }}>{label}</Text>
            </View>
          ))
        }
        <Text style={{ fontSize: 10, color: dark ? '#6B7280' : '#9CA3AF' }}>
          {t('trainDetail.measurements', { count: history.length })}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TrainDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();


  const [train, setTrain] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [mapHtml, setMapHtml] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const mapHandleRef = useRef<MapViewHandle | null>(null);
  const mapCacheKeyRef = useRef<string>('');

  const scrollViewRef = useRef<ScrollView>(null);
  // Y-positions of each stop row, keyed by stop index
  const stopYRef = useRef<Record<number, number>>({});
  // Prevent re-scrolling on every re-render
  const hasScrolledRef = useRef(false);

  // Notification state
  const [watching, setWatching] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // Delay history
  const [delayHistory, setDelayHistory] = useState<DelaySnapshot[]>([]);

  // Favorite toggle
  const [isFavorite, setIsFavorite] = useState(false);

  // Reports
  const [reports, setReports] = useState<Report[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('aglomerat');
  const [reportMessage, setReportMessage] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [showReports, setShowReports] = useState(false);

  // Composition / Facilities
  const [composition, setComposition] = useState<any>(null);
  const [showFacilities, setShowFacilities] = useState(false);

  const load = async () => {
    hasScrolledRef.current = false; // reset so new data triggers auto-scroll
    stopYRef.current = {};
    try {
      const [data, reps, comp] = await Promise.all([
        fetchTrain(id ?? ''),
        fetchTrainReports(id ?? '').catch(() => []),
        fetchTrainComposition(id ?? '').catch(() => null)
      ]);
      setTrain(data);
      setReports(reps);
      setComposition(comp);
      setSelectedBranch(0);
      setError('');
      if (id) saveTrainCache(id, data).catch(() => { });
    } catch (e: any) {
      if (id) {
        const cached = await getTrainCache(id);
        if (cached) {
          setTrain({ ...cached, isOffline: true });
          setReports([]);
          setComposition(null);
          setSelectedBranch(0);
          setError(t('common.offlineFallback', { defaultValue: 'Se afișează date salvate (fără conexiune la internet).' }));
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
      const msg = e?.response?.data?.error ?? e.message ?? t('common.error');
      setError(msg);
      if (e?.response?.data?.suggestions) setTrain({ suggestions: e.response.data.suggestions });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [id]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Record recent search & load delay history once train data arrives
  useEffect(() => {
    if (!train || !id) return;
    const trainNum = train.train_number ?? train.trainNumber ?? id;
    const routeLabel = train.route_name ?? train.route ?? trainNum;
    recordRecentSearch({
      trainNumber: trainNum,
      routeLabel,
      category: trainNum.split(/[\s\d]/)[0]?.toUpperCase(),
      searchedAt: new Date().toISOString(),
    });
    getDelayHistory(trainNum).then(setDelayHistory);

    // Check if favorited
    getFavoriteTrains().then(favs => {
      setIsFavorite(!!favs.find(f => f.id === trainNum));
    });
  }, [train]);

  // Check watching status
  useEffect(() => {
    if (!id) return;
    isTrainWatched(id).then(setWatching);
  }, [id]);

  // Rebuild map HTML (with AsyncStorage cache for rail path)
  useEffect(() => {
    if (!train) return;
    const bs: { label: string; stations_data: Stop[] }[] = train?.branches ?? [];
    const ss: Stop[] = bs.length > 0
      ? (bs[selectedBranch]?.stations_data ?? [])
      : (train?.stops ?? train?.stations ?? []);
    const names = ss.map((s) => ({ name: s.station_name ?? s.stationName ?? '' })).filter(s => s.name);
    if (!names.length) return;
    const fingerprint = names.map(n => n.name).join('~');
    mapCacheKeyRef.current = fingerprint;
    getMapRouteCache(fingerprint).then(cached => {
      setMapHtml(buildLeafletHtml(names, cached));
    });
  }, [train, selectedBranch]);

  // GPS for map
  useEffect(() => {
    if (!showMap) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      } catch { }
    })();
  }, [showMap]);

  useEffect(() => {
    if (!userLocation || !mapHandleRef.current) return;
    mapHandleRef.current.setUserLocation(userLocation.lat, userLocation.lon);
  }, [userLocation]);


  // Toggle notification subscription
  const handleToggleNotification = async () => {
    setNotifLoading(true);
    try {
      if (watching) {
        await removeWatchedTrain(trainNumber);
        setWatching(false);
        Alert.alert(t('trainDetail.notifOn'), t('trainDetail.notifOnMsg', { train: trainNumber }));

      } else {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(t('trainDetail.notifNeeded'), t('trainDetail.notifNeededMsg'));

          return;
        }
        await addWatchedTrain({
          trainNumber,
          routeLabel: train?.route_name ?? train?.route ?? trainNumber,
          addedAt: new Date().toISOString().split('T')[0],
        });
        setWatching(true);
        Alert.alert(t('trainDetail.notifOn'), t('trainDetail.notifOnMsg', { train: trainNumber }));

      }
    } finally {
      setNotifLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    const isNowFav = await toggleFavoriteTrain({
      id: trainNumber,
      label: route,
    });
    setIsFavorite(isNowFav);
  };

  const handleShare = async () => {
    try {
      const waitTime = train?.delay && train.delay > 0
        ? ` (+${train.delay} min ${t('common.delayed').toLowerCase()})`
        : ` (${t('common.onTime')})`;
      const msg = `${t('trainDetail.watchingMsg')}: ${trainNumber} (${route})!${waitTime}\nhttps://cfr.ro/train/${encodeURIComponent(trainNumber)}`;
      await Share.share({ message: msg });
    } catch { }
  };

  const submitReport = async () => {
    if (!reportType) return;
    setReportLoading(true);
    try {
      await submitTrainReport(trainNumber, reportType, reportMessage);
      setShowReportModal(false);
      setReportMessage('');
      // Reload reports
      const reps = await fetchTrainReports(trainNumber);
      setReports(reps);
      Alert.alert(t('trainDetail.reportSent'), t('trainDetail.reportSentMsg'));
    } catch (e) {
      Alert.alert(t('common.error'), t('trainDetail.reportError'));
    } finally {
      setReportLoading(false);
    }
  };

  const branches: { label: string; stations_data: Stop[] }[] = train?.branches ?? [];
  const stops: Stop[] = branches.length > 0
    ? (branches[selectedBranch]?.stations_data ?? [])
    : (train?.stops ?? train?.stations ?? train?.route?.stations ?? []);
  const trainNumber = train?.train_number ?? train?.trainNumber ?? id ?? '';
  const route = train?.route_name ?? train?.route ?? '';
  const operator = train?.operator ?? 'CFR Călători';
  const hasLive = train?.data_source?.has_live_delays === true;

  // ── Theme shortcuts ──────────────────────────────────────────────────────
  const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
  const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const divider = dark ? 'border-gray-800' : 'border-gray-100';
  const headText = dark ? 'text-white' : 'text-gray-900';
  const subText = dark ? 'text-gray-400' : 'text-gray-500';

  if (loading) {
    return (
      <View className={`flex-1 justify-center items-center ${bg}`}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className={`mt-3 ${subText}`}>{t('trainDetail.loading')}</Text>
      </View>
    );
  }
  if (error && !train?.suggestions) {
    return (
      <View className={`flex-1 justify-center items-center ${bg} px-6`}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text className="text-red-500 text-base mt-3 text-center">{error}</Text>
        <TouchableOpacity className="bg-primary rounded-xl px-6 py-3 mt-4" onPress={load}>
          <Text className="text-white font-semibold">{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (train?.suggestions) {
    return (
      <ScrollView className={`flex-1 ${bg}`}>
        <View className="p-4">
          <View className={`border rounded-2xl p-4 ${card}`}>
            <Text className="text-red-500 text-center mb-2">{error}</Text>
            <Text className={`text-base font-bold mt-2 ${headText}`}>{t('trainDetail.trySuggestions')}</Text>
            {train.suggestions.map((sug: string, i: number) => (
              <Text key={i} className="text-primary mt-1">• {sug}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: trainNumber }} />
      <ScrollView
        ref={scrollViewRef}
        className={`flex-1 ${bg}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />}
      >
        <View className="pb-10">

          {/* ── Header ────────────────────────────────────────────────── */}
          <View className={`border-b px-4 py-4 flex-row items-center ${card}`}>
            <View
              style={{ backgroundColor: badgeBg(trainNumber) }}
              className="rounded-lg px-3 py-1.5"
            >
              <Text className="text-white font-bold text-base">{trainNumber}</Text>
            </View>
            <View className="flex-1 ml-3 justify-center">
              {!!route && (
                <Text className={`text-base font-semibold ${headText}`} numberOfLines={1}>{route}</Text>
              )}
              <Text className={`text-xs ${subText}`} style={{ marginTop: route ? 2 : 0 }}>{operator}</Text>
            </View>
            {/* Bell */}
            <TouchableOpacity onPress={handleToggleNotification} disabled={notifLoading} className="p-2" activeOpacity={0.7}>
              {notifLoading
                ? <ActivityIndicator size="small" color="#0066CC" />
                : <Ionicons
                  name={watching ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color={watching ? '#F59E0B' : '#0066CC'}
                />
              }
            </TouchableOpacity>
            {/* Favorite */}
            <TouchableOpacity onPress={handleToggleFavorite} className="p-2 ml-1" activeOpacity={0.7}>
              <Ionicons name={isFavorite ? "star" : "star-outline"} size={22} color={isFavorite ? '#F59E0B' : '#0066CC'} />
            </TouchableOpacity>
            {/* Share */}
            <TouchableOpacity onPress={handleShare} className="p-2 ml-1" activeOpacity={0.7}>
              <Ionicons name="share-outline" size={22} color="#0066CC" />
            </TouchableOpacity>
            {/* Map */}
            <TouchableOpacity onPress={() => setShowMap(true)} className="p-2 ml-1" activeOpacity={0.7}>
              <Ionicons name="map-outline" size={22} color="#0066CC" />
            </TouchableOpacity>
          </View>

          {/* Watching strip */}
          {watching && (
            <View className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex-row items-center">
              <Ionicons name="notifications" size={14} color="#F59E0B" />
              <Text className="text-amber-700 text-xs ml-1.5 flex-1">
                {t('trainDetail.watchingMsg')}
              </Text>
              <TouchableOpacity onPress={handleToggleNotification} activeOpacity={0.7}>
                <Text className="text-amber-600 text-xs font-semibold">{t('trainDetail.stopWatching')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Branch selector ───────────────────────────────────────── */}
          {branches.length > 1 && (
            <View className={`mt-1 px-4 pt-3 pb-2 border-b ${card}`}>
              <Text className={`text-xs tracking-widest mb-2 ${subText}`}>{t('trainDetail.selectRoute')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {branches.map((b, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setSelectedBranch(i)}
                    className={`rounded-full px-3 py-1.5 border ${selectedBranch === i ? 'bg-primary border-primary' : `border-gray-300 ${dark ? 'bg-gray-800' : 'bg-white'}`
                      }`}
                  >
                    <Text className={`text-xs font-medium ${selectedBranch === i ? 'text-white' : subText}`}>
                      {b.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Delay History Chart (Feature 9) ───────────────────────── */}
          {delayHistory.length > 0 && (
            <View className="px-4 mt-3">
              <DelayChart history={delayHistory} dark={dark} t={t} />
            </View>
          )}

          {/* ── Reports (collapsible) ─────────────────────────────── */}
          <View className={`mt-3 mx-4 border rounded-2xl ${card}`}>
            <TouchableOpacity
              onPress={() => setShowReports(v => !v)}
              activeOpacity={0.7}
              className="flex-row items-center justify-between px-4 py-4"
            >
              <View className="flex-row items-center">
                <Ionicons name="chatbubbles" size={16} color="#0066CC" />
                <Text className={`text-xs font-bold tracking-widest ml-2 ${subText}`}>{t('trainDetail.reports')}</Text>
                {reports.length > 0 && (
                  <View className="ml-2 bg-blue-600 rounded-full w-5 h-5 items-center justify-center">
                    <Text className="text-white text-[10px] font-bold">{reports.length}</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => setShowReportModal(true)}
                  activeOpacity={0.7}
                  className="bg-primary rounded-lg px-3 py-1.5 flex-row items-center"
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text className="text-white text-xs font-bold ml-1">{t('trainDetail.addReport')}</Text>
                </TouchableOpacity>
                <Ionicons
                  name={showReports ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={dark ? '#6B7280' : '#9CA3AF'}
                />
              </View>
            </TouchableOpacity>

            {showReports && (
              <View className={`px-4 pb-4 border-t ${divider}`}>
                {reports.length === 0 ? (
                  <Text className={`text-center py-4 ${subText}`}>{t('trainDetail.noReports')}</Text>
                ) : (
                  reports.map((rep, i) => (
                    <View key={i} className={`py-3 ${i < reports.length - 1 ? `border-b ${divider}` : ''}`}>
                      <View className="flex-row items-center mb-1">
                        <View className="bg-gray-200 dark:bg-gray-800 rounded px-2 py-0.5 mr-2">
                          <Text className={`text-xs font-bold uppercase ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{rep.report_type.replace('_', ' ')}</Text>
                        </View>
                        <Text className={`text-xs ${subText}`}>{rep.reported_at?.slice(11, 16) ?? t('trainDetail.reportTime')}</Text>
                      </View>
                      {rep.message ? <Text className={`text-sm ${headText}`}>{rep.message}</Text> : null}
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          {/* ── Facilities (collapsible) ─────────────────────────────── */}
          {composition && (
            <View className={`mt-3 mx-4 border rounded-2xl ${card}`}>
              <TouchableOpacity
                onPress={() => setShowFacilities(v => !v)}
                activeOpacity={0.7}
                className="flex-row items-center justify-between px-4 py-4"
              >
                <View className="flex-row items-center">
                  <Ionicons name="train" size={16} color="#0066CC" />
                  <Text className={`text-xs font-bold tracking-widest ml-2 px-1 ${subText}`}>
                    {t('trainDetail.facilities', { defaultValue: 'FACILITĂȚI & GARNITURĂ' })}
                  </Text>
                </View>
                <Ionicons
                  name={showFacilities ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={dark ? '#6B7280' : '#9CA3AF'}
                />
              </TouchableOpacity>

              {showFacilities && (
                <View className={`px-4 pb-4 border-t pt-2 ${divider}`}>
                  {composition.services?.length > 0 && (
                    <View className="flex-row flex-wrap gap-2 mb-2">
                      {composition.services.map((service: string, i: number) => (
                        <View key={i} className={`flex-row items-center rounded-lg px-2 py-1 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                          <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                          <Text className={`text-xs font-semibold ml-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{service}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {composition.locomotive && (
                    <View className={`mt-2 py-3 border-b ${divider}`}>
                      <Text className={`text-xs font-bold mb-1 ${subText}`}>Locomotivă: {composition.locomotive.class}</Text>
                      <Text className={`text-sm ${headText}`}>{composition.locomotive.description} - {composition.locomotive.power}</Text>
                      <Text className={`text-xs mt-1 ${subText}`}>Viteză maximă: {composition.locomotive.max_speed}</Text>
                    </View>
                  )}
                  {composition.cars?.map((car: any, i: number) => (
                    <View key={i} className={`py-3 ${i < composition.cars.length - 1 ? `border-b ${divider}` : ''}`}>
                      <View className="flex-row items-center mb-1">
                        <View className="bg-blue-100 dark:bg-blue-900 rounded px-2 py-0.5 mr-2">
                          <Text className={`text-xs font-bold uppercase ${dark ? 'text-blue-200' : 'text-blue-800'}`}>Vagon {car.position}</Text>
                        </View>
                        <Text className={`text-xs font-bold ${subText}`}>{car.class} - {car.capacity}</Text>
                      </View>
                      <Text className={`text-sm ${headText}`}>{car.description}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Stops ─────────────────────────────────────────────────── */}
          <View className={`mt-3 mx-4 border rounded-2xl px-4 py-4 ${card}`}>
            <Text className={`text-xs font-bold tracking-widest mb-4 ${subText}`}>
              {t('trainDetail.stops')} ({stops.length})
            </Text>
            {stops.map((stop, i) => {
              const name = stop.station_name ?? stop.stationName ?? '-';
              const arr = stop.arrival_time ?? stop.arrivalTime ?? '';
              const dep = stop.departure_time ?? stop.departureTime ?? '';
              const delay = stop.delay ?? stop.delay_minutes ?? 0;
              const isFirst = i === 0;
              const isLast = i === stops.length - 1;

              // Determine whether this stop has been passed.
              // IMPORTANT: use delay-adjusted time, NOT the scheduled time.
              // A train 70 min late leaving Focșani at 17:50 departs at 18:60 (19:00),
              // so Râmnicu Sărat (18:30 scheduled) cannot be marked as passed until 18:30+70=19:40.
              const timeForPast = dep || arr;
              const isPassed = isTimePastWithDelay(timeForPast, delay);

              // Find the "current" stop = first stop NOT yet passed
              const prevStop = stops[i - 1];
              const prevDelay = prevStop ? (prevStop.delay ?? prevStop.delay_minutes ?? 0) : 0;
              const prevTime = i > 0 ? (prevStop?.departure_time ?? prevStop?.departureTime ?? prevStop?.arrival_time ?? prevStop?.arrivalTime ?? '') : '';
              const prevPassed = i > 0 && isTimePastWithDelay(prevTime, prevDelay);
              const isCurrent = !isPassed && prevPassed;

              // Dot color and style
              const dotColor = isPassed ? '#0066CC' : isCurrent ? '#0066CC' : (dark ? '#4B5563' : '#D1D5DB');
              const dotSize = isFirst || isLast ? 14 : isCurrent ? 13 : 10;
              const lineColorAbove = isPassed || isCurrent ? '#0066CC' : (dark ? '#374151' : '#E5E7EB');
              const lineColorBelow = isPassed && !isLast ? '#0066CC' : (dark ? '#374151' : '#E5E7EB');

              return (
                <View
                  key={i}
                  className="flex-row min-h-[52px]"
                  onLayout={(e) => {
                    stopYRef.current[i] = e.nativeEvent.layout.y;
                    if (isCurrent && !hasScrolledRef.current) {
                      hasScrolledRef.current = true;
                      setTimeout(() => {
                        scrollViewRef.current?.scrollTo({
                          y: Math.max(0, e.nativeEvent.layout.y - 120),
                          animated: true,
                        });
                      }, 350);
                    }
                  }}
                >
                  {/* Timeline */}
                  <View className="w-6 items-center">
                    {!isFirst && <View style={{ flex: 1, width: 2, backgroundColor: lineColorAbove }} />}
                    <View
                      style={{
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: isPassed || isCurrent ? dotColor : 'transparent',
                        borderWidth: isCurrent ? 0 : isPassed ? 0 : 2,
                        borderColor: dotColor,
                      }}
                    />
                    {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: lineColorBelow }} />}
                  </View>
                  {/* Info */}
                  <View className="flex-1 ml-3 py-2">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className={`text-base font-semibold ${isPassed ? (dark ? 'text-gray-300' : 'text-gray-700') : isCurrent ? (dark ? 'text-white' : 'text-gray-900') : (dark ? 'text-gray-500' : 'text-gray-400')}`}
                      >
                        {name}
                      </Text>
                      {isCurrent && (
                        <View className="bg-blue-600 rounded-full px-2 py-0.5">
                          <Text className="text-white text-[10px] font-bold">{t('common.next')}</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row gap-3 mt-1 flex-wrap items-center">
                      {/* Scheduled times */}
                      {arr ? <Text className={`text-xs ${subText}`}>Arr: {arr}</Text> : null}
                      {dep ? <Text className={`text-xs ${subText}`}>Dep: {dep}</Text> : null}
                      {/* Expected (delay-adjusted) times — shown when delay > 0 */}
                      {delay > 0 && (() => {
                        const expArr = addMinutesToTime(arr, delay);
                        const expDep = addMinutesToTime(dep, delay);
                        const expTime = expDep ?? expArr;
                        if (!expTime) return null;
                        return (
                          <View className="flex-row items-center gap-1">
                            <Ionicons name="arrow-forward" size={10} color="#D97706" />
                            <Text className="text-xs font-semibold" style={{ color: '#D97706' }}>
                              {expTime} {t('trainDetail.estimated2')}
                            </Text>
                          </View>
                        );
                      })()}
                      {/* Delay badge */}
                      {(isPassed || delay > 0) && (
                        <Text className="text-xs font-bold" style={{ color: delayColor(delay) }}>
                          {delay !== 0 ? formatDelay(delay, t) : hasLive ? t('common.onTime') : ''}
                        </Text>
                      )}
                      {/* For upcoming on-time stops: show scheduled label */}
                      {!isPassed && !isCurrent && delay === 0 && (dep || arr) && (
                        <Text className={`text-xs italic ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {t('trainDetail.programmed')}
                        </Text>
                      )}
                    </View>
                    <View className={`text-xs mt-0.5 flex-row items-center gap-3 flex-wrap`}>
                      {/* Platform badge */}
                      {stop.platform && (
                        <View className={`flex-row items-center rounded-md px-2 py-0.5 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                          <Ionicons name="train-outline" size={11} color={dark ? '#9CA3AF' : '#6B7280'} />
                          <Text className={`text-xs ml-1 font-medium ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {t('trainDetail.platformLabel', { platform: stop.platform })}
                          </Text>
                        </View>
                      )}
                      {/* Dwell time badge — only if > 0 */}
                      {(() => {
                        const dwell = stop.dwell_minutes ?? calcDwell(arr, dep);
                        if (dwell <= 0) return null;
                        return (
                          <View className={`flex-row items-center rounded-md px-2 py-0.5 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                            <Ionicons name="time-outline" size={11} color={dark ? '#9CA3AF' : '#6B7280'} />
                            <Text className={`text-xs ml-1 font-medium ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                              {t('trainDetail.dwellLabel', { dwell })}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    {stop.observations && <Text className="text-xs text-yellow-600 mt-0.5 italic">{stop.observations}</Text>}

                  </View>
                </View>
              );
            })}
            {stops.length === 0 && (
              <Text className={`text-center py-4 ${subText}`}>{t('trainDetail.noStops')}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Map Modal ───────────────────────────────────────────────────── */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={{ flex: 1, backgroundColor: dark ? '#030712' : '#fff' }}>
          <View
            style={{ paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16 }}
            className={`flex-row items-center border-b ${card}`}
          >
            <Text className={`flex-1 text-base font-semibold ${headText}`}>
              {t('trainDetail.mapModalTitle', { train: trainNumber })}
            </Text>
            <TouchableOpacity onPress={() => setShowMap(false)} className="p-1" activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={dark ? '#E5E7EB' : '#374151'} />
            </TouchableOpacity>
          </View>
          <CrossPlatformMapView
            html={mapHtml}
            handleRef={(h) => { mapHandleRef.current = h; }}
            onRailPath={(path) => {
              if (mapCacheKeyRef.current) saveMapRouteCache(mapCacheKeyRef.current, path);
            }}
          />
        </View>
      </Modal>

      {/* ── Report Modal ────────────────────────────────────────────────── */}
      <Modal visible={showReportModal} animationType="slide" transparent={true} onRequestClose={() => setShowReportModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View className={`p-6 rounded-t-3xl ${dark ? 'bg-gray-900' : 'bg-white'}`}>
            <View className="flex-row justify-between items-center mb-5">
              <Text className={`text-lg font-bold ${headText}`}>{t('trainDetail.reportTitle')}</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} className="p-1" activeOpacity={0.7}>
                <Ionicons name="close-circle" size={24} color={dark ? '#6B7280' : '#D1D5DB'} />
              </TouchableOpacity>
            </View>

            <Text className={`text-sm mb-2 ${headText} font-semibold`}>{t('trainDetail.reportWhat')}</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {['aglomerat', 'aer_conditionat_defect', 'oprit_in_camp', 'intarziat', 'altceva'].map(type => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setReportType(type)}
                  className={`rounded-xl px-3 py-2 border ${reportType === type ? 'bg-primary border-primary' : `border-gray-300 ${dark ? 'bg-gray-800' : 'bg-white'}`}`}
                >
                  <Text className={`text-sm font-medium ${reportType === type ? 'text-white' : subText}`}>
                    {t(`reportTypes.${type}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className={`text-sm mb-2 ${headText} font-semibold`}>{t('trainDetail.reportDetails')}</Text>
            <View className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 mb-6">
              <Text style={{ display: 'none' }} /* keep tailwind responsive */ />
              <TextInput
                value={reportMessage}
                onChangeText={setReportMessage}
                placeholder={t('trainDetail.reportPlaceholder')}
                placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: 'top', color: dark ? '#fff' : '#000' }}
              />
            </View>

            <TouchableOpacity
              onPress={submitReport}
              disabled={reportLoading}
              className="bg-primary rounded-xl py-4 items-center"
              activeOpacity={0.8}
            >
              {reportLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">{t('trainDetail.reportSend')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
