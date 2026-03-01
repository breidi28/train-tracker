/**
 * WebLayout.tsx  —  NS-inspired desktop shell
 *
 * Renders a desktop-optimised shell for the Expo web build:
 *   • Fixed top navigation bar (white, NS-style)
 *   • Full-width yellow hero strip below nav (for tab pages)
 *   • Centred content column (max 1100px)
 *   • Light grey page background  (#F2F2F2)
 *
 * On mobile (iOS / Android) this component is never mounted —
 * the native bottom-tab layout is used instead.
 */

import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useTranslation } from 'react-i18next';

// ─── Brand tokens ──────────────────────────────────────────────────────────
const BRAND_BLUE = '#0066CC';
const BRAND_ACCENT = '#0066CC';
const BRAND_BG = '#F5F6F8';      // page background
const BRAND_CARD = '#FFFFFF';
const BRAND_BORDER = '#E4E4E4';

// ─── Nav items ────────────────────────────────────────────────────────────────
interface NavItem {
    href: string;
    labelKey: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    iconActive: React.ComponentProps<typeof Ionicons>['name'];
}

const NAV_ITEMS: NavItem[] = [
    { href: '/', labelKey: 'tabs.home', icon: 'home-outline', iconActive: 'home' },
    { href: '/search', labelKey: 'tabs.search', icon: 'search-outline', iconActive: 'search' },
    { href: '/mytrains', labelKey: 'tabs.trains', icon: 'heart-outline', iconActive: 'heart' },
    { href: '/stations', labelKey: 'tabs.stations', icon: 'train-outline', iconActive: 'train' },
    { href: '/settings', labelKey: 'tabs.settings', icon: 'settings-outline', iconActive: 'settings' },
];

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav({ activeHref }: { activeHref: string }) {
    const router = useRouter();
    const { dark } = useTheme();
    const { t } = useTranslation();

    const navBg = dark ? '#0A1628' : BRAND_CARD;
    const border = dark ? '#1A2D50' : BRAND_BORDER;
    const logoTxt = dark ? '#FFFFFF' : BRAND_BLUE;
    const subTxt = dark ? '#94A3B8' : '#64748B';

    return (
        <View style={[styles.topNav, { backgroundColor: navBg, borderBottomColor: border }]}>
            {/* Left: Logo */}
            <TouchableOpacity
                onPress={() => router.push('/' as any)}
                activeOpacity={0.8}
                style={styles.logoWrap}
            >
                <View style={styles.logoIcon}>
                    <Ionicons name="train" size={18} color="#fff" />
                </View>
                <View>
                    <Text style={[styles.logoTitle, { color: logoTxt }]}>CFR Tracker</Text>
                    <Text style={[styles.logoSub, { color: subTxt }]}>Trenul tău, la timp</Text>
                </View>
            </TouchableOpacity>

            {/* Centre/Right: Navigation links */}
            <View style={styles.navLinks}>
                {NAV_ITEMS.map(item => {
                    const active = activeHref === item.href;
                    const linkColor = active ? BRAND_BLUE : (dark ? '#94A3B8' : '#4B5563');
                    return (
                        <TouchableOpacity
                            key={item.href}
                            onPress={() => router.push(item.href as any)}
                            activeOpacity={0.75}
                            style={[
                                styles.navLink,
                                active && {
                                    borderBottomColor: BRAND_ACCENT,
                                    borderBottomWidth: 3,
                                },
                            ]}
                        >
                            <Ionicons
                                name={active ? item.iconActive : item.icon}
                                size={15}
                                color={linkColor}
                                style={{ marginRight: 5 }}
                            />
                            <Text style={[styles.navLinkText, { color: linkColor, fontWeight: active ? '700' : '500' }]}>
                                {t(item.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function WebLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { dark } = useTheme();

    const pageBg = dark ? '#0D1117' : BRAND_BG;

    // Active nav detection (longest match wins)
    const activeHref = NAV_ITEMS
        .slice()
        .reverse()
        .find(item =>
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
        )?.href ?? '/';

    return (
        <View style={[styles.shell, { backgroundColor: pageBg }]}>
            {/* ── Top navigation bar ──────────────────────────────────────── */}
            <TopNav activeHref={activeHref} />

            {/* ── Page content centred at max 1100px ─────────────────────── */}
            <View style={styles.pageBody}>
                <View style={styles.contentCol}>
                    {children}
                </View>
            </View>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TOPNAV_H = 60;

const styles = StyleSheet.create({
    shell: {
        flex: 1,
        minHeight: '100vh' as any,
        flexDirection: 'column',
    },

    // ── Top nav
    topNav: {
        height: TOPNAV_H,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 32,
        borderBottomWidth: 1,
        // sticky
        position: 'sticky' as any,
        top: 0,
        zIndex: 100,
        // subtle shadow
        ...Platform.select({
            web: {
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            } as any,
        }),
    },

    logoWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginRight: 40,
    },
    logoIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: BRAND_BLUE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoTitle: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    logoSub: {
        fontSize: 10,
        marginTop: 1,
    },

    navLinks: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 4,
        flex: 1,
        height: TOPNAV_H,
    },
    navLink: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        height: TOPNAV_H,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
        // hover handled by CSS in global.css
    },
    navLinkText: {
        fontSize: 13,
    },

    // ── Page body
    pageBody: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 40,
        minHeight: `calc(100vh - ${TOPNAV_H}px)` as any,
    },
    contentCol: {
        width: '100%' as any,
        maxWidth: 1100,
        flex: 1,
    },
});
