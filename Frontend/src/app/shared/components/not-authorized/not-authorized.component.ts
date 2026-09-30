import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IllustratedMessageComponent } from "@ui5/webcomponents-ngx/fiori/illustrated-message";
@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [IllustratedMessageComponent,RouterLink],
  templateUrl: './not-authorized.component.html',
  styleUrl: './not-authorized.component.scss',
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NotAuthorizedComponent {

}
