import axios from 'axios';
import Constants from 'expo-constants';

// Auto-detect backend URL:
// On a real device, Expo's debuggerHost gives us the dev machine's IP
// The Flask backend runs on port 5000 on the same machine
function getBaseUrl(): string {
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:5000`;
  }
  return 'http://localhost:5000';
}

export const API_BASE = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// ── Train endpoints ──

export async function fetchTrain(trainId: string, date?: string) {
  const params: Record<string, string> = {};
  if (date) params.date = date;
  const { data } = await api.get(`/api/train/${encodeURIComponent(trainId)}`, { params });
  return data;
}

export async function searchTrains(query: string, date?: string) {
  const params: Record<string, string> = { q: query };
  if (date) params.date = date;
  const { data } = await api.get('/api/search/trains', { params });
  return data;
}

// ── Station endpoints ──

export async function fetchStations() {
  const { data } = await api.get('/api/stations');
  return Array.isArray(data) ? data : [];
}

export async function fetchStationTimetable(stationId: number) {
  const { data } = await api.get(`/station/${stationId}`);
  return data;
}

export async function fetchStationDepartures(stationId: number) {
  // Get full timetable and filter client-side for better reliability
  const { data } = await api.get(`/station/${stationId}`);
  console.log(`[API] Full timetable for station ${stationId}:`, data);
  
  if (!Array.isArray(data)) {
    console.warn(`[API] Timetable response is not an array:`, data);
    return [];
  }
  
  // Check data sources
  const liveCount = data.filter((item: any) => item.data_source === 'iris_live').length;
  const govCount = data.filter((item: any) => item.data_source === 'government_xml').length;
  console.log(`[API] Data sources - IRIS Live: ${liveCount}, Government XML: ${govCount}`);
  
  // Filter for departures: trains that originate here or stop here (have departure time)
  const departures = data.filter((item: any) => 
    item.is_origin || (item.is_stop && item.departure_time)
  );
  console.log(`[API] Filtered ${departures.length} departures from ${data.length} total items`);
  return departures;
}

export async function fetchStationArrivals(stationId: number) {
  // Get full timetable and filter client-side for better reliability
  const { data } = await api.get(`/station/${stationId}`);
  console.log(`[API] Full timetable for station ${stationId}:`, data);
  
  if (!Array.isArray(data)) {
    console.warn(`[API] Timetable response is not an array:`, data);
    return [];
  }
  
  // Filter for arrivals: trains that end here or stop here (have arrival time)
  const arrivals = data.filter((item: any) =>
    item.is_destination || (item.is_stop && item.arrival_time)
  );
  console.log(`[API] Filtered ${arrivals.length} arrivals from ${data.length} total items`);
  return arrivals;
}

// ── Status ──

export async function fetchApiStatus() {
  const { data } = await api.get('/api');
  return data;
}

export default api;
