import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthApiService } from './core/services/auth-api.service';
import { TPipe } from './core/i18n/t.pipe';
import { I18nService } from './core/i18n/i18n.service';
import { LanguageCode } from './core/i18n/translations';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  readonly authLoading$: Observable<boolean>;

  constructor(
    private readonly auth: AuthApiService,
    private readonly i18n: I18nService,
  ) {
    this.authLoading$ = this.auth.authLoading$;
  }

  ngOnInit(): void {
    this.auth.initializeSession();
  }

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  logout(): void {
    this.auth.logout();
  }

  currentLanguage(): LanguageCode {
    return this.i18n.language();
  }

  setLanguage(lang: LanguageCode): void {
    this.i18n.setLanguage(lang);
  }
}
