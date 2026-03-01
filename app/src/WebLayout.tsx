/**
 * WebLayout.tsx  —  Responsive web shell
 *
 * • ≥ 768 px  →  sticky top nav bar (desktop/tablet experience)
 * • <  768 px  →  bottom tab bar  (native-identical mobile experience)
 *
 * The breakpoint is detected with useWindowDimensions so it reacts live
 * when the browser window is resized.
 */

import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useTranslation } from 'react-i18next';

// ─── Brand tokens ──────────────────────────────────────────────────────────
const BRAND_BLUE = '#0066CC';
const BRAND_BG = '#F5F6F8';
const BRAND_CARD = '#FFFFFF';
const BRAND_BORDER = '#E4E4E4';

const MOBILE_BP = 768;   // px — below this we switch to the mobile layout
const TOPNAV_H = 60;
const BOTNAV_H = 56;

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
    { href: '/mytrains', labelKey: 'tabs.trains', icon: 'star-outline', iconActive: 'star' },
    { href: '/stations', labelKey: 'tabs.stations', icon: 'location-outline', iconActive: 'location' },
    { href: '/settings', labelKey: 'tabs.settings', icon: 'settings-outline', iconActive: 'settings' },
];

// ─── Active href helper ───────────────────────────────────────────────────────
function useActiveHref(pathname: string): string {
    return NAV_ITEMS
        .slice()
        .reverse()
        .find(item =>
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
        )?.href ?? '/';
}

// ─── Desktop top nav ──────────────────────────────────────────────────────────
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
            {/* Logo */}
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

            {/* Nav links */}
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
                                active && { borderBottomColor: BRAND_BLUE, borderBottomWidth: 3 },
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

// ─── Mobile bottom tab bar ────────────────────────────────────────────────────
function BottomTabBar({ activeHref }: { activeHref: string }) {
    const router = useRouter();
    const { dark } = useTheme();
    const { t } = useTranslation();

    const tabBg = dark ? '#111827' : '#ffffff';
    const border = dark ? '#1F2937' : '#E5E7EB';
    const active = BRAND_BLUE;
    const inactive = dark ? '#6B7280' : '#9CA3AF';

    return (
        <View style={[styles.bottomTab, { backgroundColor: tabBg, borderTopColor: border }]}>
            {NAV_ITEMS.map(item => {
                const isActive = activeHref === item.href;
                const color = isActive ? active : inactive;
                return (
                    <TouchableOpacity
                        key={item.href}
                        onPress={() => router.push(item.href as any)}
                        activeOpacity={0.7}
                        style={styles.bottomTabItem}
                    >
                        <Ionicons
                            name={isActive ? item.iconActive : item.icon}
                            size={22}
                            color={color}
                        />
                        <Text style={[styles.bottomTabLabel, { color, fontWeight: isActive ? '700' : '500' }]}>
                            {t(item.labelKey)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function WebLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { dark } = useTheme();
    const { width } = useWindowDimensions();
    const isMobile = width < MOBILE_BP;

    const pageBg = dark ? '#0D1117' : BRAND_BG;
    const activeHref = useActiveHref(pathname);

    if (isMobile) {
        // ── Mobile web: no top bar, content fills full width, bottom tab bar ──
        return (
            <View style={[styles.shellMobile, { backgroundColor: pageBg }]}>
                {/* Scrollable content area */}
                <View style={styles.mobileContent}>
                    {children}
                </View>

                {/* Bottom tab bar (matches native look exactly) */}
                <BottomTabBar activeHref={activeHref} />
            </View>
        );
    }

    // ── Desktop web: sticky top nav + centred content column ──────────────────
    return (
        <View style={[styles.shell, { backgroundColor: pageBg }]}>
            <TopNav activeHref={activeHref} />
            <View style={styles.pageBody}>
                <View style={styles.contentCol}>
                    {children}
                </View>
            </View>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

    // ── Desktop shell
    shell: {
        flex: 1,
        minHeight: '100vh' as any,
        flexDirection: 'column',
    },
    pageBody: {
        flex: 1,
        alignItems: 'center',
        paddingBottom: 40,
        minHeight: `calc(100vh - ${TOPNAV_H}px)` as any,
    },
    contentCol: {
        width: '100%' as any,
        maxWidth: 1100,
        flex: 1,
    },

    // ── Desktop top nav
    topNav: {
        height: TOPNAV_H,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 32,
        borderBottomWidth: 1,
        position: 'sticky' as any,
        top: 0,
        zIndex: 100,
        ...Platform.select({
            web: { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } as any,
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
    },
    navLinkText: {
        fontSize: 13,
    },

    // ── Mobile shell
    shellMobile: {
        flex: 1,
        minHeight: '100vh' as any,
        flexDirection: 'column',
    },
    mobileContent: {
        flex: 1,
        // Content takes all space above the bottom nav
        marginBottom: BOTNAV_H,
    },

    // ── Bottom tab bar (mirrors native _layout.tsx style)
    bottomTab: {
        height: BOTNAV_H,
        flexDirection: 'row',
        borderTopWidth: 1,
        position: 'fixed' as any,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        ...Platform.select({
            web: { boxShadow: '0 -1px 6px rgba(0,0,0,0.06)' } as any,
        }),
    },
    bottomTabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    bottomTabLabel: {
        fontSize: 10,
        marginTop: 2,
    },
});
