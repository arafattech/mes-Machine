# CalendarComponent

**Selector:** `app-calendar`
**File:** `src/app/shared/components/calender/calender.component.ts`
**Standalone:** Yes
**Imports:** `Ui5MainModule`, `CommonModule`

## What It Does

Custom interactive calendar built without an external calendar library. Two display modes:

- **Large** — Full month grid, read-only display. Shows special date markers (holidays, events). No date selection.
- **Small** — Compact single-month picker. Supports date toggling. Emits selected dates.

## Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `size` | `'small'\|'large'` | `'large'` | Display mode |
| `specialDates` | `SpecialDate[]` | `[]` | Dates with color markers (holidays, events) |
| `preSelectedDates` | `string[]` | `[]` | Dates pre-selected on mount |
| `disabledDates` | `string[]` | `[]` | Dates that cannot be selected |
| `updateCalender` | `EventEmitter<string[]>` | — | External trigger to update selection |
| `employee` | `any` | — | Employee reference (not actively used) |

## Outputs

| Output | Emits | When |
|---|---|---|
| `selectedDatesChange` | `string[]` | Date toggled (small mode only) |

## Interfaces

```ts
interface SpecialDate {
  date: string;     // 'YYYY-MM-DD'
  type: string;
  color: string;
  isWeekend: boolean;
}

interface CalendarDay {
  date: moment.Moment | null;
  isSelected: boolean;
  isDisabled: boolean;
  isToday: boolean;
  isWeekend: boolean;
  specialDate?: SpecialDate;
}
```

## Key Methods

| Method | Purpose |
|---|---|
| `generateCalendar()` | Builds `CalendarDay[]` grid for current month |
| `prevMonth()` / `nextMonth()` | Month navigation |
| `goToToday()` | Jump to current month |
| `toggleDate(day)` | Toggle selection on day (small mode only) |
| `syncViewWithSelectedDates()` | Syncs grid with `selectedDates` array |

## Usage Pattern

**Read-only large calendar with holidays:**
```html
<app-calendar
  [size]="'large'"
  [specialDates]="holidays"
></app-calendar>
```

**Small date picker:**
```html
<app-calendar
  [size]="'small'"
  [preSelectedDates]="['2026-01-15']"
  [disabledDates]="weekends"
  (selectedDatesChange)="onDatesSelected($event)"
></app-calendar>
```

**External update:**
```ts
calendarUpdateEmitter.emit(['2026-02-01', '2026-02-05']);
```
