import { DestroyRef, Directive, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { SIDEBAR_ACTIVE_MATCH } from '@shared/utilities/sidebar-active';

type SelectableElement = HTMLElement & { selected: boolean };

/**
 * UI5's side navigation only highlights what was clicked, so a reload (or opening a link in a new
 * tab) left nothing selected. This keeps each item's `selected` in step with the router's URL: the
 * item for the current page is highlighted, every other one is not.
 *
 * Several items can share one URL (the production sidebar's "All Machines" and halls all open
 * `production`). The URL cannot tell them apart, so then only the first of them is selected, and
 * only while nothing else is — a click on another one keeps UI5's own choice.
 *
 * Applies on its own to every `ui5-side-navigation-item` / `-sub-item` with a `routerLink`.
 */
@Directive({
  selector: 'ui5-side-navigation-item[routerLink], ui5-side-navigation-sub-item[routerLink]',
  standalone: true,
})
export class SideNavActiveDirective implements OnInit {
  private readonly host = inject<ElementRef<SelectableElement>>(ElementRef).nativeElement;
  private readonly routerLink = inject(RouterLink, { self: true });
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const urlTree = this.routerLink.urlTree;
    if (!urlTree) return; // group headers carry no link

    const url = this.router.serializeUrl(urlTree);
    this.host.dataset['navUrl'] = url;

    // Deferred a tick so the sibling items (and their `data-nav-url`) exist before looking for twins.
    queueMicrotask(() => this.sync(url));
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.sync(url));
  }

  private sync(url: string): void {
    const urlTree = this.routerLink.urlTree;
    if (!urlTree || !this.router.isActive(urlTree, SIDEBAR_ACTIVE_MATCH)) {
      this.host.selected = false;
      return;
    }

    const sidebar = this.host.closest('ui5-side-navigation');
    const items = Array.from(sidebar?.querySelectorAll<SelectableElement>('[data-nav-url]') ?? []);
    const twins = items.filter((item) => item.dataset['navUrl'] === url);
    if (twins.length > 1 && (twins[0] !== this.host || items.some((item) => item.selected))) return;

    this.host.selected = true;
  }
}
