import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ro from './locales/ro.json';
import en from './locales/en.json';
import de from './locales/de.json';
import hu from './locales/hu.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';

export const LANGUAGES = [
    { code: 'ro', label: 'Română', flag: '🇷🇴' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'hu', label: 'Magyar', flag: '🇭🇺' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

const LANG_KEY = '@app_language';

/** Persist language to AsyncStorage */
export async function saveLanguage(code: LangCode) {
    await AsyncStorage.setItem(LANG_KEY, code);
}

/** Load persisted language or fall back to device locale */
export async function loadLanguage(): Promise<LangCode> {
    try {
        const stored = await AsyncStorage.getItem(LANG_KEY);
        if (stored && LANGUAGES.find(l => l.code === stored)) {
            return stored as LangCode;
        }
    } catch { }

    // Auto-detect from device
    const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'ro';
    const supported = LANGUAGES.map(l => l.code);
    return (supported.includes(deviceLocale as LangCode) ? deviceLocale : 'ro') as LangCode;
}

export async function initI18n() {
    const lng = await loadLanguage();

    await i18n
        .use(initReactI18next)
        .init({
            resources: {
                ro: { translation: ro },
                en: { translation: en },
                de: { translation: de },
                hu: { translation: hu },
                es: { translation: es },
                fr: { translation: fr },
                nl: { translation: nl },
            },
            lng,
            fallbackLng: 'ro',
            interpolation: { escapeValue: false },
            compatibilityJSON: 'v4',
        });
}

export default i18n;
