import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { API_BASE, fetchApiStatus } from '../../src/api';

export default function SettingsScreen() {
  const [status, setStatus] = useState('Se verifică…');
  const [statusOk, setStatusOk] = useState<boolean | null>(null);

  const checkConnection = async () => {
    setStatus('Se verifică…');
    setStatusOk(null);
    try {
      const data = await fetchApiStatus();
      setStatus(data.status ?? 'Conectat');
      setStatusOk(true);
    } catch {
      setStatus('Nu se poate conecta');
      setStatusOk(false);
    }
  };

  useEffect(() => { checkConnection(); }, []);

  const dotColor = statusOk === true ? 'bg-green-500' : statusOk === false ? 'bg-red-500' : 'bg-yellow-500';

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="pb-8">
        {/* Connection card */}
        <View className="bg-white border-b border-gray-200 px-4 py-4 mb-1">
          <Text className="text-sm font-semibold text-gray-900 mb-3 uppercase">Conexiune Backend</Text>
          <Text className="text-sm text-gray-500 mb-3 font-mono">{API_BASE}</Text>
          <View className="flex-row items-center mb-4">
            <View className={`w-2.5 h-2.5 rounded-full mr-2 ${dotColor}`} />
            <Text className="text-sm text-gray-700">{status}</Text>
          </View>
          <TouchableOpacity
            className="bg-primary rounded-lg py-3 items-center"
            onPress={checkConnection}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">VERIFICĂ DIN NOU</Text>
          </TouchableOpacity>
        </View>

        {/* About card */}
        <View className="bg-white border-b border-gray-200 px-4 py-4">
          <Text className="text-sm font-semibold text-gray-900 mb-3 uppercase">Despre</Text>
          <Text className="text-sm text-gray-500 mb-2 font-medium">Trenul Meu v1.0</Text>
          <Text className="text-sm text-gray-500 leading-5">
            Aplicație pentru urmărirea trenurilor CFR Călători în timp real.
            Datele provin din surse oficiale (data.gov.ro).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
