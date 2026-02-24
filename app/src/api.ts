import axios from 'axios';
import Constants from 'expo-constants';

// ── Set this to your Render URL once deployed ────────────────────────────────
// Leave empty ('') to use the local dev server auto-detection below.
const RENDER_API_URL = 'https://cfr-iris-scraper.onrender.com';
// ─────────────────────────────────────────────────────────────────────────────

// Auto-detect backend URL in local dev:
// On a real device, Expo's debuggerHost gives us the dev machine's IP
function getBaseUrl(): string {
  if (RENDER_API_URL) return RENDER_API_URL;
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

export async function fetchTrainComposition(trainId: string) {
  const { data } = await api.get(`/api/train/${encodeURIComponent(trainId)}/composition`);
  return data;
}

// ── Station endpoints ──

let cachedStations: any[] | null = null;

export async function fetchStations() {
  if (cachedStations) return cachedStations;
  const { data } = await api.get('/api/stations');
  if (Array.isArray(data)) {
    cachedStations = data;
    return cachedStations;
  }
  return [];
}

export async function searchStations(query: string) {
  const { data } = await api.get(`/api/stations/search/${encodeURIComponent(query)}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchStationTimetable(stationId: number) {
  const { data } = await api.get(`/station/${stationId}`);
  return data;
}


// ── Status ──

export async function fetchApiStatus() {
  const { data } = await api.get('/api');
  return data;
}

// ── Reports ──

export async function fetchTrainReports(trainId: string) {
  const { data } = await api.get(`/api/train/${encodeURIComponent(trainId)}/reports`);
  return data;
}

export async function submitTrainReport(trainId: string, reportType: string, message: string) {
  const { data } = await api.post(`/api/train/${encodeURIComponent(trainId)}/reports`, {
    report_type: reportType,
    message,
  });
  return data;
}

export default api;
