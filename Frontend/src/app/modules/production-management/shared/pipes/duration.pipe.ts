import { Pipe, PipeTransform } from '@angular/core';

/** Formats a duration in seconds as `HH:mm:ss` (hours are not capped at 24). */
@Pipe({ name: 'duration', standalone: true })
export class DurationPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    let total = Math.floor(Number(seconds) || 0);
    if (total < 0) total = 0;

    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number): string => n.toString().padStart(2, '0');

    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
}
