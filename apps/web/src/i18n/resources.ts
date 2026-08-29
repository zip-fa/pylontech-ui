import type { en } from './en';

/**
 * Every form `Intl.PluralRules` can name. A key ending in one of these is a plural family, not a
 * key in its own right, so each locale supplies the forms its own grammar needs — English two,
 * Ukrainian four — without either shape being written into the other's type.
 */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type Stem<K> = K extends `${infer S}_${PluralSuffix}` ? S : never;

type Singular<K> = K extends `${string}_${PluralSuffix}` ? never : K;

type Translated<T> = {
  [K in Extract<keyof T, string> as Singular<K>]: T[K] extends string
    ? string
    : Translated<T[K]>;
} & {
  // `other` is the form i18next falls back to, and every locale has a `one`.
  [K in Stem<Extract<keyof T, string>> as `${K}_one` | `${K}_other`]: string;
} & {
  [
    K in Stem<Extract<keyof T, string>> as
      `${K}_zero` | `${K}_two` | `${K}_few` | `${K}_many`
  ]?: string;
};

/** The shape a locale must fill. English is the definition; the others are checked against it. */
export type Resources = Translated<typeof en>;
