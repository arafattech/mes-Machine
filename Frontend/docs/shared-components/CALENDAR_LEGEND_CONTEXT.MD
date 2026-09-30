# CalendarLegendComponent

**Selector:** `app-calendar-legend`
**File:** `src/app/shared/components/calendar-legend/calendar-legend.component.tsx`
**Standalone:** Yes

## What It Does

Angular wrapper that mounts a SAP UI5 React `Calendar` with an integrated `CalendarLegend`. Renders a date range picker with three hardcoded legend items (Vacation, School Vacation, Wedding) and three hardcoded disabled date ranges.

Creates a React root in the constructor and renders immediately. Lifecycle hooks (`ngOnInit`, `ngOnChanges`, `ngAfterViewInit`, `ngOnDestroy`) throw errors — they are not implemented.

## Hardcoded State

**Disabled ranges:**
- Dec 20–25 2025
- Jan 5–10 2026
- Jan 15 2026

**Legend items:**
- Vacation
- School Vacation
- Wedding

## Inputs / Outputs

None. All data is hardcoded inside the component.

## Notes

- Angular lifecycle hooks intentionally throw errors — do not use `ngOnInit`/`ngOnChanges` callbacks on this component.
- Calendar uses `selectionMode="Range"`.
- Not a general-purpose calendar — see `app-calendar` (`CalendarComponent`) for configurable calendar with special dates and date selection.
