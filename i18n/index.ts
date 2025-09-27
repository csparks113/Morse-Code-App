import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const LANGUAGE_STORAGE_KEY = 'settings.language';

const resources = {
  en: {
    common: require('./resources/en/common.json'),
    lessons: require('./resources/en/lessons.json'),
    session: require('./resources/en/session.json'),
    practice: require('./resources/en/practice.json'),
    settings: require('./resources/en/settings.json'),
  },
  zz: {
    common: require('./resources/zz/common.json'),
    lessons: require('./resources/zz/lessons.json'),
    session: require('./resources/zz/session.json'),
    practice: require('./resources/zz/practice.json'),
    settings: require('./resources/zz/settings.json'),
  },
} as const;

export type SupportedLanguage =
  | keyof typeof resources
  | 'system'
  | 'en-US'
  | 'en-GB'
  | 'es'
  | 'de'
  | 'fr';

export type LanguageOption = { value: SupportedLanguage; labelKey: string };

let initPromise: Promise<void> | null = null;

function resolveSystemLanguage(): string {
  const locales = Localization.getLocales?.();
  if (Array.isArray(locales) && locales.length > 0) {
    return locales[0]?.languageTag ?? 'en';
  }
  // Fallback for older expo-localization versions
  return (Localization as any)?.locale ?? 'en';
}

function normalizeLanguageTag(tag: string | null | undefined): string {
  if (!tag) return 'en';
  const [language] = tag.split('-');
  return language || 'en';
}

async function determineInitialLanguage(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && stored !== 'system') {
      return stored;
    }
    return normalizeLanguageTag(resolveSystemLanguage());
  } catch {
    return normalizeLanguageTag(resolveSystemLanguage());
  }
}

export function getAvailableLanguages(): LanguageOption[] {
  return [
    { value: 'system', labelKey: 'settings:systemDefault' },
    { value: 'en', labelKey: 'settings:english' },
    { value: 'es', labelKey: 'settings:spanish' },
    { value: 'de', labelKey: 'settings:german' },
    { value: 'fr', labelKey: 'settings:french' },
    { value: 'zz', labelKey: 'settings:pseudo' },
  ];
}

export async function initI18n(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const initialLanguage = await determineInitialLanguage();

    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v4',
        resources,
        lng: initialLanguage,
        fallbackLng: 'en',
        load: 'languageOnly',
        supportedLngs: ['en', 'zz', 'es', 'de', 'fr'],
        defaultNS: 'common',
        ns: ['common', 'lessons', 'session', 'practice', 'settings'],
        returnNull: false,
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
      });
  })();

  return initPromise;
}

export async function setLanguage(language: SupportedLanguage): Promise<void> {
  if (language === 'system') {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'system');
    const systemLanguage = normalizeLanguageTag(resolveSystemLanguage());
    await i18n.changeLanguage(systemLanguage);
    return;
  }

  const normalized = normalizeLanguageTag(language);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(normalized);
}

export async function getStoredLanguage(): Promise<SupportedLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return (stored ?? 'system') as SupportedLanguage;
  } catch {
    return 'system';
  }
}

export default i18n;
