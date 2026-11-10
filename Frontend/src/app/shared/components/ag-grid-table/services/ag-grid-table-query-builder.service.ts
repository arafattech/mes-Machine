import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import moment from 'moment';
import {
  AgGridTableFetchRequest,
  AgGridTableODataSourceConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';

@Injectable({
  providedIn: 'root',
})
export class AgGridTableQueryBuilderService {
  buildOdataParams(
    request: AgGridTableFetchRequest,
    config: AgGridTableODataSourceConfig,
  ) {
    const pageSize = Math.max(
      (request.endRow || config.pageSize || 40) - (request.startRow || 0),
      1,
    );

    let params = new HttpParams()
      .set('$top', String(pageSize))
      .set('$skip', String(request.startRow || 0))
      .set('$count', 'true');

    const sortQuery = this.buildSortQuery(request.sortModel, config.type === 'api');
    if (sortQuery) {
      params = params.set('$orderby', sortQuery);
    }

    if (config.expand) {
      params = params.set(
        '$expand',
        config.expand.replace(/^\$expand=/, '').trim(),
      );
    }

    const filterExpressions = this.buildFilterExpressions(request, config);
    if (filterExpressions.length) {
      params = params.set('$filter', filterExpressions.join(' and '));
    }

    return params;
  }

  private buildSortQuery(sortModel: readonly { colId: string; sort: string }[], isApiType: boolean) {
    const clauses = (sortModel || [])
      .filter((entry) => entry.colId && entry.sort)
      .map((entry) => ({ ...entry, field: this.normalizeField(entry.colId) }))
      .filter(({ field }) => !field.includes('/'))
      .map(({ field, sort }) => `${field} ${sort}`);

    // A sort column with repeated values (e.g. bulk-seeded rows sharing the same
    // created_at) makes $skip/$top pagination non-deterministic — MySQL has no
    // guaranteed tie order, so the same row can reappear on a later page while
    // another is skipped, silently losing rows across an infinite-scroll session.
    // A stable id tiebreaker fixes that without changing the primary sort; it follows the
    // primary sort's direction so a newest-first sort stays newest-first within ties.
    // Skipped for type:'api' — those hit bespoke REST controllers whose $orderby
    // parsing is a single anchored `field (asc|desc)` regex with no comma support;
    // a real OData/lodata backend parses multi-clause $orderby natively.
    if (!isApiType && clauses.length && !clauses.some((c) => c.startsWith('id '))) {
      const primaryDirection = clauses[0].endsWith(' desc') ? 'desc' : 'asc';
      clauses.push(`id ${primaryDirection}`);
    }

    return clauses.join(', ');
  }

  private buildFilterExpressions(
    request: AgGridTableFetchRequest,
    config: AgGridTableODataSourceConfig,
  ) {
    const expressions: string[] = [];

    if (request.searchText?.trim() && config.searchFields?.length) {
      const lowerText = this.escapeValue(request.searchText.trim()).toLowerCase();
      const searchConditions = config.searchFields.map((field) => {
        const normalized = this.normalizeField(field);
        if (normalized.includes('/')) {
          const slash = normalized.indexOf('/');
          const parent = normalized.substring(0, slash);
          const child = normalized.substring(slash + 1);
          return `(${parent}/any(a:contains(tolower(a/${child}), '${lowerText}')))`;
        }
        return `(contains(tolower(${normalized}), '${lowerText}'))`;
      });
      expressions.push(`(${searchConditions.join(' or ')})`);
    }

    Object.entries(request.filterModel || {}).forEach(([field, model]) => {
      const expression = this.buildColumnFilterExpression(field, model);
      if (expression) {
        expressions.push(expression);
      }
    });

    if (config.additionalFilter?.trim()) {
      expressions.push(`(${config.additionalFilter.trim()})`);
    }

    return expressions;
  }

  // Public: the multiSelect header bypasses AG Grid's filter model and asks the grid
  // component to build a single column's OData fragment directly from a filter model.
  buildColumnFilterExpression(field: string, model: any): string {
    if (!model) {
      return '';
    }

    if (model.operator && Array.isArray(model.conditions)) {
      const nestedConditions = model.conditions
        .map((condition: any) =>
          this.buildSimpleFilterExpression(field, condition),
        )
        .filter(Boolean);

      if (!nestedConditions.length) {
        return '';
      }

      const joinOperator = model.operator?.toLowerCase() === 'or' ? ' or ' : ' and ';
      return `(${nestedConditions.join(joinOperator)})`;
    }

    return this.buildSimpleFilterExpression(field, model);
  }

  private buildSimpleFilterExpression(field: string, model: any): string {
    const normalizedField = this.normalizeField(field);

    switch (model?.filterType) {
      case 'number':
        return this.buildNumberFilterExpression(normalizedField, model);
      case 'date':
        return this.buildDateFilterExpression(normalizedField, model);
      case 'text':
      default:
        return this.buildTextFilterExpression(normalizedField, model);
    }
  }

  private buildTextFilterExpression(field: string, model: any) {
    const raw = this.escapeValue(model?.filter);
    const lower = raw.toLowerCase();
    const isNavPath = field.includes('/');
    if (!raw && !['blank', 'notBlank'].includes(model?.type)) {
      return '';
    }

    if (isNavPath) {
      const slash = field.indexOf('/');
      const parent = field.substring(0, slash);
      const child = field.substring(slash + 1);
      switch (model?.type) {
        case 'equals':    return `${parent}/any(a:a/${child} eq '${raw}')`;
        case 'notEqual':  return `${parent}/any(a:a/${child} ne '${raw}')`;
        case 'startsWith': return `${parent}/any(a:startswith(tolower(a/${child}), '${lower}'))`;
        case 'endsWith':   return `${parent}/any(a:endswith(tolower(a/${child}), '${lower}'))`;
        case 'blank':      return `(${parent}/any(a:a/${child} eq null) or ${parent}/any(a:a/${child} eq ''))`;
        case 'notBlank':   return `(${parent}/any(a:a/${child} ne null) and ${parent}/any(a:a/${child} ne ''))`;
        case 'in': {
          const parts = String(model?.filter ?? '').split('|').filter(Boolean);
          if (!parts.length) return '';
          const clauses = parts.map(v => {
            const num = Number(v);
            return isNaN(num) || !Number.isFinite(num)
              ? `${parent}/any(a:a/${child} eq '${this.escapeValue(v)}')`
              : `${parent}/any(a:a/${child} eq ${num})`;
          });
          return clauses.length === 1 ? clauses[0] : `(${clauses.join(' or ')})`;
        }
        case 'contains':
        default: return `${parent}/any(a:contains(tolower(a/${child}), '${lower}'))`;
      }
    }

    switch (model?.type) {
      case 'equals':    return `tolower(${field}) eq '${lower}'`;
      case 'notEqual':  return `tolower(${field}) ne '${lower}'`;
      case 'startsWith': return `startswith(tolower(${field}), '${lower}')`;
      case 'endsWith':   return `endswith(tolower(${field}), '${lower}')`;
      case 'blank':      return `(${field} eq null or ${field} eq '')`;
      case 'notBlank':   return `(${field} ne null and ${field} ne '')`;
      case 'in': {
        const parts = String(model?.filter ?? '').split('|').filter(Boolean);
        if (!parts.length) return '';
        const clauses = parts.map(v => {
          const num = Number(v);
          return isNaN(num) || !Number.isFinite(num)
            ? `${field} eq '${this.escapeValue(v)}'`
            : `${field} eq ${num}`;
        });
        return clauses.length === 1 ? clauses[0] : `(${clauses.join(' or ')})`;
      }
      case 'contains':
      default: return `contains(tolower(${field}), '${lower}')`;
    }
  }

  private buildNumberFilterExpression(field: string, model: any) {
    const filterValue = model?.filter;
    const filterToValue = model?.filterTo;

    if (filterValue === null || filterValue === undefined || filterValue === '') {
      return '';
    }

    switch (model?.type) {
      case 'equals':
        return `${field} eq ${filterValue}`;
      case 'notEqual':
        return `${field} ne ${filterValue}`;
      case 'lessThan':
        return `${field} lt ${filterValue}`;
      case 'lessThanOrEqual':
        return `${field} le ${filterValue}`;
      case 'greaterThan':
        return `${field} gt ${filterValue}`;
      case 'greaterThanOrEqual':
        return `${field} ge ${filterValue}`;
      case 'inRange':
        if (filterToValue === null || filterToValue === undefined || filterToValue === '') {
          return '';
        }
        return `(${field} ge ${filterValue} and ${field} le ${filterToValue})`;
      case 'blank':
        return `${field} eq null`;
      case 'notBlank':
        return `${field} ne null`;
      default:
        return '';
    }
  }

  private buildDateFilterExpression(field: string, model: any) {
    const startMoment = this.parseDate(model?.dateFrom);
    const endMoment = this.parseDate(model?.dateTo);

    if (!startMoment && !['blank', 'notBlank'].includes(model?.type)) {
      return '';
    }

    switch (model?.type) {
      case 'equals': {
        const start = startMoment!.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss');
        const end = startMoment!.clone().endOf('day').format('YYYY-MM-DD HH:mm:ss');
        return `(${field} ge '${start}' and ${field} le '${end}')`;
      }
      case 'greaterThan':
        return `${field} gt '${startMoment!.clone().endOf('day').format('YYYY-MM-DD HH:mm:ss')}'`;
      case 'greaterThanOrEqual':
        return `${field} ge '${startMoment!.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss')}'`;
      case 'lessThan':
        return `${field} lt '${startMoment!.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss')}'`;
      case 'lessThanOrEqual':
        return `${field} le '${startMoment!.clone().endOf('day').format('YYYY-MM-DD HH:mm:ss')}'`;
      case 'inRange': {
        const rangeEnd = (endMoment || startMoment)!
          .clone()
          .endOf('day')
          .format('YYYY-MM-DD HH:mm:ss');
        const rangeStart = startMoment!
          .clone()
          .startOf('day')
          .format('YYYY-MM-DD HH:mm:ss');
        return `(${field} ge '${rangeStart}' and ${field} le '${rangeEnd}')`;
      }
      case 'blank':
        return `${field} eq null`;
      case 'notBlank':
        return `${field} ne null`;
      default:
        return '';
    }
  }

  private parseDate(value: string | null | undefined) {
    if (!value) {
      return null;
    }
    const parsedDate = moment(value, [moment.ISO_8601, 'YYYY-MM-DD'], true);
    return parsedDate.isValid() ? parsedDate : null;
  }

  private normalizeField(field: string) {
    return field.replace(/\./g, '/');
  }

  private escapeValue(value: string | number | null | undefined) {
    return String(value ?? '').replace(/'/g, "''");
  }
}
