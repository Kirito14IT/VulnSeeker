import 'i18next';
import en from './locales/en.json';

type LooseTranslation = typeof en & Record<string, string>;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: LooseTranslation;
    };
  }
}
