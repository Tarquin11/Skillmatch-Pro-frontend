import { Injectable, signal } from '@angular/core';
import { LanguageCode, TRANSLATIONS } from './translations';

const STORAGE_KEY = 'app_lang';
const FALLBACK_LANGUAGE: LanguageCode = 'fr';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly language = signal<LanguageCode>(this.getInitialLanguage());

  setLanguage(lang: LanguageCode): void {
    this.language.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  t(key: string): string {
    const lang = this.language();
    const fromLang = TRANSLATIONS[lang]?.[key];
    if (fromLang) return fromLang;

    const fromFallback = TRANSLATIONS[FALLBACK_LANGUAGE]?.[key];
    if (fromFallback) return fromFallback;

    return key;
  }

  private getInitialLanguage(): LanguageCode {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') {
      return saved;
    }
    return FALLBACK_LANGUAGE;
  }
}

