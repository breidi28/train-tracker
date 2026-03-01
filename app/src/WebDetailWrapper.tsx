/**
 * WebDetailWrapper.tsx
 *
 * Wraps detail screens (train/[id], station/[id]) in the same
 * WebLayout shell when running on the browser, so the sidebar stays
 * visible during drill-down navigation.
 *
 * On native this is a transparent pass-through.
 */

import { Platform } from 'react-native';
import WebLayout from './WebLayout';

interface Props {
    children: React.ReactNode;
}

export default function WebDetailWrapper({ children }: Props) {
    if (Platform.OS !== 'web') {
        // Native: render children directly — layout handled by the Stack navigator
        return <>{children}</>;
    }

    // Web: wrap in the sidebar shell
    return <WebLayout>{children}</WebLayout>;
}
