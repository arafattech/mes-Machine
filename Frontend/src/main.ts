import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from '@app/app.config';
import { AppComponent } from '@app/app.component';
import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';

import '@ui5/webcomponents-fiori/dist/illustrations/AllIllustrations.js';
import '@angular/localize/init';

const savedTheme = localStorage.getItem('preferred_theme') || 'sap_fiori_3';
setTheme(savedTheme);

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
