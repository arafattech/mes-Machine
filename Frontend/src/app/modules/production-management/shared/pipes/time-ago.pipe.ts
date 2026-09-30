import { Pipe, PipeTransform } from '@angular/core';

/** Formats an epoch-ms timestamp as a relative "time ago" string (`Just now`, `5m ago`,
 * `3h ago`, `2d ago`). `null`/`undefined` renders as an empty string. */
@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(epochMs: number | null | undefined): string {
    if (epochMs == null) return '';

    const seconds = Math.floor((Date.now() - epochMs) / 1000);
    if (seconds < 60) return $localize`Just now`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return $localize`${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return $localize`${hours}h ago`;

    const days = Math.floor(hours / 24);
    return $localize`${days}d ago`;
  }
}
