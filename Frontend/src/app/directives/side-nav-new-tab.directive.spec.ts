import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterLink, provideRouter } from '@angular/router';
import { SideNavNewTabDirective } from '@app/directives/side-nav-new-tab.directive';

@Component({
  standalone: true,
  imports: [RouterLink, SideNavNewTabDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './side-nav-new-tab.directive.spec.html',
})
class HostComponent {}

describe('SideNavNewTabDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let router: Router;
  let navigate: jasmine.Spy;
  /** Anchor clicks the directive synthesises — captured and cancelled so no real tab opens. */
  let anchorClicks: { href: string; target: string; ctrlKey: boolean; metaKey: boolean }[];

  const el = (id: string): HTMLElement => fixture.nativeElement.querySelector(`#${id}`);
  const stopAnchorNavigation = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLAnchorElement) {
      const { ctrlKey, metaKey } = event as MouseEvent;
      anchorClicks.push({ href: target.getAttribute('href') ?? '', target: target.target, ctrlKey, metaKey });
      event.preventDefault();
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(HostComponent);
    router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    anchorClicks = [];
    document.addEventListener('click', stopAnchorNavigation);
    fixture.detectChanges();
  });

  afterEach(() => document.removeEventListener('click', stopAnchorNavigation));

  it('opens the page in a new tab on Ctrl/Cmd + click and leaves the current tab alone', () => {
    el('item').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));

    expect(anchorClicks.length).toBe(1);
    expect(anchorClicks[0].href).toBe('/base-data/supplier');
    expect(anchorClicks[0].target).toBe('_blank');
    expect(anchorClicks[0].ctrlKey || anchorClicks[0].metaKey).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does the same for the middle button and for sub items', () => {
    el('sub').dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));

    expect(anchorClicks.map((c) => c.href)).toEqual(['/base-data/machines']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps a plain click navigating in the same tab', () => {
    el('item').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(anchorClicks).toEqual([]);
  });

  it('ignores an item without a link target', () => {
    el('group').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));

    expect(anchorClicks).toEqual([]);
  });
});
