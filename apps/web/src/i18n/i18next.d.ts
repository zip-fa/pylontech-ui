import type { en } from './en';

declare module 'i18next' {
  /** Makes a mistyped key a compile error rather than a raw key rendered into the page. */
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
