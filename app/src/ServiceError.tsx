/**
 * ServiceError
 *
 * A full-screen (or inline) error banner that maps structured API error codes
 * to human-readable titles, bodies, and icons so users know what went wrong
 * and what to do about it.
 */

import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ApiErrorCode } from './api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ErrorConfig {
  icon: IconName;
  iconColor: string;
  titleKey: string;
  bodyKey: string;
}

const CONFIG: Record<ApiErrorCode, ErrorConfig> = {
  service_down: {
    icon: 'cloud-offline-outline',
    iconColor: '#F59E0B',
    titleKey: 'errors.serviceDownTitle',
    bodyKey: 'errors.serviceDownBody',
  },
  timeout: {
    icon: 'timer-outline',
    iconColor: '#F59E0B',
    titleKey: 'errors.timeoutTitle',
    bodyKey: 'errors.timeoutBody',
  },
  not_found: {
    icon: 'search-outline',
    iconColor: '#6B7280',
    titleKey: 'errors.notFoundTitle',
    bodyKey: 'errors.notFoundTrainBody',
  },
  server_error: {
    icon: 'warning-outline',
    iconColor: '#EF4444',
    titleKey: 'errors.serverErrorTitle',
    bodyKey: 'errors.serverErrorBody',
  },
  network_error: {
    icon: 'wifi-outline',
    iconColor: '#EF4444',
    titleKey: 'errors.networkTitle',
    bodyKey: 'errors.networkBody',
  },
  unknown: {
    icon: 'alert-circle-outline',
    iconColor: '#EF4444',
    titleKey: 'common.error',
    bodyKey: 'errors.serverErrorBody',
  },
};

interface Props {
  errorCode: ApiErrorCode | null;
  /** Fallback raw message when no structured code is available */
  rawMessage?: string;
  /** Pass 'station' to swap the not_found body to the station variant */
  context?: 'train' | 'station';
  dark: boolean;
  onRetry: () => void;
}

export default function ServiceError({ errorCode, rawMessage, context = 'train', dark, onRetry }: Props) {
  const { t } = useTranslation();

  const code: ApiErrorCode = errorCode ?? 'unknown';
  const cfg = CONFIG[code];

  // Choose the right not-found body based on context
  const bodyKey =
    code === 'not_found' && context === 'station'
      ? 'errors.notFoundStationBody'
      : cfg.bodyKey;

  const title = t(cfg.titleKey);
  const body = rawMessage && code === 'unknown' ? rawMessage : t(bodyKey);

  const bg = dark ? '#030712' : '#F9FAFB';
  const cardBg = dark ? '#111827' : '#FFFFFF';
  const cardBorder = dark ? '#1F2937' : '#E5E7EB';
  const headColor = dark ? '#F9FAFB' : '#111827';
  const subColor = dark ? '#9CA3AF' : '#6B7280';

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg, paddingHorizontal: 24 }}>
      {/* Card */}
      <View style={{
        width: '100%',
        maxWidth: 380,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: cardBorder,
        backgroundColor: cardBg,
        padding: 28,
        alignItems: 'center',
      }}>
        {/* Icon */}
        <View style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: dark ? '#1F2937' : '#F3F4F6',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <Ionicons name={cfg.icon} size={36} color={cfg.iconColor} />
        </View>

        {/* Title */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: headColor, textAlign: 'center', marginBottom: 10 }}>
          {title}
        </Text>

        {/* Body */}
        <Text style={{ fontSize: 14, color: subColor, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
          {body}
        </Text>

        {/* Retry button */}
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#0066CC',
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 32,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="refresh-outline" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            {t('common.retry')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Subtle hint for service_down / timeout */}
      {(code === 'service_down' || code === 'timeout') && (
        <Text style={{ marginTop: 16, fontSize: 12, color: subColor, textAlign: 'center' }}>
          {t('errors.retryLater')}
        </Text>
      )}
    </View>
  );
}
