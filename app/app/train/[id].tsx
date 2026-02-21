import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { buildLeafletHtml } from '../../src/leafletMap';
import { useLocalSearchParams, Stack } from 'expo-router';
import { fetchTrain } from '../../src/api';
import { Ionicons } from '@expo/vector-icons';

interface Stop {
  station_name?: string;
  stationName?: string;
  arrival_time?: string;
  arrivalTime?: string;
  departure_time?: string;
  departureTime?: string;
  delay?: number;
  delay_minutes?: number;
  platform?: string;
  km?: number;
  observations?: string;
}

function formatDelay(min: number | null | undefined): string {
  if (!min || min === 0) return 'La timp';
  return min > 0 ? `+${min} min` : `${min} min`;
}

function delayTextClass(min: number | null | undefined): string {
  if (!min || min === 0) return 'text-green-600';
  if (min <= 5) return 'text-yellow-600';
  return 'text-red-600';
}

const TRAIN_COLORS: Record<string, string> = {
  IC: 'bg-red-600', IR: 'bg-blue-600', R: 'bg-green-600', 'R-E': 'bg-purple-600',
};
function badgeClass(num: string): string {
  const prefix = num.split(/[\s\d]/)[0]?.toUpperCase() ?? '';
  return TRAIN_COLORS[prefix] ?? 'bg-gray-600';
}

export default function TrainDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [train, setTrain] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [mapHtml, setMapHtml] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const webviewRef = useRef<WebView>(null);

  const load = async () => {
    try {
      const data = await fetchTrain(id ?? '');
      setTrain(data);
      setSelectedBranch(0);
      setError('');
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e.message ?? 'Eroare';
      setError(msg);
      if (e?.response?.data?.suggestions) {
        setTrain({ suggestions: e.response.data.suggestions });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [id]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Rebuild map HTML whenever the active branch changes
  useEffect(() => {
    if (!train) return;
    const bs: { label: string; stations_data: Stop[] }[] = train?.branches ?? [];
    const ss: Stop[] = bs.length > 0
      ? (bs[selectedBranch]?.stations_data ?? [])
      : (train?.stops ?? train?.stations ?? []);
    const names = ss
      .map((s: Stop) => ({ name: s.station_name ?? s.stationName ?? '' }))
      .filter(s => s.name);
    if (!names.length) return;
    setMapHtml(buildLeafletHtml(names));
  }, [train, selectedBranch]);

  // Request GPS when the map modal opens
  useEffect(() => {
    if (!showMap) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      } catch {}
    })();
  }, [showMap]);

  // Push GPS fix into the WebView once it arrives
  useEffect(() => {
    if (!userLocation || !webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.setUserLocation(${userLocation.lat},${userLocation.lon});true;`
    );
  }, [userLocation]);

  const branches: { label: string; stations_data: Stop[] }[] = train?.branches ?? [];
  const stops: Stop[] = branches.length > 0
    ? (branches[selectedBranch]?.stations_data ?? [])
    : (train?.stops ?? train?.stations ?? train?.route?.stations ?? []);
  const trainNumber = train?.train_number ?? train?.trainNumber ?? id ?? '';
  const route = train?.route_name ?? train?.route ?? '';
  const operator = train?.operator ?? 'CFR Călători';
  const hasLive = train?.data_source?.has_live_delays === true;

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className="text-gray-500 mt-3">Se încarcă datele…</Text>
      </View>
    );
  }

  if (error && !train?.suggestions) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 px-6">
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text className="text-red-500 text-base mt-3 text-center">{error}</Text>
        <TouchableOpacity className="bg-primary rounded-lg px-6 py-3 mt-4" onPress={load}>
          <Text className="text-white font-semibold">Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (train?.suggestions) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          <View className="bg-white border border-red-100 rounded-lg p-4">
            <Text className="text-red-500 text-center mb-2">{error}</Text>
            <Text className="text-base font-bold text-gray-800 mt-2">Încercați:</Text>
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
        className="flex-1 bg-gray-50"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066CC']} />}
      >
        <View className="pb-10">
          {/* Header */}
          <View className="bg-white border-b border-gray-200 px-4 py-4 flex-row items-center">
            <View className={`${badgeClass(trainNumber)} rounded px-3 py-1.5`}>
              <Text className="text-white font-bold text-base">{trainNumber}</Text>
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-base font-semibold text-gray-900">{route}</Text>
              <Text className="text-xs text-gray-400 mt-1">{operator}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowMap(true)} className="ml-2 p-2" activeOpacity={0.7}>
              <Ionicons name="map-outline" size={22} color="#0066CC" />
            </TouchableOpacity>
          </View>

          {/* Branch selector (only shown when there are multiple branches) */}
          {branches.length > 1 && (
            <View className="bg-white mt-1 px-4 pt-3 pb-1">
              <Text className="text-xs text-gray-400 uppercase mb-2">Selectează ruta</Text>
              <View className="flex-row flex-wrap gap-2">
                {branches.map((b, i) => (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={1}
                    onPress={() => setSelectedBranch(i)}
                    className={`rounded-full px-3 py-1.5 border ${
                      selectedBranch === i
                        ? 'bg-primary border-primary'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text className={`text-xs font-medium ${
                      selectedBranch === i ? 'text-white' : 'text-gray-600'
                    }`}>{b.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Stops */}
          <View className="bg-white mt-1 px-4 py-4">
            <Text className="text-sm font-semibold text-gray-900 mb-4 uppercase">Opriri ({stops.length})</Text>
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
                    {!isFirst && <View className="flex-1 w-0.5 bg-gray-200" />}
                    <View className={`rounded-full bg-primary ${isFirst || isLast ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`} />
                    {!isLast && <View className="flex-1 w-0.5 bg-gray-200" />}
                  </View>

                  {/* Info */}
                  <View className="flex-1 ml-3 py-2">
                    <Text className="text-base font-semibold text-gray-900">{name}</Text>
                    <View className="flex-row gap-3 mt-1">
                      {arr ? <Text className="text-xs text-gray-500">Arr: {arr}</Text> : null}
                      {dep ? <Text className="text-xs text-gray-500">Dep: {dep}</Text> : null}
                      {(delay !== 0 || hasLive) && (
                        <Text className={`text-xs font-bold ${delayTextClass(delay)}`}>
                          {formatDelay(delay)}
                        </Text>
                      )}
                    </View>
                    {stop.platform ? <Text className="text-xs text-gray-400 mt-0.5">Linia {stop.platform}</Text> : null}
                    {stop.observations ? <Text className="text-xs text-yellow-600 mt-0.5 italic">{stop.observations}</Text> : null}
                  </View>
                </View>
              );
            })}
            {stops.length === 0 && (
              <Text className="text-center text-gray-500 py-4">Nu sunt opriri disponibile</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Route Map Modal */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={{ flex: 1 }}>
          {/* Modal header */}
          <View className="bg-white border-b border-gray-200 px-4 flex-row items-center"
                style={{ paddingTop: 52, paddingBottom: 12 }}>
            <Text className="flex-1 text-base font-semibold text-gray-900">Harta rutei · {trainNumber}</Text>
            <TouchableOpacity onPress={() => setShowMap(false)} className="p-1" activeOpacity={0.7}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          {mapHtml ? (
            <WebView
              ref={webviewRef}
              source={{ html: mapHtml }}
              style={{ flex: 1 }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              geolocationEnabled
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
    </>
  );
}
