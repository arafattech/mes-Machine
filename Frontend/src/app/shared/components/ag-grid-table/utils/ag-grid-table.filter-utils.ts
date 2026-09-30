import moment from 'moment';
import {
  AgGridTableFilterOption,
  AgGridTableFilterOptionInput,
} from '../types/ag-grid-table.types';

export function normalizeAgGridTableFilterOptions(
  options: AgGridTableFilterOptionInput[] | undefined,
): AgGridTableFilterOption[] {
  return (options || [])
    .map((option) => normalizeAgGridTableFilterOption(option))
    .filter(
      (option): option is AgGridTableFilterOption =>
        !!option?.value && !!option.label,
    );
}

export function buildAgGridDateRangeValue(
  startDate: string | null | undefined,
  endDate?: string | null | undefined,
) {
  const start = parseAgGridDateValue(startDate);
  const end = parseAgGridDateValue(endDate || startDate);

  if (!start) {
    return '';
  }

  if (!end || start.isSame(end, 'day')) {
    return start.format('DD/MM/YYYY');
  }

  return `${start.format('DD/MM/YYYY')} - ${end.format('DD/MM/YYYY')}`;
}

export function parseAgGridDateRangeValue(value: string | null | undefined) {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) {
    return null;
  }

  const rangeParts = trimmedValue.split(/\s+-\s+/);
  const start = parseAgGridDateValue(rangeParts[0]);
  const end = parseAgGridDateValue(rangeParts[1] || rangeParts[0]);

  if (!start) {
    return null;
  }

  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: (end || start).format('YYYY-MM-DD'),
  };
}

function normalizeAgGridTableFilterOption(
  option: AgGridTableFilterOptionInput,
): AgGridTableFilterOption | null {
  if (option === null || option === undefined) {
    return null;
  }

  if (typeof option === 'string' || typeof option === 'number') {
    const value = String(option).trim();
    return value ? { label: value, value } : null;
  }

  const rawValue =
    option.value ??
    option.custom_id ??
    option.id ??
    option.text ??
    option.name ??
    option.label;
  const rawLabel =
    option.label ??
    option.name ??
    option.text ??
    option.value ??
    option.custom_id ??
    option.id;

  const value = String(rawValue ?? '').trim();
  const label = String(rawLabel ?? '').trim();

  if (!value || !label) {
    return null;
  }

  return { label, value };
}

function parseAgGridDateValue(value: string | null | undefined) {
  const parsedDate = moment(String(value || '').trim(), [
    'DD/MM/YYYY',
    'YYYY-MM-DD',
    moment.ISO_8601,
  ], true);

  return parsedDate.isValid() ? parsedDate : null;
}
