import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { LANGUAGES, storeLanguage, type Language } from '@/i18n';

/** Mirrors `useTheme`: the current value and the one control that moves it on. */
export function useLanguage(): [Language, () => void] {
  const { i18n } = useTranslation();
  const index = (LANGUAGES as readonly string[]).indexOf(i18n.language);
  const language = index === -1 ? 'en' : LANGUAGES[index];

  return [
    language,
    useCallback(() => {
      const next = LANGUAGES[(index + 1) % LANGUAGES.length];

      void i18n.changeLanguage(next);
      storeLanguage(next);
      document.documentElement.lang = next;
    }, [index, i18n]),
  ];
}
