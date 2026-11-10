import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterLink, provideRouter } from '@angular/router';
import { SideNavActiveDirective } from './side-nav-active.directive';

@Component({ standalone: true, template: '' })
class PageComponent {}

@Component({
  standalone: true,
  imports: [RouterLink, SideNavActiveDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './side-nav-active.directive.spec.html',
})
class SidebarComponent {}

type Selectable = HTMLElement & { selected?: boolean };

describe('SideNavActiveDirective', () => {
  let router: Router;
  let fixture: ComponentFixture<SidebarComponent>;

  const el = (id: string): Selectable => fixture.nativeElement.querySelector(`#${id}`);
  const selectedIds = (): string[] =>
    ['a', 'group', 'b', 'shared1', 'shared2'].filter((id) => el(id).selected === true);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(['a', 'b', 'shared'].map((path) => ({ path, component: PageComponent }))),
      ],
    });
    router = TestBed.inject(Router);
  });

  const render = async (): Promise<void> => {
    fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    await settle();
  };

  it('highlights the current page right after a reload (route already active when the sidebar renders)', async () => {
    await router.navigateByUrl('/a');
    await render();

    expect(selectedIds()).toEqual(['a']);
  });

  it('moves the highlight when the user navigates, sub items included', async () => {
    await router.navigateByUrl('/a');
    await render();

    await router.navigateByUrl('/b');
    await settle();
    expect(selectedIds()).toEqual(['b']);
  });

  it('ignores the query string and leaves a header without a link alone', async () => {
    await router.navigateByUrl('/a?tab=2');
    await render();

    expect(selectedIds()).toEqual(['a']);
    expect(el('group').selected).toBeFalsy(); // undefined on a plain element, false once UI5 has registered the tag
  });

  it('selects only the first of several items that share a URL', async () => {
    await router.navigateByUrl('/shared');
    await render();

    expect(selectedIds()).toEqual(['shared1']);
  });

  it('keeps the item UI5 selected on click when items share the URL', async () => {
    await router.navigateByUrl('/a');
    await render();

    el('shared2').selected = true; // what UI5 does for a click on the second item
    await router.navigateByUrl('/shared');
    await settle();

    expect(selectedIds()).toEqual(['shared2']);
  });
});
