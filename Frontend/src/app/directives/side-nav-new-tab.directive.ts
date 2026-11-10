import { DestroyRef, Directive, ElementRef, NgZone, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Sidebar items are UI5 elements carrying `routerLink`, not `<a>` tags, so Angular navigates the
 * current tab on any click — Ctrl/Cmd + click and the middle button included. This opens the item's
 * page in a new background tab instead (what a real link does), keeping the current tab where it
 * is. A plain click is untouched.
 *
 * Applies on its own to every `ui5-side-navigation-item` / `-sub-item` with a `routerLink`; just have
 * it in the component's (or module's) `imports`.
 */
@Directive({
  selector: 'ui5-side-navigation-item[routerLink], ui5-side-navigation-sub-item[routerLink]',
  standalone: true,
})
export class SideNavNewTabDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly routerLink = inject(RouterLink, { self: true });
  private readonly router = inject(Router);

  constructor() {
    const onClick = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey) this.openInNewTab(event);
    };
    const onMiddleClick = (event: MouseEvent) => {
      if (event.button === 1) this.openInNewTab(event);
    };

    // Capture phase on the host, so this runs before `RouterLink`'s own click handler and the
    // template's `(click)` (expand / collapse) — both are skipped for a new-tab click.
    inject(NgZone).runOutsideAngular(() => {
      this.host.addEventListener('click', onClick, true);
      this.host.addEventListener('auxclick', onMiddleClick, true);
    });
    inject(DestroyRef).onDestroy(() => {
      this.host.removeEventListener('click', onClick, true);
      this.host.removeEventListener('auxclick', onMiddleClick, true);
    });
  }

  private openInNewTab(event: MouseEvent): void {
    const urlTree = this.routerLink.urlTree;
    if (!urlTree) return;

    event.stopImmediatePropagation();
    event.preventDefault();

    // A modifier-click on a real anchor is the one way to get the browser's own "new background
    // tab" behaviour; `window.open` would bring the new tab to the front.
    const anchor = document.createElement('a');
    anchor.href = this.router.serializeUrl(urlTree);
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: !IS_MAC, metaKey: IS_MAC }),
    );
    anchor.remove();
  }
}
