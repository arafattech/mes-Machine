import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type LangCode = 'en' | 'bn';

@Injectable({ providedIn: 'root' })
export class LocalizeService {
  // storage/cookie keys
  private readonly LS_KEY = 'preferred_language';
  private readonly LS_NAME = 'selectedLanguageName';
  private readonly COOKIE_KEY = 'cookie_keys';

  private readonly allowed: LangCode[] = ['en', 'bn'];

  constructor(@Inject(DOCUMENT) private document: Document) {}

  getCurrent(): LangCode {
    const c = this.getCookie(this.COOKIE_KEY);
    const ls = localStorage.getItem(this.LS_KEY) || '';
    const picked = (c || ls || this.allowed[0]) as LangCode;
    return this.normalize(picked);
  }

  init(): void {
    const lang = this.getCurrent();
    this.applyHtml(lang);
  }

  setLanguage(lang: LangCode, langName?: string) {
    const clean = this.normalize(lang);

    localStorage.setItem(this.LS_KEY, clean);
    if (langName) localStorage.setItem(this.LS_NAME, langName);
    this.setCookie(this.COOKIE_KEY, clean, 365);

    this.applyHtml(clean);

    const nextUrl = this.withLangInPath(new URL(window.location.href), clean);

    window.history.replaceState({}, '', nextUrl.toString());

    window.location.reload();
  }

  // ---------- helpers ----------
  private normalize(code: string): LangCode {
    const lower = code.toLowerCase();
    if (lower.startsWith('bn')) return 'bn';
    if (lower === 'en' || lower.startsWith('en-')) return 'en';

    const match =
      this.allowed.find((a) => a.toLowerCase() === lower) ?? this.allowed[0];
    return match as LangCode;
  }

  private applyHtml(lang: LangCode) {
    this.document.documentElement.setAttribute('lang', lang);
    this.document.documentElement.setAttribute('dir', 'ltr');
    this.document.documentElement.classList.toggle('lang-bn', lang === 'bn');
    this.document.documentElement.classList.toggle('lang-en', lang === 'en');
  }

  private withLangInPath(url: URL, lang: LangCode): URL {
    const parts = url.pathname.split('/').filter(Boolean);
    const langRegex = new RegExp(
      `^(${this.allowed.map(this.escape).join('|')})$`,
      'i'
    );

    if (parts.length === 0) {
      url.pathname = `/${lang}/`;
      return url;
    }

    if (langRegex.test(parts[0])) {
      parts[0] = lang;
    } else {
      parts.unshift(lang);
    }
    url.pathname = '/' + parts.join('/');
    return url;
  }

  // cookies
  private getCookie(name: string): string {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2)
      return decodeURIComponent(parts.pop()!.split(';').shift() || '');
    return '';
  }
  private setCookie(name: string, val: string, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 86400000);
    document.cookie = `${name}=${encodeURIComponent(
      val
    )}; expires=${date.toUTCString()}; path=/`;
  }

  private escape(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
  }
}
