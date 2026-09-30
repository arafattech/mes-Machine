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
