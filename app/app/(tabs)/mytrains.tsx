/**
 * mytrains.tsx  — "Trenurile mele" tab
 *
 * Shows:
 *  • Watched trains (subscribed to delay alerts) with live delay badge
 *  • Recent searches with a quick "re-open" action
 */
import { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWatchedTrains, removeWatchedTrain, type WatchedTrain } from '../../src/notifications';
import { getRecentSearches, clearRecentSearches, type RecentTrain } from '../../src/storage';
import { fetchTrain } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    IC: '#DC2626', IR: '#2563EB', R: '#16A34A', 'R-E': '#7C3AED',
};
function categoryColor(trainNumber: string) {
    const p = trainNumber.split(/[\s\d]/)[0]?.toUpperCase() ?? '';
    return CATEGORY_COLORS[p] ?? '#4B5563';
}

function delayLabel(min: number): string {
    if (min === 0) return 'La timp';
    return `+${min} min`;
}
function delayColor(min: number): string {
    if (min === 0) return '#16A34A';
    if (min <= 5) return '#D97706';
    return '#DC2626';
}

// ─── Watched train row with live delay fetching ───────────────────────────────
function WatchedRow({
    wt, dark, onRemove,
}: { wt: WatchedTrain; dark: boolean; onRemove: () => void }) {
    const router = useRouter();
    const [delay, setDelay] = useState<number | null>(null);
    const [fetching, setFetching] = useState(true);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setFetching(true);
                try {
                    const data = await fetchTrain(wt.trainNumber);
                    const stops = data?.stops ?? data?.stations ?? [];
                    const max = stops.reduce(
                        (acc: number, s: any) => Math.max(acc, s.delay ?? s.delay_minutes ?? 0),
                        0
                    );
                    if (!cancelled) setDelay(max);
                } catch {
                    if (!cancelled) setDelay(null);
                } finally {
                    if (!cancelled) setFetching(false);
                }
            })();
            return () => { cancelled = true; };
        }, [wt.trainNumber])
    );

    const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
    const headTxt = dark ? 'text-white' : 'text-gray-900';
    const subTxt = dark ? 'text-gray-400' : 'text-gray-500';

    return (
        <View className={`border rounded-2xl mb-3 overflow-hidden ${card}`}>
            <TouchableOpacity
                className="px-4 py-4 flex-row items-center"
                onPress={() => router.push(`/train/${encodeURIComponent(wt.trainNumber)}`)}
                activeOpacity={0.7}
            >
                {/* Category dot / badge */}
                <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: categoryColor(wt.trainNumber) + '22' }}
                >
                    <Ionicons name="train" size={18} color={categoryColor(wt.trainNumber)} />
                </View>

                <View className="flex-1">
                    <Text className={`text-base font-bold ${headTxt}`}>{wt.trainNumber}</Text>
                    <Text className={`text-xs mt-0.5 ${subTxt}`} numberOfLines={1}>{wt.routeLabel}</Text>
                    <Text className={`text-xs mt-1 ${subTxt}`}>Adăugat: {wt.addedAt}</Text>
                </View>

                {/* Live delay badge */}
                <View className="items-end ml-2">
                    {fetching ? (
                        <ActivityIndicator size="small" color="#0066CC" />
                    ) : delay === null ? (
                        <Ionicons name="cloud-offline-outline" size={18} color={dark ? '#6B7280' : '#9CA3AF'} />
                    ) : (
                        <View
                            className="px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: delayColor(delay) + '22' }}
                        >
                            <Text className="text-xs font-bold" style={{ color: delayColor(delay) }}>
                                {delayLabel(delay)}
                            </Text>
                        </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={dark ? '#4B5563' : '#D1D5DB'} style={{ marginTop: 6 }} />
                </View>
            </TouchableOpacity>

            {/* Remove button */}
            <TouchableOpacity
                className={`px-4 py-2.5 border-t flex-row items-center ${dark ? 'border-gray-800' : 'border-gray-100'}`}
                onPress={onRemove}
                activeOpacity={0.7}
            >
                <Ionicons name="notifications-off-outline" size={14} color={dark ? '#6B7280' : '#9CA3AF'} />
                <Text className={`text-xs ml-1.5 ${subTxt}`}>Dezactivează alertele</Text>
            </TouchableOpacity>
        </View>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function MyTrainsScreen() {
    const router = useRouter();
    const { dark } = useTheme();

    const [watched, setWatched] = useState<WatchedTrain[]>([]);
    const [recents, setRecents] = useState<RecentTrain[]>([]);

    const bg = dark ? 'bg-gray-950' : 'bg-gray-50';
    const card = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
    const headTxt = dark ? 'text-white' : 'text-gray-900';
    const subTxt = dark ? 'text-gray-400' : 'text-gray-500';

    useFocusEffect(
        useCallback(() => {
            getWatchedTrains().then(setWatched);
            getRecentSearches().then(setRecents);
        }, [])
    );

    const handleRemoveWatched = async (trainNumber: string) => {
        Alert.alert(
            'Oprește alertele',
            `Oprești notificările de întârziere pentru ${trainNumber}?`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Oprește',
                    style: 'destructive',
                    onPress: async () => {
                        await removeWatchedTrain(trainNumber);
                        setWatched(prev => prev.filter(t => t.trainNumber !== trainNumber));
                    },
                },
            ]
        );
    };

    const handleClearRecents = async () => {
        await clearRecentSearches();
        setRecents([]);
    };

    return (
        <ScrollView className={`flex-1 ${bg}`} contentContainerStyle={{ paddingBottom: 32 }}>

            {/* ── Watched trains ────────────────────────────────────────────── */}
            <View className="px-4 mt-4">
                <View className="flex-row items-center mb-3">
                    <Ionicons name="notifications" size={16} color="#F59E0B" />
                    <Text className={`text-xs font-bold tracking-widest ml-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                        TRENURI URMĂRITE
                    </Text>
                </View>

                {watched.length === 0 ? (
                    <View className={`border rounded-2xl p-6 items-center ${card}`}>
                        <Ionicons name="notifications-off-outline" size={40} color={dark ? '#4B5563' : '#D1D5DB'} />
                        <Text className={`text-sm font-semibold mt-3 ${headTxt}`}>Niciun tren urmărit</Text>
                        <Text className={`text-xs text-center mt-1 ${subTxt}`}>
                            Deschide un tren și apasă 🔔 pentru a primi alerte de întârziere
                        </Text>
                    </View>
                ) : (
                    watched.map(wt => (
                        <WatchedRow
                            key={wt.trainNumber}
                            wt={wt}
                            dark={dark}
                            onRemove={() => handleRemoveWatched(wt.trainNumber)}
                        />
                    ))
                )}
            </View>

            {/* ── Recent searches ───────────────────────────────────────────── */}
            <View className="px-4 mt-5">
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color={dark ? '#6B7280' : '#9CA3AF'} />
                        <Text className={`text-xs font-bold tracking-widest ml-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                            CĂUTĂRI RECENTE
                        </Text>
                    </View>
                    {recents.length > 0 && (
                        <TouchableOpacity onPress={handleClearRecents} activeOpacity={0.7}>
                            <Text className="text-primary text-xs font-semibold">Șterge tot</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {recents.length === 0 ? (
                    <View className={`border rounded-2xl p-6 items-center ${card}`}>
                        <Ionicons name="search-outline" size={40} color={dark ? '#4B5563' : '#D1D5DB'} />
                        <Text className={`text-sm font-semibold mt-3 ${headTxt}`}>Nicio căutare recentă</Text>
                        <Text className={`text-xs text-center mt-1 ${subTxt}`}>
                            Caută un tren și va apărea aici
                        </Text>
                    </View>
                ) : (
                    <View className={`border rounded-2xl overflow-hidden ${card}`}>
                        {recents.map((t, i) => (
                            <TouchableOpacity
                                key={`${t.trainNumber}-${i}`}
                                className={`px-4 py-3 flex-row items-center ${i < recents.length - 1 ? `border-b ${dark ? 'border-gray-800' : 'border-gray-100'}` : ''
                                    }`}
                                onPress={() => router.push(`/train/${encodeURIComponent(t.trainNumber)}`)}
                                activeOpacity={0.6}
                            >
                                <View
                                    className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                                    style={{ backgroundColor: categoryColor(t.trainNumber) + '22' }}
                                >
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: categoryColor(t.trainNumber) }}>
                                        {t.trainNumber.split(/[\s\d]/)[0] || '—'}
                                    </Text>
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-sm font-bold ${headTxt}`}>{t.trainNumber}</Text>
                                    {t.routeLabel ? (
                                        <Text className={`text-xs mt-0.5 ${subTxt}`} numberOfLines={1}>{t.routeLabel}</Text>
                                    ) : null}
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={dark ? '#4B5563' : '#D1D5DB'} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

        </ScrollView>
    );
}
