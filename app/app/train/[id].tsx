import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Modal, Alert, TextInput
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { buildLeafletHtml } from '../../src/leafletMap';
import { useLocalSearchParams, Stack } from 'expo-router';
import { fetchTrain, fetchTrainReports, submitTrainReport } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  isTrainWatched, addWatchedTrain, removeWatchedTrain, requestNotificationPermission,
} from '../../src/notifications';
import { recordRecentSearch, getDelayHistory, type DelaySnapshot } from '../../src/storage';
import { useTheme } from '../../src/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stop {
  station_name?: string; stationName?: string;
  arrival_time?: string; arrivalTime?: string;
  departure_time?: string; departureTime?: string;
  delay?: number; delay_minutes?: number;
  platform?: string; km?: number; observations?: string;
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
function formatDelay(min: number | null | undefined): string {
  if (!min || min === 0) return 'La timp';
  return min > 0 ? `+${min} min` : `${min} min`;
}
function delayColor(min: number | null | undefined): string {
  if (!min || min === 0) return '#16A34A';
  if (min <= 5) return '#D97706';
  return '#DC2626';
}
const TRAIN_COLORS: Record<string, string> = {
  IC: '#DC2626', IR: '#2563EB', R: '#16A34A', 'R-E': '#7C3AED',
};
function badgeBg(num: string): string {
  const p = num.split(/[\s\d]/)[0]?.toUpperCase() ?? '';
  return TRAIN_COLORS[p] ?? '#4B5563';
}

