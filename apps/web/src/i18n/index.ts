import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './en';
import { uk } from './uk';

export const LANGUAGES = ['en', 'uk'] as const;

export type Language = (typeof LANGUAGES)[number];

/** What the toggle prints, and what a screen reader announces for the language it switches to. */
export const LANGUAGE_NAMES: Record<Language, { short: string; name: string }> =
  {
    en: { short: 'EN', name: 'English' },
    uk: { short: 'UA', name: 'Українська' },
  };

const STORAGE_KEY = 'pylontech-lang';

function isLanguage(value: string | undefined | null): value is Language {
  return (LANGUAGES as readonly string[]).includes(value ?? '');
}

export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* private mode: the choice simply does not outlive the tab */
  }
}

function readStored(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/** A stored choice wins; otherwise the browser's own order decides, and English is the floor. */
function initialLanguage(): Language {
  const stored = readStored();

  if (stored) {
    return stored;
  }

  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0];

    if (isLanguage(base)) {
      return base;
    }
  }

  return 'en';
}

// Resources are bundled rather than fetched: the daemon may be running on an island network with
// no route off it, and a half-translated page is worse than a slightly larger bundle.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, uk: { translation: uk } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;

export { i18n };
