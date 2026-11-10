import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, IsActiveMatchOptions, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** A sidebar link is "current" only for exactly its page — a prefix match would keep the dashboard item selected everywhere. */
export const SIDEBAR_ACTIVE_MATCH: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

interface SidebarLink {
  routerLink?: string;
}

interface SidebarItem extends SidebarLink {
  expanded: boolean;
  subItems?: SidebarLink[];
}

interface SidebarGroup {
  expanded: boolean;
  items: SidebarItem[];
}

/** Whether a menu `routerLink` (relative to the layout's route, like in the template) is the page the router is on. */
export function isSidebarLinkActive(router: Router, route: ActivatedRoute, link: string): boolean {
  return router.isActive(router.createUrlTree([link], { relativeTo: route }), SIDEBAR_ACTIVE_MATCH);
}

/**
 * Opens the group — and the item — that holds the current page, so a reload (or a link from
 * elsewhere) lands on a visible, highlighted menu entry. Only ever expands; what the user has
 * opened or closed by hand is left alone. Works on the layouts' menu data (not the DOM) so the
 * `[expanded]` bindings and `toggleExpand()` stay in step.
 */
export function expandActiveSidebarGroups(groups: SidebarGroup[], isActive: (link: string) => boolean): void {
  for (const group of groups) {
    for (const item of group.items) {
      const subItemActive = item.subItems?.some((sub) => !!sub.routerLink && isActive(sub.routerLink)) ?? false;
      if (subItemActive) item.expanded = true;
      if (subItemActive || (!!item.routerLink && isActive(item.routerLink))) group.expanded = true;
    }
  }
}

/**
 * Keeps a layout's menu open on the current page after every navigation, and returns the function to
 * run once right after the menu is (re)built — that covers a reload. Call it from a field initializer
 * (needs an injection context); `getMenu` is read lazily, when the menu exists.
 */
export function keepActiveSidebarGroupOpen(getMenu: () => SidebarGroup[]): () => void {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const expand = (): void =>
    expandActiveSidebarGroups(getMenu(), (link) => isSidebarLinkActive(router, route, link));

  router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(expand);
  return expand;
}
