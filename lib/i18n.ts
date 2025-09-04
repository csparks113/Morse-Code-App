import en from '../constants/locales/en.json';
import es from '../constants/locales/es.json';
import fr from '../constants/locales/fr.json';
import de from '../constants/locales/de.json';
import { useSettingsStore } from '../store/useSettingsStore';

const bundles = { en, es, fr, de } as const;

export function t(key: keyof typeof en): string {
  const lang = useSettingsStore.getState().language;
  const dict = (bundles as any)[lang] ?? en;
  return (dict as any)[key] ?? (en as any)[key] ?? String(key);
}
