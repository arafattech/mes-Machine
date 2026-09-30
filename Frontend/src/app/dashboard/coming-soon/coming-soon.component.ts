import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import '@ui5/webcomponents-fiori/dist/illustrations/UnableToUpload.js';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [Ui5MainModule],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss'
})
export class ComingSoonComponent {

}
