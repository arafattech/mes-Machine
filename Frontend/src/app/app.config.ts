import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from '@app/app.routes';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MiddlewareService } from '@app/services/middleware-service/middleware.service';
import { Ui5WebcomponentsIconsModule } from '@ui5/webcomponents-ngx/icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(
      FormsModule,
      ReactiveFormsModule,
      Ui5WebcomponentsIconsModule.forRoot([
        'sap-icons',
        'tnt-icons',
        'business-suite-icons',
      ])
    ),
    DatePipe,
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MiddlewareService,
      multi: true,
    },
  ],
};
