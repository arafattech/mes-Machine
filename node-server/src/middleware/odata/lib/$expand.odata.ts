import { parseFilter } from './$filter.odata';

type Delimiter = ',' | ';';

const splitTopLevel = (input: string, delimiter: Delimiter): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let buffer = '';

  for (const character of input) {
    if (character === '(') depth++;
    if (character === ')') depth--;

    if (character === delimiter && depth === 0) {
      const value = buffer.trim();
      if (value) parts.push(value);
      buffer = '';
      continue;
    }

    buffer += character;
  }

  const lastValue = buffer.trim();
  if (lastValue) parts.push(lastValue);

  return parts;
};

const splitOnce = (input: string, separator = '=') => {
  const index = input.indexOf(separator);
  if (index === -1) return [input.trim(), ''] as const;
  return [input.slice(0, index).trim(), input.slice(index + 1).trim()] as const;
};

const parseOptions = (inside: string): Record<string, string> => {
  const options: Record<string, string> = {};

  for (const part of splitTopLevel(inside, ';')) {
    const [key, value] = splitOnce(part, '=');
    if (key) options[key] = value;
  }

  return options;
};

const parseCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const parseExpand = (expandStr: string, fieldName: any, isSelect = false) => {
  const parseRelation = (token: string): any => {
    const match = token.match(/^([A-Za-z_]\w*)\s*\(\s*(.*?)\s*\)$/);

    if (!match) {
      return { [token.trim()]: true };
    }

    const relation = match[1];
    const inside = match[2] ?? '';
    const options = parseOptions(inside);

    const query: any = {};

    if (options.$filter) {
      query.where = parseFilter(options.$filter, fieldName);
    }

    let selectFields: any = undefined;
    if (options.$select) {
      selectFields = {};
      for (const field of parseCsv(options.$select)) {
        selectFields[field] = true;
      }
    }

    let nestedExpand: any = undefined;
    if (options.$expand) {
      nestedExpand = parseExpand(options.$expand, fieldName, true);
    }

    if (selectFields || nestedExpand) {
      query.select = { ...(selectFields ?? {}), ...(nestedExpand ?? {}) };
    }

    if (!isSelect && !query.select && nestedExpand) {
      query.include = nestedExpand;
    }

    if (!Object.keys(query).length) {
      return { [relation]: true };
    }

    return { [relation]: query };
  };

  const result: any = {};

  for (const part of splitTopLevel(expandStr, ',')) {
    Object.assign(result, parseRelation(part));
  }

  return result;
};
