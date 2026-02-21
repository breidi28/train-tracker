/**
 * ThemeContext.tsx
 *
 * Provides a reliable app-wide dark/light theme that works in Expo Go.
 * Uses React Context + AsyncStorage instead of Appearance.setColorScheme()
 * (which doesn't consistently trigger re-renders in Expo Go).
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeContextValue {
    dark: boolean;
    themeChoice: ThemeChoice;
    setTheme: (choice: ThemeChoice) => Promise<void>;
}

const THEME_KEY = 'userTheme';

const ThemeContext = createContext<ThemeContextValue>({
    dark: false,
    themeChoice: 'system',
    setTheme: async () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemDark = Appearance.getColorScheme() === 'dark';
    const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
    const [dark, setDark] = useState(systemDark);

    // Restore saved preference on mount
    useEffect(() => {
        AsyncStorage.getItem(THEME_KEY).then((saved) => {
            if (saved === 'dark') {
                setThemeChoice('dark');
                setDark(true);
            } else if (saved === 'light') {
                setThemeChoice('light');
                setDark(false);
            } else {
                setThemeChoice('system');
                setDark(systemDark);
            }
        });
    }, []);

    // When in 'system' mode, follow OS changes
    useEffect(() => {
        if (themeChoice !== 'system') return;
        const sub = Appearance.addChangeListener(({ colorScheme }) => {
            setDark(colorScheme === 'dark');
        });
        return () => sub.remove();
    }, [themeChoice]);

    const setTheme = async (choice: ThemeChoice) => {
        setThemeChoice(choice);
        if (choice === 'dark') {
            setDark(true);
            await AsyncStorage.setItem(THEME_KEY, 'dark');
        } else if (choice === 'light') {
            setDark(false);
            await AsyncStorage.setItem(THEME_KEY, 'light');
        } else {
            setDark(Appearance.getColorScheme() === 'dark');
            await AsyncStorage.removeItem(THEME_KEY);
        }
    };

    return (
        <ThemeContext.Provider value={{ dark, themeChoice, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    return useContext(ThemeContext);
}
