import { CommonModule } from '@angular/common';
import {
  Component,
  ViewChild,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
} from '@angular/core';
import {
  LocalizeService,
  LangCode,
} from '@app/services/localize-service/localize.service';

type LangItem = { code: LangCode; name: string };

@Component({
  selector: 'app-language-switch',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule],
  templateUrl: './language-switch.component.html',
  styleUrls: ['./language-switch.component.scss'], // ✅ fix: styleUrls (plural)
})
export class TranslationComponent implements OnInit {
  @ViewChild('menu', { static: false }) menuRef!: ElementRef<HTMLElement>;
  @ViewChild('languageBtn', { static: false }) btnRef!: ElementRef<HTMLElement>;

  selectedLanguageName = '';
  selectedLanguageCode: LangCode = 'en';
  selectedLanguage: LangItem[] = [];

  private readonly allowedCodes: LangCode[] = ['bn', 'en'];

  constructor(private langSvc: LocalizeService) {}

  ngOnInit(): void {
    this.langSvc.init();

    this.selectedLanguageCode = this.langSvc.getCurrent();
    this.selectedLanguageName =
      localStorage.getItem('selectedLanguageName') ||
      (this.selectedLanguageCode === 'bn' ? 'বাংলা' : 'English');

    this.loadLanguage();

    // optional URL normalization
    const url = new URL(window.location.href);
    const next = this.ensureLangInUrl(url, this.selectedLanguageCode);
    if (next !== url.toString()) {
      window.history.replaceState({}, '', next);
    }
  }



  onMenuItemSelect(event: any): void {
    const itemEl = event?.detail?.item as HTMLElement | undefined;
    const name = itemEl?.getAttribute('text') ?? '';
    const found = this.selectedLanguage.find((l) => l.name === name);
    if (!found) return;

    this.selectedLanguageCode = found.code;
    this.selectedLanguageName = found.name;

    // persist & reload via service (your service handles storage + reload)
    this.langSvc.setLanguage(found.code, found.name);
  }

  private loadLanguage(): void {
    const stored = localStorage.getItem('Languages');
    let list: LangItem[] = [];

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as any[];
        const unique = new Set<string>();
        list = (parsed || [])
          .filter((l: any) => !!l?.code && !!l?.name)
          .filter((l: any) =>
            this.allowedCodes.includes(this.normalize(l.code))
          )
          .filter((l: any) =>
            unique.has(this.normalize(l.code))
              ? false
              : unique.add(this.normalize(l.code))
          )
          .map((l: any) => ({ code: this.normalize(l.code), name: l.name }));
      } catch (e) {
        console.warn(
          'Invalid Languages JSON in localStorage, using fallback',
          e
        );
      }
    }

    if (list.length === 0) {
      list = [
        { code: 'en', name: 'English' },
        { code: 'bn', name: 'বাংলা' },
      ];
    }

    this.selectedLanguage = this.sortPreferred(list);

    if (
      !this.selectedLanguage.some((x) => x.code === this.selectedLanguageCode)
    ) {
      this.selectedLanguage.unshift({
        code: this.selectedLanguageCode,
        name:
          this.selectedLanguageName ||
          (this.selectedLanguageCode === 'bn' ? 'বাংলা' : 'English'),
      });
    }
  }
  languageMenu(): void {
    const menuEl = this.menuRef?.nativeElement as any;
    const btnEl = this.btnRef?.nativeElement as HTMLElement;

    if (!menuEl || !btnEl) return;

    // Prefer showAt when available (newer UI5 WC), else fallback to opener/open
    if (typeof menuEl.showAt === 'function') {
      menuEl.showAt(btnEl);
    } else {
      // Fallback for your version
      menuEl.opener = btnEl; // you can also set: menuEl.opener = 'languageButton'
      menuEl.open = true;
    }
  }

  // ---------- helpers ----------
  private normalize(code: string): LangCode {
    const c = String(code || '').toLowerCase();
    if (c.startsWith('bn')) return 'bn';
    if (c === 'en' || c.startsWith('en-')) return 'en';
    return (this.allowedCodes.find((a) => a.toLowerCase() === c) ||
      'en') as LangCode;
  }

  private sortPreferred(items: LangItem[]): LangItem[] {
    const order = ['en', 'bn'];
    return [...items].sort(
      (a, b) => order.indexOf(a.code) - order.indexOf(b.code)
    );
  }

  private ensureLangInUrl(url: URL, lang: LangCode): string {
    const allowed = this.allowedCodes
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const parts = url.pathname.split('/').filter(Boolean);
    const re = new RegExp(`^(${allowed})$`, 'i');
    if (parts.length === 0) {
      url.pathname = `/${lang}/`;
    } else if (re.test(parts[0])) {
      parts[0] = lang;
      url.pathname = '/' + parts.join('/');
    } else {
      parts.unshift(lang);
      url.pathname = '/' + parts.join('/');
    }
    return url.toString();
  }
}
