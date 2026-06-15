import { useCallback } from "react";
import type { Locale } from "../../domain/aircraft";
import { translations, type TranslationKey } from "./translations";

export function useI18n(locale: Locale) {
  const t = useCallback((key: TranslationKey) => translations[locale][key], [locale]);

  return {
    t,
  };
}
