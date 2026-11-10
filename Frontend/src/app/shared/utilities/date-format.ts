import { Injectable } from '@angular/core';
import moment from 'moment';
@Injectable({
  providedIn: 'root',
})
export class DateFormatterService {
  /**
   * Formats a date string or Date object to dd.mm.yyyy, hh:mm format
   * @param dateString Date object or string
   * @param isCommaNeeded Include comma between date and time
   * @param isTimeNeeded Include time in the output
   * @param isAmPmNeeded Include AM/PM indicator
   * @param isTwelveHour Use 12-hour format instead of 24-hour
   * @param isUTCNeeded Convert to local time from UTC
   * @returns e.g., "03.06.2024, 11:06" or "03.06.2024, 11:06 AM"
   */
  formatDate(
    dateString: Date | string,
    isCommaNeeded = true,
    isTimeNeeded = true,
    isAmPmNeeded = false,
    isTwelveHour = false,
    isUTCNeeded = true,
    isTimeOnly = false
  ): string {
    if (!dateString) return '';

    const date =
      typeof dateString === 'string' ? new Date(dateString) : dateString;

    if (isNaN(date.getTime())) return '';

    const dateToUse = isUTCNeeded
      ? new Date(date.getTime() + date.getTimezoneOffset() * 60000)
      : date;

    const day = dateToUse.getDate().toString().padStart(2, '0');
    const month = (dateToUse.getMonth() + 1).toString().padStart(2, '0');
    const year = dateToUse.getFullYear().toString();

    let hours = isTwelveHour
      ? dateToUse.getHours() % 12 || 12
      : dateToUse.getHours();
    const minutes = dateToUse.getMinutes().toString().padStart(2, '0');
    const ampm = isAmPmNeeded ? (dateToUse.getHours() >= 12 ? 'PM' : 'AM') : '';

    const formattedHours = hours.toString().padStart(2, '0');

    const datePart = `${day}/${month}/${year}`;
    const timePart = isTimeNeeded
      ? `${formattedHours}:${minutes}${isAmPmNeeded ? ' ' + ampm : ''}`
      : '';
    const separator = isTimeNeeded && isCommaNeeded ? ',' : '';

    return isTimeNeeded ? `${isTimeOnly ? timePart : datePart + separator + timePart}` : datePart;
  }
}

/**
 * Factory (business) time zone. Backend stores UTC and sends ISO-8601 instants; every
 * user-facing production date/time and every "factory day" boundary is computed here.
 */
export const FACTORY_TIME_ZONE = 'Asia/Dhaka';

type DateInput = Date | string | null | undefined;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** MySQL-style timestamp without a zone; backend storage is UTC. */
const NAIVE_UTC = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const PICKER_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const factoryPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: FACTORY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface FactoryParts {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: string;
}

