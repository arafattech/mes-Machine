# LanguageSwitchComponent

**Selector:** `app-language-switch`
**File:** `src/app/shared/components/language-switch/language-switch.component.ts`
**Standalone:** Yes — `CUSTOM_ELEMENTS_SCHEMA`
**Imports:** `CommonModule`

## What It Does

Dropdown language switcher for toggling between English (`en`) and Bengali (`bn`). Persists selection to `localStorage`, updates URL path with language code, and delegates to `LocalizeService` for runtime switching.

## Inputs / Outputs

None.

## Key Methods

| Method | Purpose |
|---|---|
| `ngOnInit()` | Loads current language, normalizes URL with language code |
| `languageMenu()` | Opens UI5 menu popover |
| `onMenuItemSelect(event)` | Applies selected language via `LocalizeService` |
| `loadLanguage()` | Reads from localStorage or falls back to `['en', 'bn']` |
| `normalize(code)` | Normalizes case-insensitive lang codes |
| `sortPreferred(items)` | Orders list: EN first, then BN |
| `ensureLangInUrl(url, lang)` | Injects lang code into URL pathname |

## Internal State

| Property | Purpose |
|---|---|
| `selectedLanguageName` | Display label shown on button |
| `selectedLanguageCode: LangCode` | `'en'\|'bn'` |
| `selectedLanguage: LangItem[]` | All available languages |
| `menuRef / btnRef` | ViewChild refs for UI5 menu + button |

## Template

UI5 `ui5-button` + `ui5-menu` + `ui5-menu-item` for each language.

## Usage Pattern

```html
<!-- Placed in layout header -->
<app-language-switch></app-language-switch>
```

No configuration needed — self-contained, reads and persists its own state.
