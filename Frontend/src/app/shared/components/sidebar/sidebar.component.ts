import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { SideNavigationComponent } from '@ui5/webcomponents-ngx/fiori/side-navigation';
import { SideNavigationGroupComponent } from '@ui5/webcomponents-ngx/fiori/side-navigation-group';
import { SideNavigationItemComponent } from '@ui5/webcomponents-ngx/fiori/side-navigation-item';
import { Ui5WebcomponentsIconsModule } from '@ui5/webcomponents-ngx';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule,
    SideNavigationComponent,
    SideNavigationGroupComponent,
    SideNavigationItemComponent,
    Ui5WebcomponentsIconsModule,
    
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SidebarComponent {
  @Input() collapsed: boolean = false;
}
