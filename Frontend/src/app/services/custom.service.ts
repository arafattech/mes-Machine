import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable, lastValueFrom, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { Operator } from '@app/shared/enums/operator';
import { Localization } from '@app/shared/utilities/localization';


@Injectable({
  providedIn: 'root',
})
export class CustomService implements HttpInterceptor {
  get apiPrefix(): string {
    return this._apiPrefix;
  }

  private apiUrl = environment.ServerApi;
  protected apiPrefixForRest = environment.ServerApi + '/api';
  private lodataPrefix: string = environment.ServerApi + '/odata';
  private _apiPrefix: string = environment.ServerApi + '/api';

  private _v8ApiPrefix: string = environment.v8Url + '/api';
  private _v8LodataPrefix: string = environment.v8Url + '/odata/v8';

  constructor(
    protected http: HttpClient,
    protected router: Router,
    protected activatedRoute: ActivatedRoute
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('remember_token');
    if (token && (req.url.includes('odata') || req.url.includes('api'))) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
        },
      });
    }

    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          localStorage.removeItem('remember_token');
          this.router.navigate(['/login'], { replaceUrl: true });
        }
        return throwError(() => err);
      })
    );
  }

  get<T>(url: string, isLodata: boolean = true, addPrefix: boolean = true , isV8: boolean = false) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    const header: any = {
      'Cache-Control': 'no-cache',
    };
    let modifiedUrl = addPrefix ? `${urlPrefix}/${url}` : url;

    if(isV8){
      modifiedUrl = `${environment.v8Url}/${isLodata ? 'odata/v8' : 'api'}/${url}`;
    }

    return this.http.get<T>(`${modifiedUrl}`, {
      headers: header,
    });
  }

  getOption(url: string, isLodata: boolean = true, addPrefix: boolean = true) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    let modifiedUrl = addPrefix ? `${urlPrefix}/${url}` : url;
    return this.http.get(`${modifiedUrl}`, {
      responseType: 'blob',
      headers: { 'Cache-Control': 'no-cache' },
    });
  }

  getAutoIncrementId(url: string, isLodata: boolean = true) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    return this.http.get<any>(`${urlPrefix}/${url}?$orderby=id desc&$top=1`);
  }

  put(url: string, data: any, isLodata: boolean = true) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    return this.http.put(`${urlPrefix}/${url}`, data);
  }

  patch(url: string, data: any, isLodata: boolean = true) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    return this.http.patch(`${urlPrefix}/${url}`, data);
  }

  post(
    url: string,
    data: any,
    isLodata: boolean = true,
    config: any = undefined
  ) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    return this.http.post(`${urlPrefix}/${url}`, data, config);
  }

  getFile(url: string, isLodata: boolean = true) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    return this.http.get(`${urlPrefix}/${url}`, {
      responseType: 'arraybuffer',
    });
  }

  postFile(url: string, data: any, isLodata: boolean = true) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    return this.http.post(`${urlPrefix}/${url}`, data, {
      responseType: 'arraybuffer',
    });
  }

  delete(url: string, isLodata: boolean = true) {
    let urlPrefix = isLodata ? this.lodataPrefix : this._apiPrefix;
    return this.http.delete(`${urlPrefix}/${url}`);
  }

  generateCustomQueryForMultipleEntry(queryString: string, propery: string) {
    let ids = queryString.split(',').map(String);
    ids = ids.filter((id) => id !== '');
    return ids.map((id: string) => `${propery} eq ${id}`).join(' or ');
  }

  getValidIdsFromQueryParams(queryString: string) {
    return queryString
      .split(',')
      .map(Number)
      .filter((el) => !isNaN(el));
  }

  // Function to add or update query parameters
  updateQueryParams(params: { [key: string]: any }) {
    const currentParams = this.activatedRoute.snapshot.queryParams;
    const newParams = { ...currentParams, ...params };
    for (const key in newParams) {
      if (
        newParams[key] === '' ||
        newParams[key] === null ||
        newParams[key] === undefined
      ) {
        delete newParams[key];
      }
    }
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: newParams,
    });
  }

  getEntity(entity: string) {
    return lastValueFrom(this.getGeneratedId(entity)).catch(() => {
      return false;
    });
  }

  getGeneratedId(entity: string) {
    return this.http.get(`${this._apiPrefix}/generateId?entity=${entity}`).pipe(
      map((res: any) => {
        return res.entity;
      })
    );
  }

  paginateCustomTableData(
    top: number,
    skip: number,
    sortBy: string = 'id',
    sortType: string = 'asc',
    fieldName: string,
    searchText: string,
    url: string,
    expandQuery?: string,
    filterOperator: string = 'Contain',
    isCustomQuery: boolean = false,
    useOdataStyles = true,
    filterQuery: string = '',
    showCount: boolean = false,
    isV8: boolean = false
  ): Observable<any> {
    url = (isCustomQuery ? isV8 ? this._v8ApiPrefix : this.apiPrefixForRest : isV8 ? this._v8LodataPrefix : this.lodataPrefix) + url;
    const containsQuery = url.includes('?');

    // Check for search text
    if (
      searchText != null &&
      searchText != undefined &&
      searchText != '' &&
      (!isCustomQuery || url.includes('api/users'))
    ) {
      switch (filterOperator) {
        case Operator.CONTAINS:
          url += `${containsQuery ? '&' : '?'}$filter=${
            Operator.CONTAINS
          }(${fieldName},'${searchText}')`;
          break;
        case Operator.EQ:
          url += `${containsQuery ? '&' : '?'}$filter=${fieldName} ${
            Operator.EQ
          } ${searchText}`;
          break;
        case Operator.NE:
          url += `${containsQuery ? '&' : '?'}$filter=${fieldName} ${
            Operator.NE
          } ${searchText}`;
          break;
      }
    }

    if (filterQuery) {
      url += `${searchText ? ' and' : '?$filter='} ${filterQuery}`;
    }

    // Check for sort by
    if (sortBy && useOdataStyles) {
      let sort = sortBy.split('.').join('/');
      url += searchText || containsQuery || filterQuery ? '&' : '?';
      url += `$orderby=${sort} ${sortType || 'asc'}`;
    }

    // Check for top
    if (top > -1 && useOdataStyles) {
      url += searchText || sortBy || containsQuery || filterQuery ? '&' : '?';
      url += `$top=${top}&$skip=${skip}`;
    }

    if (expandQuery && useOdataStyles) {
      url += `& ${expandQuery}`;
    }

    // Check for count
    if (showCount && useOdataStyles) {
      url += `&$count=true`;
    }

    return this.http.get<any>(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('remember_token')}`,
      },
    });
  }

  openNewTab(url: string) {
    window.open(url, '_blank');
  }

  customIdValidation(generatedId: string, userGivenId: string) {
    const customId = userGivenId;
    const customIdParts = generatedId?.split('-') || [];
    const prefix = customIdParts[0] || '';
    let result = {
      success: true,
      msg: '',
    };
    switch (true) {
      case !customId:
        result.success = false;
        break;
      case !customId?.startsWith(prefix):
        result.success = true;
        break;
    }
    return result;
  }
}
