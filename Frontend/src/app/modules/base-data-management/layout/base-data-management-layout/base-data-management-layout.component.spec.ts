import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { BaseDataManagementLayoutComponent } from './base-data-management-layout.component';

@Component({ standalone: true, template: '' })
class PageComponent {}

type NavElement = HTMLElement & { selected?: boolean; expanded?: boolean };

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

describe('BaseDataManagementLayoutComponent sidebar', () => {
  let router: Router;
  let fixture: ComponentFixture<BaseDataManagementLayoutComponent>;

  const navItems = (): NavElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('ui5-side-navigation-item, ui5-side-navigation-sub-item'));
  const textOf = (item: NavElement): string | null => item.getAttribute('text');
  const selectedTexts = (): (string | null)[] => navItems().filter((item) => item.selected === true).map(textOf);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([
          {
            path: 'base-data',
            component: BaseDataManagementLayoutComponent,
            children: [
              { path: 'machines', component: PageComponent },
              { path: 'supplier', component: PageComponent },
            ],
          },
        ]),
      ],
    });
    TestBed.inject(RolePermissionService).setPermissions(Object.values(Permissions));
    router = TestBed.inject(Router);

    // Like a page reload: the URL is already there when the sidebar renders.
    await router.navigateByUrl('/base-data/machines');
    fixture = TestBed.createComponent(BaseDataManagementLayoutComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => fixture.nativeElement.remove());

  it('highlights the current page and opens its group after a reload', () => {
    expect(selectedTexts()).toEqual(['Machine List']);

    const group = navItems().find((item) => textOf(item) === 'Machines Management');
    expect(group?.expanded).toBeTrue();
  });

  it('moves the highlight when another page is opened', async () => {
    await router.navigateByUrl('/base-data/supplier');
    fixture.detectChanges();
    await settle();

    expect(selectedTexts()).toEqual(['Supplier']);
  });
});
