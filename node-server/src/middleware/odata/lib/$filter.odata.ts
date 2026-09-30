import { prismaFieldType } from "../protected/datatype.odata";

export const parseFilter = (filterStr: string, ModelName: string) => {
    if (!filterStr || filterStr.trim() === '') return {};

    if (filterStr.includes('$filter=')) {
        filterStr = filterStr.split('$filter=')[1];
    }
    filterStr = decodeURIComponent(filterStr);

    const unwrapParens = (str: string): string => {
        let MainString = str.trim();
        let depth = 0;
        let shouldUnwrap = false;

        if (MainString.startsWith('(') && MainString.endsWith(')')) {
            shouldUnwrap = true;

            for (let index = 0; index < MainString.length; index++) {
                if (MainString[index] === '(') depth++;
                else if (MainString[index] === ')') depth--;

                if (depth === 0 && index < MainString.length - 1) {
                    shouldUnwrap = false;
                    break;
                }
            }
        }

        if (shouldUnwrap) {
            MainString = MainString.slice(1, -1).trim();
        }

        return MainString;
    };

    const findTopLevelOperator = (expr: string): { operator: 'and' | 'or' | null; parts: string[] } => {
        let depth = 0;
        let inString = false;
        let stringChar = '';
        let parts: string[] = [];
        let current = '';
        let foundOperator: 'and' | 'or' | null = null;

        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];

            if ((char === "'" || char === '"') && (i === 0 || expr[i - 1] !== '\\')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }

            if (!inString) {
                if (char === '(') {
                    depth++;
                } else if (char === ')') {
                    depth--;
                }

                // Check for operators only at depth 0
                if (depth === 0) {
                    const remaining = expr.substring(i).toLowerCase();

                    // Check for 'and' operator
                    if (remaining.startsWith(' and ') && !/\w/.test(expr[i - 1] || '')) {
                        if (current.trim()) {
                            parts.push(current.trim());
                            if (!foundOperator) foundOperator = 'and';
                        }
                        current = '';
                        i += 4;
                        continue;
                    }

                    if (remaining.startsWith(' or ') && !/\w/.test(expr[i - 1] || '')) {
                        if (current.trim()) {
                            parts.push(current.trim());
                            if (!foundOperator) foundOperator = 'or';
                        }
                        current = '';
                        i += 3;
                        continue;
                    }
                }
            }

            current += char;
        }

        if (current.trim()) {
            parts.push(current.trim());
        }

        if (parts.length > 1 && !foundOperator) {

            foundOperator = 'and';
        }

        return { operator: foundOperator, parts };
    };


    const parseExpression = (expr: string): any => {
        expr = expr.trim();
        if (!expr) return null;

        expr = unwrapParens(expr);

        const { operator, parts } = findTopLevelOperator(expr);


        if (operator && parts.length > 1) {
            const conditions: any[] = [];

            for (const part of parts) {
                const condition = parseExpression(part);
                if (condition) {
                    conditions.push(condition);
                }
            }

            if (conditions.length > 0) {
                const prismaOperator = operator.toUpperCase();
                return conditions.length === 1 ? conditions[0] : { [prismaOperator]: conditions };
            }
            return null;
        }

        return parseCondition(expr);
    };


    const parseCondition = (cond: string): any => {
        cond = cond.trim();
        if (!cond) return null;

        cond = unwrapParens(cond);
        const lambdaMatch = cond.match(/^(\w+)\/(any|all)\s*\(\s*(\w+)\s*:\s*(.+)\s*\)$/i);
        if (lambdaMatch) {
            const [, relation, quantifier, alias, inner] = lambdaMatch;
            const innerParsed = parseExpression(inner);
            if (!innerParsed) return null;
            const cleanInner = removeAliasFromPaths(innerParsed, alias);
            return { [relation]: cleanInner };
        }

        const containsMatch = cond.match(/contains\s*\(\s*tolower\s*\(\s*([\w./-]+)\s*\)\s*,\s*'([^']*)'\s*\)/i);
        if (containsMatch) {
            const [, path, value] = containsMatch;
            return buildFieldCondition(path, { contains: decodeURIComponent(value).toLowerCase() });
        }

        const simpleContainsMatch = cond.match(/contains\s*\(\s*([\w./-]+)\s*,\s*'([^']*)'\s*\)/i);
        if (simpleContainsMatch) {
            const [, path, value] = simpleContainsMatch;
            return buildFieldCondition(path, { contains: decodeURIComponent(value) });
        }


        const logicalOperator = cond.includes(' or ') ? 'OR' : 'AND';
        const conditionsArray = logicalOperator === 'AND'
            ? cond.split(/\s+and\s+/i)
            : cond.split(/\s+or\s+/i);

        const fieldMap: Record<string, any> = {};

        conditionsArray.forEach(singleCond => {
            const comparisonMatch = singleCond.match(/^([\w./-]+)\s+(eq|ne|gt|ge|lt|le)\s+(.+)$/i);
            if (!comparisonMatch) return;

            const [, field, op, rawValue] = comparisonMatch;
            let value: any = rawValue.trim();

            if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                value = value.slice(1, -1);
            }
            value = decodeURIComponent(value);

            if (!isNaN(Number(value)) && value !== '') value = Number(value);
            else if (/^true$/i.test(value)) value = true;
            else if (/^false$/i.test(value)) value = false;
            else if (/^null$/i.test(value)) value = null;

            const prismaOp: any = {
                eq: 'equals',
                ne: 'not',
                gt: 'gt',
                ge: 'gte',
                lt: 'lt',
                le: 'lte',
            }[op.toLowerCase()];

            if (!prismaOp) return;

            if (!fieldMap[field]) fieldMap[field] = {};


            // set data type ================ might need next time =======

            if (prismaFieldType(ModelName, field) === 'DateTime') {
                value = new Date(value);
            }

            // end data type =============================

            fieldMap[field][prismaOp] = value;
        });

        const parsedConditions = Object.entries(fieldMap).map(([field, cond]) =>
            buildFieldCondition(field, cond)
        );

        if (parsedConditions.length === 0) return null;
        if (parsedConditions.length === 1) return parsedConditions[0];

        return { [logicalOperator]: parsedConditions };
    };


    // condition end
    const buildFieldCondition = (path: string, condition: any): any => {
        const cleanPath = path.includes('/') ? path.split('/')[1] : path;
        const parts = cleanPath.split('.');
        if (parts.length === 1) {
            return { [cleanPath]: condition };
        }

        let obj: any = {};
        let cur = obj;

        for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1) {
                cur[parts[i]] = condition;
            } else {
                cur[parts[i]] = {};
                cur = cur[parts[i]];
            }
        }

        return obj;
    };

    const removeAliasFromPaths = (obj: any, alias: string): any => {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (obj.AND || obj.OR) {
            const operator = obj.AND ? 'AND' : 'OR';
            const conditions = obj[operator].map((condition: any) =>
                removeAliasFromPaths(condition, alias)
            );
            return { [operator]: conditions };
        }


        const result: any = {};
        for (const key in obj) {
            if (key.includes('/') && key.startsWith(alias + '/')) {

                const cleanKey = key.split('/')[1];
                result[cleanKey] = removeAliasFromPaths(obj[key], alias);
            } else {
                result[key] = removeAliasFromPaths(obj[key], alias);
            }
        }

        return result;
    };


    try {

        const result = parseExpression(filterStr);


        return result || {};
    } catch (error) {
        console.error('Error parsing filter:', error);
        return {};
    }
}
