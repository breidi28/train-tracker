/**
 * storage.ts
 * Central AsyncStorage helpers for:
 *   - Recent train searches (Feature 1)
 *   - Per-train delay history snapshots (Feature 9)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Keys ────────────────────────────────────────────────────────────────────
const RECENT_KEY = 'recentSearches';
const HISTORY_KEY = 'delayHistory';
const FAV_TRAINS_KEY = 'favTrains';
const FAV_STATIONS_KEY = 'favStations';
const MAP_ROUTE_KEY = 'mapRouteCache'; // Record<fingerprint, [lat,lon][]>

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecentTrain {
    trainNumber: string;
    routeLabel: string;
    category?: string;          // IR, IC, R…
    searchedAt: string;          // ISO timestamp
}

export interface DelaySnapshot {
    ts: string;   // ISO timestamp of the recording
    delay: number;   // minutes (0 = on time)
}

export interface FavoriteItem {
    id: string;
    label: string;
}

const MAX_RECENT = 8;
const MAX_HISTORY = 48; // keep last 48 snapshots (~2 days if polled every hour)

// ─── Recent searches ─────────────────────────────────────────────────────────

export async function getRecentSearches(): Promise<RecentTrain[]> {
    try {
        const raw = await AsyncStorage.getItem(RECENT_KEY);
        return raw ? (JSON.parse(raw) as RecentTrain[]) : [];
    } catch {
        return [];
    }
}

/**
 * Push a train to the top of the recent list (deduplicates by trainNumber).
 */
export async function recordRecentSearch(train: RecentTrain): Promise<void> {
    try {
        const list = await getRecentSearches();
        const filtered = list.filter(t => t.trainNumber !== train.trainNumber);
        const updated = [train, ...filtered].slice(0, MAX_RECENT);
        await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch { }
}

export async function clearRecentSearches(): Promise<void> {
    await AsyncStorage.removeItem(RECENT_KEY);
}

// ─── Delay history ────────────────────────────────────────────────────────────

async function getRawHistory(): Promise<Record<string, DelaySnapshot[]>> {
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/**
 * Record a new delay reading for a train.
 * Called by pollWatchedTrains() in notifications.ts.
 */
export async function recordDelaySnapshot(
    trainNumber: string,
    delay: number,
): Promise<void> {
    try {
        const all = await getRawHistory();
        const existing = all[trainNumber] ?? [];
        const updated = [
            ...existing,
            { ts: new Date().toISOString(), delay },
        ].slice(-MAX_HISTORY);
        all[trainNumber] = updated;
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    } catch { }
}

/**
 * Get the last N snapshots for display in the delay-history chart.
 */
export async function getDelayHistory(
    trainNumber: string,
    limit = 14,
): Promise<DelaySnapshot[]> {
    try {
        const all = await getRawHistory();
        const history = all[trainNumber] ?? [];
        return history.slice(-limit);
    } catch {
        return [];
    }
}

export async function clearDelayHistory(trainNumber: string): Promise<void> {
    try {
        const all = await getRawHistory();
        delete all[trainNumber];
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    } catch { }
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export async function getFavoriteTrains(): Promise<FavoriteItem[]> {
    try {
        const raw = await AsyncStorage.getItem(FAV_TRAINS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export async function toggleFavoriteTrain(train: FavoriteItem): Promise<boolean> {
    try {
        let list = await getFavoriteTrains();
        const exists = list.find(t => t.id === train.id);
        if (exists) {
            list = list.filter(t => t.id !== train.id);
        } else {
            list.push(train);
        }
        await AsyncStorage.setItem(FAV_TRAINS_KEY, JSON.stringify(list));
        return !exists;
    } catch { return false; }
}

export async function getFavoriteStations(): Promise<FavoriteItem[]> {
    try {
        const raw = await AsyncStorage.getItem(FAV_STATIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export async function toggleFavoriteStation(station: FavoriteItem): Promise<boolean> {
    try {
        let list = await getFavoriteStations();
        const exists = list.find(s => s.id === station.id);
        if (exists) {
            list = list.filter(s => s.id !== station.id);
        } else {
            list.push(station);
        }
        await AsyncStorage.setItem(FAV_STATIONS_KEY, JSON.stringify(list));
        return !exists;
    } catch { return false; }
}
// ─── Map route cache ─────────────────────────────────────────────────────────
// Keyed by a fingerprint of station names (joined with '~').
// Value: the fully-solved Dijkstra rail path as [lat, lon][] array.
// Keeps at most 20 routes to avoid unbounded storage growth.

const MAX_MAP_ROUTES = 20;

async function getRawMapCache(): Promise<Record<string, number[][]>> {
    try {
        const raw = await AsyncStorage.getItem(MAP_ROUTE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

export async function getMapRouteCache(fingerprint: string): Promise<number[][] | null> {
    try {
        const all = await getRawMapCache();
        return all[fingerprint] ?? null;
    } catch { return null; }
}

export async function saveMapRouteCache(fingerprint: string, path: number[][]): Promise<void> {
    try {
        const all = await getRawMapCache();
        all[fingerprint] = path;
        // Evict oldest if over limit
        const keys = Object.keys(all);
        if (keys.length > MAX_MAP_ROUTES) {
            delete all[keys[0]];
        }
        await AsyncStorage.setItem(MAP_ROUTE_KEY, JSON.stringify(all));
    } catch { }
}
