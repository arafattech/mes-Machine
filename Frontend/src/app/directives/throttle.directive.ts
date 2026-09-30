/**
 * Example Usage: Throttled Directive :
 *
 * Description:
 * This <ui5-button> element is enhanced with the `appThrottle` directive to
 * prevent multiple rapid clicks within a specified time interval.
 *
 * Features:
 * - [time]       : Sets the throttle interval in milliseconds (default: 1000ms).
 *                  Here, it is set to 2000ms (2 seconds).
 * - (blocked)    : Emits an event when the user clicks too quickly before
 *                  the throttle interval has passed.
 * - design       : Standard UI5 button property (Emphasized in this example).
 *
 * Behavior:
 * - First click: Allowed, triggers normal (click) events.
 * - Subsequent clicks within 2 seconds: Blocked, and the `blocked` event emits.
 *
 * Example:
 * <ui5-button
 *   appThrottle
 *   [time]="2000"
 *   (blocked)="onBlocked()"
 *   design="Emphasized"
 * >
 *   Save
 * </ui5-button>
 *
 * Usage Notes:
 * - Ideal for preventing double submissions or accidental multiple clicks.
 * - Works seamlessly with other Angular click handlers or UI5 features.
 */
import {
  Directive,
  Input,
  Output,
  EventEmitter,
  HostListener,
} from '@angular/core';

@Directive({
  selector: '[appThrottle]',
})
export class ThrottleDirective {
  @Input() time = 1000;
  @Output() blocked = new EventEmitter<void>();

  private lastClick = 0;

  constructor() {}

  @HostListener('click', ['$event'])
  handleClick(event: Event) {
    const now = Date.now();

    if (now - this.lastClick >= this.time) {
      this.lastClick = now;
    } else {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.blocked.emit();
      this.onBlocked();
    }
  }
  private onBlocked() {
    console.warn('Click blocked due to throttling.Please wait before clicking again.');
  }
}

