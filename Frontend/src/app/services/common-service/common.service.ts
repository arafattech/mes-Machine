import { EventEmitter, Injectable, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { co } from '@fullcalendar/core/internal-common';

@Injectable({
  providedIn: 'root',
})
export class CommonService {
  odata: boolean = true;
  api: boolean = false;
  ToastDuration: number = 2000;
  sidenavToggle = new EventEmitter<boolean>();
  sidenavHidden = new EventEmitter<boolean>();

  private lodataPrefix = environment.ServerApi + '/odata';
  private apiPrefix = environment.ServerApi + '/api';
  private v8Prefix = environment.v8Url;

  constructor(private http: HttpClient) {}
  emitSidenavToggle(isCollapsed: boolean) {
    this.sidenavToggle.emit(isCollapsed);
  }
  /**
   * Generic GET request
   * @param url Endpoint URL
   * @param isLodata Use Lodata prefix
   * @param params Optional query parameters
   * @param headers Optional custom headers
   */
  get<T>(
    url: string,
    isLodata: boolean = true,
    isv8: boolean = false,
    params: HttpParams = new HttpParams(),
    headers: HttpHeaders = new HttpHeaders({
      'Cache-Control': 'no-cache',
      Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
    }),
  ): Observable<T> {
    const urlPrefix = isv8
      ? this.v8Prefix + (isLodata ? '/odata/v8' : '/api')
      : isLodata
        ? this.lodataPrefix
        : this.apiPrefix;
    const modifiedUrl = `${urlPrefix}/${url}`;
    return this.http.get<T>(modifiedUrl, { headers, params });
  }

  /**
   * Generic POST request
   * @param url Endpoint URL
   * @param body Request payload
   * @param isLodata Use Lodata prefix
   * @param headers Optional custom headers
   */
  post<T>(
    url: string,
    body: any,
    isLodata: boolean = true,
    headers: HttpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
    }),
    responseType: 'json' | 'blob' | 'text' = 'json',
    isv8: boolean = false,
  ): Observable<T> {
    const urlPrefix = isv8
      ? this.v8Prefix + (isLodata ? '/odata/v8' : '/api')
      : isLodata
        ? this.lodataPrefix
        : this.apiPrefix;
    const modifiedUrl = `${urlPrefix}/${url}`;
    if (body instanceof FormData) {
      headers = headers.delete('Content-Type');
    }
    return this.http.post<T>(modifiedUrl, body, {
      headers,
      responseType: responseType as 'json',
    });
  }

  /**
   * Generic PUT request
   * @param url Endpoint URL
   * @param body Request payload
   * @param isLodata Use Lodata prefix
   * @param headers Optional custom headers
   */
  put<T>(
    url: string,
    body: any,
    isLodata: boolean = true,
    headers: HttpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
    }),
  ): Observable<T> {
    const urlPrefix = isLodata ? this.lodataPrefix : this.apiPrefix;
    const modifiedUrl = `${urlPrefix}/${url}`;
    return this.http.put<T>(modifiedUrl, body, { headers });
  }

  /**
   * Generic DELETE request
   * @param url Endpoint URL
   * @param isLodata Use Lodata prefix
   * @param headers Optional custom headers
   */
  delete<T>(
    url: string,
    data: any = null,
    isLodata: boolean = true,
    headers: HttpHeaders = new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
    }),
  ): Observable<T> {
    const urlPrefix = isLodata ? this.lodataPrefix : this.apiPrefix;
    const modifiedUrl = `${urlPrefix}/${url}`;
    return this.http.request<T>('DELETE', modifiedUrl, {
      body: data,
      headers: headers,
    });
  }

  async getCustomId(data: {
    model: string;
    prefix: string;
    field: string;
  }): Promise<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
    });

    try {
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiPrefix}/generate-id`, data, { headers }),
      );

      return response.code;
    } catch (error) {
      console.error('Error Generating Item Code:', error);
      throw error;
    }
  }

  /**
   * Utility function to log messages
   * @param message Message to log
   */

  // get count value

  log(message: string): void {}
}
