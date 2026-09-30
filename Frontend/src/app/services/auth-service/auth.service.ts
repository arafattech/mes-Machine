import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { isPlatformBrowser } from '@angular/common';
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  private userTypeSubject = new BehaviorSubject<string | null>(null);
  isLoggedIn$ = this.isLoggedInSubject.asObservable();
  userType$ = this.userTypeSubject.asObservable();
  type: string | null = null;
  private apiUrl = environment.ServerApi + '/api';
  private odataUrl = environment.ServerApi + '/odata';
  remember_token: string | null = null;
  id: string | null;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    const rememberToken = localStorage.getItem('remember_token');
    this.isLoggedInSubject.next(!!rememberToken);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('key', 'value');
    }
    const storedType = localStorage.getItem('type');
    if (storedType) {
      this.userTypeSubject.next(storedType);
    }
    this.type = localStorage.getItem('type');
    this.id = localStorage.getItem('id');
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password });
  }

  loginCheck(): void {
    this.isLoggedInSubject.next(true);
  }
  logoutCheck(): void {
    this.userTypeSubject.next(null);
    this.isLoggedInSubject.next(false);
  }

  getUser(): Observable<any> {
      return this.http.get<any>(`${this.apiUrl}/auth`, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
        }),
      });
    }

  logout(remember_token: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/logout`,
      { remember_token },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
        },
      }
    );
   
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('remember_token');
  }

  user() {
    let user = localStorage.getItem('userInfo');
    if (user) {
      return JSON.parse(user);
    }
  }
}
