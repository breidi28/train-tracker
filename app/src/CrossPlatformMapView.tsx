/**
 * CrossPlatformMapView
 *
 * On native: renders react-native-webview (full messaging + JS injection).
 * On web:    renders an <iframe> with srcDoc. Rail-path messages come via
 *            window.addEventListener('message') and user-location is injected
 *            via postMessage into the iframe.
 */
import { useEffect, useRef } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';

// ── types ──────────────────────────────────────────────────────────────────────
export interface MapViewHandle {
    /** Call after mount to push user lat/lon into the map */
    setUserLocation: (lat: number, lon: number) => void;
}

interface Props {
    html: string;
    handleRef?: (handle: MapViewHandle | null) => void;
}

// ── Web implementation ─────────────────────────────────────────────────────────
function WebMapView({ html, handleRef }: Props) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Expose imperative handle so parent can push user location
    useEffect(() => {
        const handle: MapViewHandle = {
            setUserLocation: (lat, lon) => {
                iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ type: 'setUserLocation', lat, lon }),
                    '*'
                );
            },
        };
        handleRef?.(handle);
        return () => handleRef?.(null);
    }, [handleRef]);

    return (
        <iframe
            ref={iframeRef}
            srcDoc={html}
            style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
            sandbox="allow-scripts allow-same-origin"
            title="Route Map"
        />
    );
}

// ── Native implementation ──────────────────────────────────────────────────────
function NativeMapView({ html, handleRef }: Props) {
    // Dynamic import so the web build never bundles react-native-webview
    const WebView = require('react-native-webview').WebView;
    const webviewRef = useRef<any>(null);

    useEffect(() => {
        const handle: MapViewHandle = {
            setUserLocation: (lat, lon) => {
                webviewRef.current?.injectJavaScript(
                    `window.setUserLocation(${lat},${lon});true;`
                );
            },
        };
        handleRef?.(handle);
        return () => handleRef?.(null);
    }, [handleRef]);

    return (
        <WebView
            ref={webviewRef}
            source={{ html }}
            style={{ flex: 1 }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
        />
    );
}

// ── Exported component ─────────────────────────────────────────────────────────
export default function CrossPlatformMapView(props: Props) {
    if (!props.html) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0066CC" />
            </View>
        );
    }

    return Platform.OS === 'web'
        ? <WebMapView {...props} />
        : <NativeMapView {...props} />;
}
