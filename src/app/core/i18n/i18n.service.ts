import { Injectable, signal } from '@angular/core';
import { distinctUntilChanged } from 'rxjs';
import { LanguageCode, TRANSLATIONS } from './translations';
import { UserPreferencesService } from '../services/user-preferences.service';
import { AuthApiService } from '../services/auth-api.service';

const LEGACY_STORAGE_KEY = 'app_lang';
const FALLBACK_LANGUAGE: LanguageCode = 'fr';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly language = signal<LanguageCode>(FALLBACK_LANGUAGE);

  constructor(
    private readonly preferences: UserPreferencesService,
    private readonly auth: AuthApiService,
  ) {
    this.language.set(this.getInitialLanguage());
    this.auth.currentUser$
      .pipe(distinctUntilChanged((a, b) => a?.id === b?.id))
      .subscribe(() => {
        this.language.set(this.preferences.getLanguage() ?? FALLBACK_LANGUAGE);
      });
  }

  setLanguage(lang: LanguageCode): void {
    this.language.set(lang);
    this.preferences.setLanguage(lang);
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
    const scoped = this.preferences.getLanguage();
    if (scoped === 'fr' || scoped === 'en') {
      return scoped;
    }

    const saved = this.readLegacyLanguage();
    if (saved === 'fr' || saved === 'en') {
      this.preferences.setLanguage(saved);
      return saved;
    }
    return FALLBACK_LANGUAGE;
  }

  private readLegacyLanguage(): string | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(LEGACY_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
