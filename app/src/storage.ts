/**
 * storage.ts
 * Central AsyncStorage helpers for:
 *   - Recent train searches (Feature 1)
 *   - Per-train delay history snapshots (Feature 9)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Keys ────────────────────────────────────────────────────────────────────
const RECENT_KEY = 'recentSearches';   // RecentTrain[]
const HISTORY_KEY = 'delayHistory';     // Record<trainNumber, DelaySnapshot[]>

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
