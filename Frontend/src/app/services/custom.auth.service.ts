import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { User } from '@app/shared/model/user';

@Injectable({
  providedIn: 'root',
})
export class CustomAuthService {
  private token?: string | null;
  private isAlreadyLoggedIn?: boolean = false;
  public hasQualifiedUsers: boolean = false;
  public totalClockedInUsers: number = 0;
  public loggedInUser: User = new User();

  constructor(private http: HttpClient) { }

  login(user: { username?: string; password?: string; chip_number?: string }) {
    return new Promise((resolve, reject) => {
      this.http.post(`${environment.ServerApi}/api/login`, user).subscribe({
        next: (response: any) => {
          localStorage.setItem('remember_token', response?.token);
          this.token = response?.token;

          resolve('');
        },
        error: (error) => {
          console.log(error);
        },
      });
    });
  }

  isUserLoggedIn() {
    const token = this.getToken();

    return new Promise((resolve, reject) => {
      if (!token) {
        resolve(false);
        return;
      }
      if (this.isAlreadyLoggedIn) {
        resolve(true);
        return;
      }

      this.http.get(`${environment.ServerApi}/getUserByToken`).subscribe({
        next: (response) => {
          this.loggedInUser.deserialize(response);
          this.isAlreadyLoggedIn = true;
          resolve(true);
        },
        error: () => {
          resolve(false);
        },
      });
    });
  }

  public getToken() {
    this.token = localStorage.getItem('remember_token');
    return this.token;
  }

  public logout() {
    let header: any = {
      'Cache-Control': 'no-cache',
      Authorization: `Bearer ${this.token}`,
    };

    return new Promise((resolve, reject) => {
      this.http
        .get(`${environment.ServerApi}/logout`, { headers: header })
        .subscribe({
          next: (response: any) => {
            localStorage.removeItem('remember_token');

            document.cookie = 'logout_initiated=true; path=/;';
            this.token = null;
            this.isAlreadyLoggedIn = false;
            resolve('');
          },
          error: (error) => {
            reject($localize`Unable to logout`);
          },
        });
    });
  }

  public getUser() {
    return this.loggedInUser;
  }
}
