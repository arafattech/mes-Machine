import { Injectable } from '@angular/core';
import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private darkThemes = [
    'sap_fiori_3_dark',
    'sap_fiori_3_hcb',
    'sap_horizon_dark',
    'sap_horizon_hcb',
  ];

  // Observable for theme changes
  private themeSubject = new BehaviorSubject<string>('sap_horizon');
  theme$ = this.themeSubject.asObservable();

  currentTheme: string;

  constructor() {
    const saved = localStorage.getItem('preferred_theme') || 'sap_horizon';
    this.currentTheme = saved;
    // Broadcast initial theme
    this.themeSubject.next(saved);
    setTheme(saved);
  }

  setUI5Theme(theme: string) {
    this.currentTheme = theme;
    localStorage.setItem('preferred_theme', theme);
    // Apply UI5 theme
    setTheme(theme);
    //  Broadcast new theme to all components
    this.themeSubject.next(theme);
  }

  getTheme(): string {
    return this.currentTheme;
  }

  isDarkTheme(): boolean {
    return this.darkThemes.includes(this.currentTheme);
  }

  currentThemeStyle(isBorder: boolean = true) {
    let backgroundColor: string;
    let borderColor: string;
    let textColor: string = 'var(--sapTextColor)';

    switch (this.currentTheme) {
      // --- Fiori 3 (Classic Glow) Themes ---
      case 'sap_fiori_3': // Classic Glow (Light)
        backgroundColor = '#ffffff';
        borderColor = '#b3b3b3';
        break;
      case 'sap_fiori_3_dark':
        backgroundColor = '#33363a';
        borderColor = '#666666';
        break;
      case 'sap_fiori_3_hcb': // Obsidian Black (High Contrast Black)
        backgroundColor = '#000000';
        borderColor = '#ffffff';
        break;
      case 'sap_fiori_3_hcw':
        backgroundColor = '#ffffff';
        borderColor = '#000000';
        break;

      // --- Horizon (Aurora) Themes ---
      case 'sap_horizon':
        backgroundColor = '#ffffff';
        borderColor = '#ddd';
        
        break;
      case 'sap_horizon_dark':
        backgroundColor = '#1c2b3e';
        borderColor = '#7e9dbf';
        break;
      case 'sap_horizon_hcb':
        backgroundColor = '#000000';
        borderColor = '#ffffff';

        break;
      case 'sap_horizon_hcw':
        backgroundColor = '#ffffff';
        borderColor = '#ddd';
        break;

      default:
        backgroundColor = '#ffffff';
        borderColor = '#cccccc';
        break;
    }

    return {
      '--custom-background-color': backgroundColor,
      '--custom-border-color': borderColor,

      border: isBorder ? `1px solid ${borderColor}` : undefined,
      'background-color': backgroundColor,
      'border-radius': '1rem',
      padding: '1rem',

      color: textColor,
    };
  }
}
