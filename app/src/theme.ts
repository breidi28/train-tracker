export const COLORS = {
  primary: '#0066CC',
  primaryDark: '#004C99',
  primaryLight: '#E3F0FF',
  accent: '#FF9800',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#666',
  textLight: '#999',
  border: '#E0E0E0',
  white: '#FFFFFF',
};

export const TRAIN_TYPE_COLORS: Record<string, string> = {
  IC: '#E53935',
  IR: '#1E88E5',
  R: '#43A047',
  'R-E': '#8E24AA',
  default: '#757575',
};

export function trainColor(trainNumber: string): string {
  const prefix = trainNumber.split(/\s|\d/)[0]?.toUpperCase() ?? '';
  return TRAIN_TYPE_COLORS[prefix] || TRAIN_TYPE_COLORS.default;
}

export function formatDelay(minutes: number | undefined | null): string {
  if (!minutes || minutes === 0) return 'La timp';
  if (minutes > 0) return `+${minutes} min`;
  return `${minutes} min`;
}

export function delayColor(minutes: number | undefined | null): string {
  if (!minutes || minutes === 0) return COLORS.success;
  if (minutes <= 5) return COLORS.warning;
  return COLORS.error;
}