function factoryParts(value: DateInput): FactoryParts | null {
  if (!value) return null;
  const instant =
    value instanceof Date ? value : new Date(NAIVE_UTC.test(value) ? `${value.replace(' ', 'T')}Z` : value);
  if (isNaN(instant.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const { type, value: part } of factoryPartsFormatter.formatToParts(instant)) {
    parts[type] = part;
  }
  return { year: parts['year'], month: parts['month'], day: parts['day'], hour: Number(parts['hour']), minute: parts['minute'] };
}

/**
 * `DD/MM/YYYY` in factory time. A bare `YYYY-MM-DD` is a calendar date and is reformatted as-is;
 * an already formatted `DD/MM/YYYY` is returned unchanged.
 */
export function formatFactoryDate(value: DateInput): string {
  if (typeof value === 'string' && PICKER_DATE.test(value)) return value;
  const dateOnly = typeof value === 'string' ? DATE_ONLY.exec(value) : null;
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

  const p = factoryParts(value);
  return p ? `${p.day}/${p.month}/${p.year}` : '';
}

/** `DD/MM/YYYY hh:mm AM` in factory time. */
export function formatFactoryDateTime(value: DateInput): string {
  const p = factoryParts(value);
  if (!p) return '';
  return `${p.day}/${p.month}/${p.year} ${clock12(p.hour, p.minute)}`;
}

/** `hh:mm AM` in factory time. */
export function formatFactoryTime(value: DateInput): string {
  const p = factoryParts(value);
  return p ? clock12(p.hour, p.minute) : '';
}

function clock12(hour: number, minute: string): string {
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** `DD/MM` in factory time — compact chart-axis day label. */
export function formatFactoryDayMonth(value: DateInput): string {
  return formatFactoryDate(value).slice(0, 5);
}

/** Factory calendar date (`YYYY-MM-DD`) of an instant — the key the backend groups and filters days by. */
export function factoryDateKey(value: DateInput = new Date()): string {
  const p = factoryParts(value);
  return p ? `${p.year}-${p.month}-${p.day}` : '';
}

export function factoryToday(): string {
  return factoryDateKey(new Date());
}

export const MS_PER_DAY = 86_400_000;

/**
 * Factory-zone offset from UTC (ms) at `instant`. Days are treated as exactly 24 h, so only
 * fixed-offset zones (no DST, as Asia/Dhaka) are supported.
 */
function factoryOffsetMs(instant: number): number {
  const p = factoryParts(new Date(instant))!;
  const wallClockAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour, +p.minute);
  return wallClockAsUtc - Math.floor(instant / 60_000) * 60_000;
}

/** Factory midnight opening the given factory calendar date (`YYYY-MM-DD`). */
export function factoryMidnight(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  return new Date(utcMidnight - factoryOffsetMs(utcMidnight));
}

/** Factory midnight opening the 1st of the current factory month. */
export function factoryMonthStart(): Date {
  return factoryMidnight(`${factoryToday().slice(0, 8)}01`);
}

/** Factory midnight opening the factory day that contains `instant`. */
export function factoryDayStart(instant: Date | number = Date.now()): Date {
  return factoryMidnight(factoryDateKey(new Date(instant)));
}

/** True when a picker holds text that is not a valid `DD/MM/YYYY` date (empty is not invalid). */
export function isInvalidPickerDate(value: string | null | undefined): boolean {
  return !!value?.trim() && !fromPickerDate(value);
}

/** `ui5-date-picker` (`format-pattern="dd/MM/yyyy"`, fed by `formatFactoryDate`) value (`DD/MM/YYYY`) → API calendar date (`YYYY-MM-DD`); `''` when empty or invalid. */
export function fromPickerDate(value: string | null | undefined): string {
  const match = value ? PICKER_DATE.exec(value.trim()) : null;
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  const isRealDate = date.getUTCFullYear() === +year && date.getUTCMonth() === +month - 1 && date.getUTCDate() === +day;
  return isRealDate ? `${year}-${month}-${day}` : '';
}

/** Browser-local `DD/MM/YYYY`. Production screens use `formatFactoryDate`. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  return moment(String(value)).format('DD/MM/YYYY');
}

/**
 * Some backend `datetime` casts are serialized with a `Z` suffix but the
 * stored value is naive local wall-clock time (backend `APP_TIMEZONE` is
 * UTC, not the deployment's local zone) — `moment.utc()` reads the raw
 * numbers instead of letting moment re-shift them to the browser's local
 * time on top of the already-local value.
 */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  return moment.utc(String(value)).format('DD/MM/YYYY hh:mm A');
}

/** `hh:mm A` of a naive wall-clock DATETIME serialized with a `Z` suffix (e.g. `employee_shifts`
 * start/end) — read with `moment.utc()` for the same reason as `formatDateTime`. */
export function formatWallClockTime(value: string | null | undefined): string {
  if (!value) return '';
  return moment.utc(String(value)).format('hh:mm A');
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  return moment(String(value), ['hh:mm A', 'HH:mm:ss', 'HH:mm']).format('hh:mm A');
}

export function calculateTotalHours(
  checkInTime?: string | null,
  checkOutTime?: string | null
): string {

  if (!checkInTime) return "0h 0m";
  if (!checkOutTime) return "Pending";

  const startTime = moment.parseZone(checkInTime);
  const endTime = moment.parseZone(checkOutTime);

  if (!startTime.isValid() || !endTime.isValid()) {
    return "0h 0m";
  }

  if (endTime.isSameOrBefore(startTime)) {
    endTime.add(1, "day");
  }

  const totalMinutes = endTime.diff(startTime, "minutes");
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}
