/**
 * notifications.ts
 *
 * Handles scheduling local delay-alert notifications for watched trains.
 * Uses expo-notifications for local notifications and AsyncStorage to
 * persist the set of watched trains between sessions.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchTrain } from './api';
import { recordDelaySnapshot } from './storage';

// ─── Storage keys ────────────────────────────────────────────────────────────
const WATCHED_KEY = 'watchedTrains'; // JSON array of WatchedTrain objects
const LAST_DELAY_KEY = 'lastKnownDelay'; // JSON map: trainNumber → delay (minutes)

// ─── Types ────────────────────────────────────────────────────────────────────
export interface WatchedTrain {
    trainNumber: string;
    /** Human-readable route label, e.g. "București Nord → Cluj" */
    routeLabel: string;
    /** ISO-8601 date the user added this train, e.g. "2025-02-21" */
    addedAt: string;
}

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * Ask the OS for notification permission.
 * Returns true if currently granted (or just granted now).
 */
export async function requestNotificationPermission(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

// ─── Notification channel (Android) ──────────────────────────────────────────

/**
 * Must be called once at app start (e.g., inside _layout.tsx).
 */
export async function setupNotificationChannel() {
    await Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });

    // Android channels
    await Notifications.setNotificationChannelAsync('delay-alerts', {
        name: 'Alerte Întârzieri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        description: 'Notificări despre întârzierile trenurilor urmărite',
    });
}

// ─── Watched trains list ──────────────────────────────────────────────────────

export async function getWatchedTrains(): Promise<WatchedTrain[]> {
    try {
        const raw = await AsyncStorage.getItem(WATCHED_KEY);
        return raw ? (JSON.parse(raw) as WatchedTrain[]) : [];
    } catch {
        return [];
    }
}

export async function isTrainWatched(trainNumber: string): Promise<boolean> {
    const list = await getWatchedTrains();
    return list.some(t => t.trainNumber === trainNumber);
}

export async function addWatchedTrain(train: WatchedTrain): Promise<void> {
    const list = await getWatchedTrains();
    if (list.some(t => t.trainNumber === train.trainNumber)) return; // already watching
    list.push(train);
    await AsyncStorage.setItem(WATCHED_KEY, JSON.stringify(list));
}

export async function removeWatchedTrain(trainNumber: string): Promise<void> {
    const list = await getWatchedTrains();
    const updated = list.filter(t => t.trainNumber !== trainNumber);
    await AsyncStorage.setItem(WATCHED_KEY, JSON.stringify(updated));

    // Clean up saved delay state
    const delayMap = await getLastKnownDelays();
    delete delayMap[trainNumber];
    await AsyncStorage.setItem(LAST_DELAY_KEY, JSON.stringify(delayMap));
}

// ─── Delay tracking ───────────────────────────────────────────────────────────

async function getLastKnownDelays(): Promise<Record<string, number>> {
    try {
        const raw = await AsyncStorage.getItem(LAST_DELAY_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

async function setLastKnownDelay(trainNumber: string, delay: number) {
    const map = await getLastKnownDelays();
    map[trainNumber] = delay;
    await AsyncStorage.setItem(LAST_DELAY_KEY, JSON.stringify(map));
}

// ─── Polling & notification dispatch ─────────────────────────────────────────

/**
 * Poll all watched trains for delay changes. Call this whenever the app
 * comes to the foreground (via AppState listener in _layout.tsx).
 */
export async function pollWatchedTrains(): Promise<void> {
    const watched = await getWatchedTrains();
    if (!watched.length) return;

    const permGranted = await requestNotificationPermission();
    if (!permGranted) return;

    const delayMap = await getLastKnownDelays();

    await Promise.all(
        watched.map(async (wt) => {
            try {
                const data = await fetchTrain(wt.trainNumber);

                // Determine overall delay: max delay across all stops
                const stops: any[] = data?.stops ?? data?.stations ?? [];
                let maxDelay = 0;
                for (const stop of stops) {
                    const d = stop.delay ?? stop.delay_minutes ?? 0;
                    if (d > maxDelay) maxDelay = d;
                }

                const prev = delayMap[wt.trainNumber] ?? 0;

                // Record snapshot for the history chart regardless
                await recordDelaySnapshot(wt.trainNumber, maxDelay);

                // Fire a notification if:
                // 1. The delay has increased by ≥ 5 minutes compared to last check, OR
                // 2. The delay has gone from non-zero to zero (train recovered)
                if (maxDelay >= prev + 5 || (prev > 0 && maxDelay === 0)) {
                    await fireDelayNotification(wt, maxDelay);
                }

                await setLastKnownDelay(wt.trainNumber, maxDelay);
            } catch {
                // Network error — silently skip this train
            }
        })
    );
}

async function fireDelayNotification(wt: WatchedTrain, delayMinutes: number) {
    const title =
        delayMinutes === 0
            ? `✅ ${wt.trainNumber} a recuperat întârzierea`
            : `⚠️ ${wt.trainNumber} — întârziere ${delayMinutes} min`;

    const body =
        delayMinutes === 0
            ? `Trenul ${wt.trainNumber} (${wt.routeLabel}) circulă la timp.`
            : `Trenul ${wt.trainNumber} (${wt.routeLabel}) are o întârziere de ${delayMinutes} minute.`;

    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
            data: { trainNumber: wt.trainNumber },
        },
        trigger: null, // fire immediately
    });
}