// ─── Delay History Mini Chart ─────────────────────────────────────────────────
function DelayChart({ history, dark }: { history: DelaySnapshot[]; dark: boolean }) {
  if (!history.length) return null;

  const maxDelay = Math.max(...history.map(s => s.delay), 1);

  return (
    <View className={`rounded-2xl p-4 mt-1 border ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
      <View className="flex-row items-center mb-3">
        <Ionicons name="stats-chart" size={16} color="#0066CC" />
        <Text className={`text-xs font-bold ml-2 tracking-widest ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          ISTORIC ÎNTÂRZIERI
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
        {[
          { color: '#16A34A', label: 'La timp' },
          { color: '#D97706', label: '1–5 min' },
          { color: '#DC2626', label: '>5 min' },
        ].map(({ color, label }) => (
          <View key={label} className="flex-row items-center gap-1">
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
            <Text style={{ fontSize: 10, color: dark ? '#6B7280' : '#9CA3AF' }}>{label}</Text>
          </View>
        ))}
        <Text style={{ fontSize: 10, color: dark ? '#6B7280' : '#9CA3AF' }}>
          {history.length} măsurători
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TrainDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dark } = useTheme();
  const router = useRouter();

  const [train, setTrain] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [mapHtml, setMapHtml] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const webviewRef = useRef<WebView>(null);

  // Notification state
  const [watching, setWatching] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // Delay history
  const [delayHistory, setDelayHistory] = useState<DelaySnapshot[]>([]);

  // Reports
  const [reports, setReports] = useState<Report[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('aglomerat');
  const [reportMessage, setReportMessage] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const load = async () => {
    try {
      const [data, reps] = await Promise.all([
        fetchTrain(id ?? ''),
        fetchTrainReports(id ?? '').catch(() => [])
      ]);
      setTrain(data);
      setReports(reps);
      setSelectedBranch(0);
      setError('');
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e.message ?? 'Eroare';
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
  }, [train]);

  // Check watching status
  useEffect(() => {
    if (!id) return;
    isTrainWatched(id).then(setWatching);
  }, [id]);

  // Rebuild map HTML
  useEffect(() => {
    if (!train) return;
    const bs: { label: string; stations_data: Stop[] }[] = train?.branches ?? [];
    const ss: Stop[] = bs.length > 0
      ? (bs[selectedBranch]?.stations_data ?? [])
      : (train?.stops ?? train?.stations ?? []);
    const names = ss.map((s) => ({ name: s.station_name ?? s.stationName ?? '' })).filter(s => s.name);
    if (!names.length) return;
    setMapHtml(buildLeafletHtml(names));
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
    if (!userLocation || !webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.setUserLocation(${userLocation.lat},${userLocation.lon});true;`
    );
  }, [userLocation]);

  // Toggle notification subscription
  const handleToggleNotification = async () => {
    setNotifLoading(true);
    try {
      if (watching) {
        await removeWatchedTrain(trainNumber);
        setWatching(false);
        Alert.alert('Notificări dezactivate', `Nu vei mai primi alerte pentru trenul ${trainNumber}.`);
      } else {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert('Permisiune necesară', 'Activează notificările din Setările dispozitivului.');
          return;
        }
        await addWatchedTrain({
          trainNumber,
          routeLabel: train?.route_name ?? train?.route ?? trainNumber,
          addedAt: new Date().toISOString().split('T')[0],
        });
        setWatching(true);
        Alert.alert('Notificări activate ✅', `Vei fi alertat când trenul ${trainNumber} are întârzieri.`);
      }
    } finally {
      setNotifLoading(false);
    }
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
      Alert.alert('Raport trimis', 'Mulțumim pentru contribuție! Raportul tău ajută alți călători.');
    } catch (e) {
      Alert.alert('Eroare', 'Nu am putut trimite raportul.');
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
        <Text className={`mt-3 ${subText}`}>Se încarcă datele…</Text>
      </View>
    );
  }
  if (error && !train?.suggestions) {
    return (
      <View className={`flex-1 justify-center items-center ${bg} px-6`}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text className="text-red-500 text-base mt-3 text-center">{error}</Text>
        <TouchableOpacity className="bg-primary rounded-xl px-6 py-3 mt-4" onPress={load}>
          <Text className="text-white font-semibold">Reîncearcă</Text>
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
            <Text className={`text-base font-bold mt-2 ${headText}`}>Încercați:</Text>
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
        className={`flex-1 ${bg}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />}
      >
        <View className="pb-10">

          {/* ── Header ────────────────────────────────────────────────── */}
          <View className={`border-b px-4 py-4 flex-row items-center ${card}`}>
            <View style={{ backgroundColor: badgeBg(trainNumber) }} className="rounded-lg px-3 py-1.5">
              <Text className="text-white font-bold text-base">{trainNumber}</Text>
            </View>
            <View className="flex-1 ml-3">
              <Text className={`text-base font-semibold ${headText}`}>{route}</Text>
              <Text className={`text-xs mt-1 ${subText}`}>{operator}</Text>
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
                Vei fi notificat la întârzieri pentru acest tren
              </Text>
              <TouchableOpacity onPress={handleToggleNotification} activeOpacity={0.7}>
                <Text className="text-amber-600 text-xs font-semibold">Oprește</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Branch selector ───────────────────────────────────────── */}
          {branches.length > 1 && (
            <View className={`mt-1 px-4 pt-3 pb-2 border-b ${card}`}>
              <Text className={`text-xs tracking-widest mb-2 ${subText}`}>SELECTEAZĂ RUTA</Text>
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
              <DelayChart history={delayHistory} dark={dark} />
            </View>
          )}

          {/* ── Reports (Feature 6) ───────────────────────────────────── */}
          <View className={`mt-3 mx-4 border rounded-2xl px-4 py-4 ${card}`}>
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Ionicons name="chatbubbles" size={16} color="#0066CC" />
                <Text className={`text-xs font-bold tracking-widest ml-2 ${subText}`}>RAPOARTE CĂLĂTORI</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReportModal(true)} activeOpacity={0.7} className="bg-primary rounded-lg px-3 py-1.5 flex-row items-center">
                <Ionicons name="add" size={14} color="#fff" />
                <Text className="text-white text-xs font-bold ml-1">ADAUGĂ</Text>
              </TouchableOpacity>
            </View>

            {reports.length === 0 ? (
              <Text className={`text-center py-4 ${subText}`}>Trenul nu are niciun raport momentan.</Text>
            ) : (
              reports.map((rep, i) => (
                <View key={i} className={`py-3 ${i < reports.length - 1 ? `border-b ${divider}` : ''}`}>
                  <View className="flex-row items-center mb-1">
                    <View className="bg-gray-200 dark:bg-gray-800 rounded px-2 py-0.5 mr-2">
                      <Text className={`text-xs font-bold uppercase ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{rep.report_type.replace('_', ' ')}</Text>
                    </View>
                    <Text className={`text-xs ${subText}`}>{rep.reported_at?.slice(11, 16) ?? 'Acum'}</Text>
                  </View>
                  {rep.message ? <Text className={`text-sm ${headText}`}>{rep.message}</Text> : null}
                </View>
              ))
            )}
          </View>

          {/* ── Stops ─────────────────────────────────────────────────── */}
          <View className={`mt-3 mx-4 border rounded-2xl px-4 py-4 ${card}`}>
            <Text className={`text-xs font-bold tracking-widest mb-4 ${subText}`}>
              OPRIRI ({stops.length})
            </Text>
            {stops.map((stop, i) => {
              const name = stop.station_name ?? stop.stationName ?? '-';
              const arr = stop.arrival_time ?? stop.arrivalTime ?? '';
              const dep = stop.departure_time ?? stop.departureTime ?? '';
              const delay = stop.delay ?? stop.delay_minutes ?? 0;
              const isFirst = i === 0;
              const isLast = i === stops.length - 1;
              return (
                <View key={i} className="flex-row min-h-[52px]">
                  {/* Timeline */}
                  <View className="w-6 items-center">
                    {!isFirst && <View className={`flex-1 w-0.5 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`} />}
                    <View
                      className={`rounded-full ${isFirst || isLast ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`}
                      style={{ backgroundColor: '#0066CC' }}
                    />
                    {!isLast && <View className={`flex-1 w-0.5 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`} />}
                  </View>
                  {/* Info */}
                  <View className="flex-1 ml-3 py-2">
                    <Text className={`text-base font-semibold ${headText}`}>{name}</Text>
                    <View className="flex-row gap-3 mt-1 flex-wrap">
                      {arr ? <Text className={`text-xs ${subText}`}>Arr: {arr}</Text> : null}
                      {dep ? <Text className={`text-xs ${subText}`}>Dep: {dep}</Text> : null}
                      {(delay !== 0 || hasLive) && (
                        <Text className="text-xs font-bold" style={{ color: delayColor(delay) }}>
                          {formatDelay(delay)}
                        </Text>
                      )}
                    </View>
                    {stop.platform && <Text className={`text-xs mt-0.5 ${subText}`}>Linia {stop.platform}</Text>}
                    {stop.observations && <Text className="text-xs text-yellow-600 mt-0.5 italic">{stop.observations}</Text>}

                    {/* Feature 4: Am pierdut trenul */}
                    {isTimePast(dep) && !isFirst && !isLast && (
                      <TouchableOpacity
                        onPress={() => {
                          // Navigate to search with this station as origin
                          router.push(`/search?q=${encodeURIComponent(name)}`);
                        }}
                        activeOpacity={0.7}
                        className="mt-2 bg-red-50 dark:bg-red-900/30 self-start border border-red-200 dark:border-red-800/50 rounded-lg px-2.5 py-1.5 flex-row items-center"
                      >
                        <Ionicons name="warning-outline" size={14} color="#DC2626" />
                        <Text className="text-red-600 dark:text-red-400 text-xs font-bold ml-1.5">Am pierdut trenul</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {stops.length === 0 && (
              <Text className={`text-center py-4 ${subText}`}>Nu sunt opriri disponibile</Text>
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
              Harta rutei · {trainNumber}
            </Text>
            <TouchableOpacity onPress={() => setShowMap(false)} className="p-1" activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={dark ? '#E5E7EB' : '#374151'} />
            </TouchableOpacity>
          </View>
          {mapHtml ? (
            <WebView
              ref={webviewRef}
              source={{ html: mapHtml }}
              style={{ flex: 1 }}
              originWhitelist={['*']}
              javaScriptEnabled domStorageEnabled geolocationEnabled
              onLoad={() => {
                if (userLocation) {
                  webviewRef.current?.injectJavaScript(
                    `window.setUserLocation(${userLocation.lat},${userLocation.lon});true;`
                  );
                }
              }}
            />
          ) : (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0066CC" />
            </View>
          )}
        </View>
      </Modal>

      {/* ── Report Modal ────────────────────────────────────────────────── */}
      <Modal visible={showReportModal} animationType="slide" transparent={true} onRequestClose={() => setShowReportModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View className={`p-6 rounded-t-3xl ${dark ? 'bg-gray-900' : 'bg-white'}`}>
            <View className="flex-row justify-between items-center mb-5">
              <Text className={`text-lg font-bold ${headText}`}>Adaugă raport</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} className="p-1" activeOpacity={0.7}>
                <Ionicons name="close-circle" size={24} color={dark ? '#6B7280' : '#D1D5DB'} />
              </TouchableOpacity>
            </View>

            <Text className={`text-sm mb-2 ${headText} font-semibold`}>Ce se întâmplă?</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {['aglomerat', 'aer_conditionat_defect', 'oprit_in_camp', 'intarziat', 'altceva'].map(type => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setReportType(type)}
                  className={`rounded-xl px-3 py-2 border ${reportType === type ? 'bg-primary border-primary' : `border-gray-300 ${dark ? 'bg-gray-800' : 'bg-white'}`}`}
                >
                  <Text className={`text-sm font-medium ${reportType === type ? 'text-white' : subText}`}>
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className={`text-sm mb-2 ${headText} font-semibold`}>Detalii (opțional)</Text>
            <View className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 mb-6">
              <Text style={{ display: 'none' }} /* keep tailwind responsive */ />
              <TextInput
                value={reportMessage}
                onChangeText={setReportMessage}
                placeholder="Ex: Nu sunt locuri în vagonul 3..."
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
                <Text className="text-white font-bold text-base">TRIMITE RAPORT</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
