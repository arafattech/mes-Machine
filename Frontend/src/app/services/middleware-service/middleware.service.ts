import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '@app/services/auth-service/auth.service';

@Injectable({
  providedIn: 'root',
})
export class MiddlewareService implements HttpInterceptor {
  constructor(private router: Router, private authService: AuthService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          localStorage.removeItem('remember_token');
          localStorage.removeItem('userInfo');
          localStorage.removeItem('roles');
          localStorage.removeItem('permissions');
          localStorage.removeItem('preferred_language');
          this.router.navigate(['/login']);
          this.authService.logoutCheck();
          console.log('error', error);
          return throwError(error);
        }

        return throwError(error);
      })
    );
  }
}
