import moment from "moment";

export function formatTime(dateTimeStr?: string | null): string | null {
  if (!dateTimeStr) return null;

  let timePart = '';

  if (dateTimeStr.includes(' ')) {
    const parts = dateTimeStr.split(' ');
    timePart = parts[1];
  } else if (dateTimeStr.includes('T')) {
    timePart = dateTimeStr.split('T')[1];
  } else {
    return null;
  }

  if (!timePart) return null;

  const [hoursStr, minutesStr] = timePart.split(':');
  if (hoursStr === undefined || minutesStr === undefined) return null;

  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  const minutesDisplay = minutes < 10 ? `0${minutes}` : minutes;
  return `${hours}:${minutesDisplay} ${ampm}`;
}

export function calculateTotalHours(
  checkInTime?: string | null,
  checkOutTime?: string | null
): string {
  if (!checkInTime) return '0h';

  let start = moment(checkInTime);
  let end = checkOutTime ? moment(checkOutTime) : moment();

  if (end.isBefore(start)) {
    end.add(1, 'day');
  }

  const duration = moment.duration(end.diff(start));
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();

  return `${hours}h ${minutes}m`;
}

export function getWorkedDuration(
  startTime?: string,
  endTime?: string | null
): string {
  if (!startTime) return '0h';

  const start = moment(startTime, 'hh:mm A');
  const end = endTime ? moment(endTime, 'hh:mm A') : moment();

  if (end.isBefore(start)) {
    end.add(1, 'day');
  }

  const duration = moment.duration(end.diff(start));
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  return `${hours}h ${minutes}m`;
}

export function calculateHoursFromMinutes(
  totalMinutes?: number | null,
  fallback: string = '0h 0m'
): string {
  if (totalMinutes === null || totalMinutes === undefined) {
    return fallback;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}
