import type { Locale } from "../../domain/aircraft";
import { translations, type TranslationKey } from "./translations";

export function useI18n(locale: Locale) {
  return {
    t(key: TranslationKey) {
      return translations[locale][key];
    },
  };
}
